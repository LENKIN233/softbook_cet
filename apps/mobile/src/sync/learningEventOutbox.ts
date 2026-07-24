import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LearningCardResult, LearningTrack } from '../learning/model';
import type {
  LearningEventPhase,
  LearningEventV2,
} from './learningEventsRepository';
import { MAX_LEARNING_EVENT_BATCH_SIZE } from './learningEventsRepository';

const OUTBOX_SCHEMA_VERSION = 'learning-event-outbox.v2' as const;
export const LEARNING_EVENT_OUTBOX_STORAGE_KEY =
  '__softbook_learning_event_outbox_v2';
export const LEGACY_LEARNING_EVENT_OUTBOX_STORAGE_KEY =
  '__softbook_learning_event_outbox_v1';
const CARD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CONTENT_VERSION_PATTERN = /^sha256:[a-f0-9]{64}$/;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const SELECTION_ID_PATTERN = /^sel_[A-Za-z0-9_-]{16,128}$/;

export type LearningEventOutboxEntry = {
  accountPhoneNumber: string;
  enqueuedAt: string;
  event: LearningEventV2;
  retryCount: number;
  track: LearningTrack;
};

type LearningEventOutboxState = {
  schemaVersion: typeof OUTBOX_SCHEMA_VERSION;
  deviceId: string;
  nextSequence: number;
  entries: LearningEventOutboxEntry[];
};

export type LearningEventOutboxStorage = {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type EnqueueLearningCompletionInput = {
  accountPhoneNumber: string;
  contentVersion: string;
  phase: LearningEventPhase;
  result: LearningCardResult;
  selectionId: string;
  track: LearningTrack;
};

export function createInMemoryLearningEventOutboxStorage(
  seed: Record<string, string> = {},
): LearningEventOutboxStorage {
  return {
    getItem: async key => seed[key] ?? null,
    removeItem: async key => {
      delete seed[key];
    },
    setItem: async (key, value) => {
      seed[key] = value;
    },
  };
}

export function createReactNativeLearningEventOutboxStorage(): LearningEventOutboxStorage {
  return {
    getItem: key => AsyncStorage.getItem(key),
    removeItem: key => AsyncStorage.removeItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
  };
}

export class LearningEventOutbox {
  private readonly createDeviceId: () => string;
  private readonly hydrationPromise: Promise<void>;
  private readonly key: string;
  private readonly legacyKey: string | null;
  private readonly now: () => string;
  private operationTail: Promise<void> = Promise.resolve();
  private state: LearningEventOutboxState | null = null;
  private readonly storage: LearningEventOutboxStorage;

  constructor(
    options: {
      createDeviceId?: () => string;
      key?: string;
      legacyKey?: string | null;
      now?: () => string;
      storage?: LearningEventOutboxStorage;
    } = {},
  ) {
    this.createDeviceId = options.createDeviceId ?? createDefaultDeviceId;
    this.key = options.key ?? LEARNING_EVENT_OUTBOX_STORAGE_KEY;
    this.legacyKey =
      options.legacyKey === undefined
        ? LEGACY_LEARNING_EVENT_OUTBOX_STORAGE_KEY
        : options.legacyKey;
    this.now = options.now ?? (() => new Date().toISOString());
    this.storage =
      options.storage ?? createReactNativeLearningEventOutboxStorage();
    this.hydrationPromise = this.load();
  }

  async hydrate(): Promise<void> {
    await this.hydrationPromise;
  }

  enqueueCompletion(
    input: EnqueueLearningCompletionInput,
  ): Promise<LearningEventOutboxEntry> {
    return this.runExclusive(async () => {
      const state = this.requireState();
      validateCompletionInput(input);

      if (
        state.entries.some(
          entry => entry.accountPhoneNumber === input.accountPhoneNumber,
        )
      ) {
        throw new Error(
          'A pending learning event must be acknowledged before another completion.',
        );
      }

      if (
        !Number.isSafeInteger(state.nextSequence) ||
        state.nextSequence <= 0
      ) {
        throw new Error('Learning event outbox sequence is invalid.');
      }

      const sequence = state.nextSequence;
      const eventId = createEventId(state.deviceId, sequence);
      const enqueuedAt = this.now();

      if (!isRfc3339Instant(enqueuedAt)) {
        throw new Error('Learning event outbox enqueue time is invalid.');
      }

      const entry: LearningEventOutboxEntry = {
        accountPhoneNumber: input.accountPhoneNumber,
        enqueuedAt,
        event: {
          event_id: eventId,
          selection_id: input.selectionId,
          card_id: input.result.cardId,
          interaction_id: input.result.interactionId,
          phase: input.phase,
          outcome: input.result.outcome,
          answer_grade: answerGradeForOutcome(input.result.outcome),
          used_hint: input.result.usedHint,
          used_peek: input.result.usedPeek,
          client_occurred_at: input.result.completedAt,
          content_version: input.contentVersion,
          device_cursor: {
            device_id: state.deviceId,
            sequence,
          },
        },
        retryCount: 0,
        track: input.track,
      };
      const candidate = cloneState(state);

      candidate.entries.push(entry);

      if (sequence === Number.MAX_SAFE_INTEGER) {
        candidate.deviceId = requireDeviceId(this.createDeviceId());
        candidate.nextSequence = 1;
      } else {
        candidate.nextSequence = sequence + 1;
      }

      await this.persistCandidate(candidate);
      return cloneEntry(entry);
    });
  }

  getBatch(
    accountPhoneNumber: string,
    limit = MAX_LEARNING_EVENT_BATCH_SIZE,
  ): Promise<LearningEventOutboxEntry[]> {
    return this.runExclusive(async () => {
      requirePhoneNumber(accountPhoneNumber);

      if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 9) {
        throw new Error(
          'Learning event outbox batch limit must be 1 through 9.',
        );
      }

      const accountEntries = this.requireState().entries.filter(
        entry => entry.accountPhoneNumber === accountPhoneNumber,
      );
      const firstTrack = accountEntries[0]?.track;

      if (!firstTrack) {
        return [];
      }

      const batch: LearningEventOutboxEntry[] = [];

      for (const entry of accountEntries) {
        if (entry.track !== firstTrack || batch.length === limit) {
          break;
        }

        batch.push(cloneEntry(entry));
      }

      return batch;
    });
  }

  acknowledge(
    accountPhoneNumber: string,
    eventIds: readonly string[],
  ): Promise<void> {
    return this.runExclusive(async () => {
      requirePhoneNumber(accountPhoneNumber);

      if (eventIds.length === 0 || new Set(eventIds).size !== eventIds.length) {
        throw new Error('Learning event acknowledgements require unique IDs.');
      }

      const state = this.requireState();
      const acknowledgedIds = new Set(eventIds);
      const accountEventIds = new Set(
        state.entries
          .filter(entry => entry.accountPhoneNumber === accountPhoneNumber)
          .map(entry => entry.event.event_id),
      );

      if (eventIds.some(eventId => !accountEventIds.has(eventId))) {
        throw new Error(
          'Learning event acknowledgement references unknown ID.',
        );
      }

      const candidate = cloneState(state);
      candidate.entries = candidate.entries.filter(
        entry =>
          entry.accountPhoneNumber !== accountPhoneNumber ||
          !acknowledgedIds.has(entry.event.event_id),
      );
      await this.persistCandidate(candidate);
    });
  }

  incrementRetry(
    accountPhoneNumber: string,
    eventIds: readonly string[],
  ): Promise<void> {
    return this.runExclusive(async () => {
      requirePhoneNumber(accountPhoneNumber);
      const targetIds = new Set(eventIds);
      const candidate = cloneState(this.requireState());

      candidate.entries.forEach(entry => {
        if (
          entry.accountPhoneNumber === accountPhoneNumber &&
          targetIds.has(entry.event.event_id)
        ) {
          entry.retryCount = Math.min(
            entry.retryCount + 1,
            Number.MAX_SAFE_INTEGER,
          );
        }
      });
      await this.persistCandidate(candidate);
    });
  }

  getPendingCount(accountPhoneNumber: string): Promise<number> {
    return this.runExclusive(async () => {
      requirePhoneNumber(accountPhoneNumber);
      return this.requireState().entries.filter(
        entry => entry.accountPhoneNumber === accountPhoneNumber,
      ).length;
    });
  }

  getAll(): Promise<LearningEventOutboxEntry[]> {
    return this.runExclusive(async () =>
      this.requireState().entries.map(cloneEntry),
    );
  }

  clearAccount(accountPhoneNumber: string): Promise<void> {
    return this.runExclusive(async () => {
      requirePhoneNumber(accountPhoneNumber);
      const candidate = cloneState(this.requireState());

      candidate.entries = candidate.entries.filter(
        entry => entry.accountPhoneNumber !== accountPhoneNumber,
      );
      await this.persistCandidate(candidate);
    });
  }

  private async load(): Promise<void> {
    if (this.legacyKey !== null && this.legacyKey !== this.key) {
      await this.storage.removeItem(this.legacyKey);
    }

    const stored = await this.storage.getItem(this.key);

    if (!stored) {
      this.state = createEmptyState(this.createDeviceId());
      return;
    }

    let sanitized: LearningEventOutboxState;

    try {
      const parsed: unknown = JSON.parse(stored);
      sanitized = sanitizeState(parsed, this.createDeviceId);
    } catch {
      console.warn(
        '[LearningEventOutbox] Discarded unreadable persisted state.',
      );
      this.state = createEmptyState(this.createDeviceId());
      return;
    }

    if (stored !== JSON.stringify(sanitized)) {
      await this.storage.setItem(this.key, JSON.stringify(sanitized));
    }

    this.state = sanitized;
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail
      .then(() => this.hydrationPromise)
      .then(operation);

    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private requireState() {
    if (!this.state) {
      throw new Error('Learning event outbox is not hydrated.');
    }

    return this.state;
  }

  private async persistCandidate(candidate: LearningEventOutboxState) {
    await this.storage.setItem(this.key, JSON.stringify(candidate));
    this.state = candidate;
  }
}

function sanitizeState(
  candidate: unknown,
  createDeviceId: () => string,
): LearningEventOutboxState {
  if (
    !isExactObject(candidate, [
      'schemaVersion',
      'deviceId',
      'nextSequence',
      'entries',
    ]) ||
    candidate.schemaVersion !== OUTBOX_SCHEMA_VERSION
  ) {
    return createEmptyState(createDeviceId());
  }

  let deviceId = requireDeviceId(candidate.deviceId);
  let nextSequence = candidate.nextSequence;

  if (!Number.isSafeInteger(nextSequence) || (nextSequence as number) <= 0) {
    return createEmptyState(createDeviceId());
  }

  const seenCursorKeys = new Set<string>();
  const seenEventIds = new Set<string>();
  const seenAccounts = new Set<string>();
  const entries = Array.isArray(candidate.entries)
    ? candidate.entries.flatMap(entry => {
        try {
          const sanitized = sanitizeEntry(entry);
          const cursorKey = `${sanitized.event.device_cursor.device_id}:${sanitized.event.device_cursor.sequence}`;

          if (
            sanitized.event.event_id !==
              createEventId(
                sanitized.event.device_cursor.device_id,
                sanitized.event.device_cursor.sequence,
              ) ||
            seenCursorKeys.has(cursorKey) ||
            seenEventIds.has(sanitized.event.event_id) ||
            seenAccounts.has(sanitized.accountPhoneNumber)
          ) {
            return [];
          }

          seenCursorKeys.add(cursorKey);
          seenEventIds.add(sanitized.event.event_id);
          seenAccounts.add(sanitized.accountPhoneNumber);
          return [sanitized];
        } catch {
          return [];
        }
      })
    : [];
  const highestCurrentDeviceSequence = entries.reduce(
    (highest, entry) =>
      entry.event.device_cursor.device_id === deviceId
        ? Math.max(highest, entry.event.device_cursor.sequence)
        : highest,
    0,
  );

  if ((nextSequence as number) <= highestCurrentDeviceSequence) {
    if (highestCurrentDeviceSequence === Number.MAX_SAFE_INTEGER) {
      deviceId = requireDeviceId(createDeviceId());
      nextSequence = 1;
    } else {
      nextSequence = highestCurrentDeviceSequence + 1;
    }
  }

  return {
    schemaVersion: OUTBOX_SCHEMA_VERSION,
    deviceId,
    nextSequence: nextSequence as number,
    entries,
  };
}

function sanitizeEntry(candidate: unknown): LearningEventOutboxEntry {
  if (
    !isExactObject(candidate, [
      'accountPhoneNumber',
      'enqueuedAt',
      'event',
      'retryCount',
      'track',
    ])
  ) {
    throw new Error('Learning event outbox entry must be an object.');
  }

  const accountPhoneNumber = requirePhoneNumber(candidate.accountPhoneNumber);
  const track = requireTrack(candidate.track);
  const retryCount = candidate.retryCount;
  const enqueuedAt = candidate.enqueuedAt;

  if (!Number.isSafeInteger(retryCount) || (retryCount as number) < 0) {
    throw new Error('Learning event outbox retry count is invalid.');
  }

  if (typeof enqueuedAt !== 'string' || !isRfc3339Instant(enqueuedAt)) {
    throw new Error('Learning event outbox enqueue time is invalid.');
  }

  return {
    accountPhoneNumber,
    enqueuedAt,
    event: sanitizeEvent(candidate.event, track),
    retryCount: retryCount as number,
    track,
  };
}

function sanitizeEvent(
  candidate: unknown,
  expectedTrack: LearningTrack,
): LearningEventV2 {
  if (
    !isExactObject(candidate, [
      'event_id',
      'selection_id',
      'card_id',
      'interaction_id',
      'phase',
      'outcome',
      'answer_grade',
      'used_hint',
      'used_peek',
      'client_occurred_at',
      'content_version',
      'device_cursor',
    ]) ||
    !isExactObject(candidate.device_cursor, ['device_id', 'sequence'])
  ) {
    throw new Error('Learning event outbox payload is invalid.');
  }

  const event = candidate as unknown as LearningEventV2;
  const expectedGrade = answerGradeForOutcome(event.outcome);

  if (
    typeof event.event_id !== 'string' ||
    !OPAQUE_ID_PATTERN.test(event.event_id) ||
    typeof event.selection_id !== 'string' ||
    !SELECTION_ID_PATTERN.test(event.selection_id) ||
    typeof event.card_id !== 'string' ||
    !CARD_ID_PATTERN.test(event.card_id) ||
    !isInteraction(event.interaction_id) ||
    (event.phase !== 'learning' && event.phase !== 'review') ||
    !isAllowedOutcome(event.interaction_id, event.outcome) ||
    event.answer_grade !== expectedGrade ||
    typeof event.used_hint !== 'boolean' ||
    typeof event.used_peek !== 'boolean' ||
    !isRfc3339Instant(event.client_occurred_at) ||
    !CONTENT_VERSION_PATTERN.test(event.content_version) ||
    typeof event.device_cursor.device_id !== 'string' ||
    !DEVICE_ID_PATTERN.test(event.device_cursor.device_id) ||
    !Number.isSafeInteger(event.device_cursor.sequence) ||
    event.device_cursor.sequence <= 0 ||
    (expectedTrack !== 'cet4' && expectedTrack !== 'cet6')
  ) {
    throw new Error('Learning event outbox payload is invalid.');
  }

  return JSON.parse(JSON.stringify(event)) as LearningEventV2;
}

function validateCompletionInput(input: EnqueueLearningCompletionInput) {
  requirePhoneNumber(input.accountPhoneNumber);
  requireTrack(input.track);

  if (input.phase !== 'learning' && input.phase !== 'review') {
    throw new Error('Learning completion phase is invalid.');
  }

  if (!SELECTION_ID_PATTERN.test(input.selectionId)) {
    throw new Error('Learning completion selection ID is invalid.');
  }

  if (
    typeof input.result.cardId !== 'string' ||
    !CARD_ID_PATTERN.test(input.result.cardId) ||
    typeof input.result.usedHint !== 'boolean' ||
    typeof input.result.usedPeek !== 'boolean'
  ) {
    throw new Error('Learning completion result is invalid.');
  }

  if (!CONTENT_VERSION_PATTERN.test(input.contentVersion)) {
    throw new Error('Learning completion requires a SHA-256 content version.');
  }

  if (!isAllowedOutcome(input.result.interactionId, input.result.outcome)) {
    throw new Error('Learning completion outcome does not match interaction.');
  }

  if (!isRfc3339Instant(input.result.completedAt)) {
    throw new Error('Learning completion time must be an RFC3339 instant.');
  }
}

function answerGradeForOutcome(
  outcome: LearningCardResult['outcome'],
): 'passed' | 'review_needed' {
  return outcome === 'correct' || outcome === 'confident'
    ? 'passed'
    : 'review_needed';
}

function isAllowedOutcome(
  interactionId: LearningCardResult['interactionId'],
  outcome: LearningCardResult['outcome'],
) {
  return interactionId === 'flip'
    ? outcome === 'confident' || outcome === 'review'
    : outcome === 'correct' || outcome === 'incorrect';
}

function isInteraction(
  value: unknown,
): value is LearningCardResult['interactionId'] {
  return (
    value === 'flip' ||
    value === 'multiple_choice' ||
    value === 'lock' ||
    value === 'elimination' ||
    value === 'swipe'
  );
}

function requirePhoneNumber(candidate: unknown): string {
  if (typeof candidate !== 'string' || !/^\d{11}$/.test(candidate)) {
    throw new Error(
      'Learning event outbox requires an 11-digit account owner.',
    );
  }

  return candidate;
}

function requireTrack(candidate: unknown): LearningTrack {
  if (candidate !== 'cet4' && candidate !== 'cet6') {
    throw new Error('Learning event outbox track must be cet4 or cet6.');
  }

  return candidate;
}

function requireDeviceId(candidate: unknown): string {
  if (typeof candidate !== 'string' || !DEVICE_ID_PATTERN.test(candidate)) {
    throw new Error('Learning event outbox device ID is invalid.');
  }

  return candidate;
}

function createEmptyState(deviceId: string): LearningEventOutboxState {
  return {
    schemaVersion: OUTBOX_SCHEMA_VERSION,
    deviceId: requireDeviceId(deviceId),
    nextSequence: 1,
    entries: [],
  };
}

function createDefaultDeviceId() {
  const random = `${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`.slice(0, 24);
  return `install_${Date.now().toString(36)}_${random}`;
}

function createEventId(deviceId: string, sequence: number) {
  const eventId = `event_${deviceId}_${sequence.toString(36)}`;

  if (!OPAQUE_ID_PATTERN.test(eventId)) {
    throw new Error('Learning event ID allocation failed.');
  }

  return eventId;
}

function cloneState(state: LearningEventOutboxState): LearningEventOutboxState {
  return JSON.parse(JSON.stringify(state)) as LearningEventOutboxState;
}

function cloneEntry(entry: LearningEventOutboxEntry): LearningEventOutboxEntry {
  return JSON.parse(JSON.stringify(entry)) as LearningEventOutboxEntry;
}

function isRfc3339Instant(candidate: unknown): candidate is string {
  return (
    typeof candidate === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      candidate,
    ) &&
    Number.isFinite(Date.parse(candidate))
  );
}

function isExactObject(
  candidate: unknown,
  expectedFields: readonly string[],
): candidate is Record<string, unknown> {
  if (!isObject(candidate)) {
    return false;
  }

  const actualFields = Object.keys(candidate);
  return (
    actualFields.length === expectedFields.length &&
    expectedFields.every(field => actualFields.includes(field))
  );
}

function isObject(candidate: unknown): candidate is Record<string, unknown> {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    !Array.isArray(candidate)
  );
}
