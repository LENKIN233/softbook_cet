import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MembershipState } from '../membership/localMembership';
import type { MembershipRepositoryContext } from '../membership/membershipRepository';
import type { LearningTrack } from '../learning/model';
import type {
  SpaceAction,
  SpaceStateContext,
} from '../space/spaceStateRepository';
import { isValidRfc3339Timestamp } from '../space/spaceStateRepository';
import type { ProgressSyncContext } from './progressSyncRepository';
export type MutationType =
  | 'check_in_daily_progress'
  | 'apply_space_action'
  | 'start_membership_trial'
  | 'refresh_membership';

export type MutationPayloadByType = {
  refresh_membership: {
    context: MembershipRepositoryContext;
  };
  start_membership_trial: {
    context: MembershipRepositoryContext;
    currentState: MembershipState;
  };
  check_in_daily_progress: {
    context: ProgressSyncContext;
    dayKey: string;
  };
  apply_space_action: {
    action: SpaceAction;
    contentVersion: string | null;
    context: SpaceStateContext;
    track: LearningTrack | null;
  };
};

export type MutationQueueEntry = {
  [Type in MutationType]: {
    id: string;
    payload: MutationPayloadByType[Type];
    retryCount: number;
    timestamp: string;
    type: Type;
  };
}[MutationType];

export type MutationQueueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const MUTATION_QUEUE_KEY = '__softbook_mutation_queue';
export const MAX_MUTATION_RETRIES = 5;

export function createInMemoryMutationQueueStorage(
  seed: Record<string, string> = {},
): MutationQueueStorage {
  const store = seed;

  return {
    getItem: async key => store[key] ?? null,
    setItem: async (key, value) => {
      store[key] = value;
    },
  };
}

export function createReactNativeMutationQueueStorage(): MutationQueueStorage {
  return {
    getItem: key => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
  };
}

export class MutationQueueManager {
  private readonly key: string;
  private readonly now: () => string;
  private readonly storage: MutationQueueStorage;
  private entries: MutationQueueEntry[] = [];
  private readonly hydrationPromise: Promise<void>;
  private operationTail: Promise<void> = Promise.resolve();

  constructor(
    options: {
      key?: string;
      now?: () => string;
      storage?: MutationQueueStorage;
    } = {},
  ) {
    this.key = options.key ?? MUTATION_QUEUE_KEY;
    this.now = options.now ?? (() => new Date().toISOString());
    this.storage = options.storage ?? createReactNativeMutationQueueStorage();
    this.hydrationPromise = this.load();
  }

  private async load(): Promise<void> {
    try {
      const stored = await this.storage.getItem(this.key);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      this.entries = sanitizeMutationEntries(parsed);

      if (stored && stored !== JSON.stringify(this.entries)) {
        await this.storage.setItem(this.key, JSON.stringify(this.entries));
      }
    } catch (error) {
      console.warn('[MutationQueue] Failed to load persisted entries.', error);
      this.entries = [];
    }
  }

  async hydrate(): Promise<void> {
    await this.hydrationPromise;
  }

  enqueue<Type extends MutationType>(
    type: Type,
    payload: MutationPayloadByType[Type],
    id?: string,
  ): Promise<MutationQueueEntry> {
    return this.runExclusive(async () => {
      const sanitizedPayload = sanitizeMutationPayload(type, payload);
      const entry = {
        id: sanitizeMutationId(
          type,
          id ?? `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          sanitizedPayload,
        ),
        payload: sanitizedPayload,
        retryCount: 0,
        timestamp: this.now(),
        type,
      } as MutationQueueEntry;
      const candidate = this.entries.map(cloneMutationEntry);
      const existingIndex = candidate.findIndex(
        currentEntry => currentEntry.id === entry.id,
      );

      if (existingIndex >= 0) {
        if (type === 'apply_space_action') {
          const existing = candidate[existingIndex];

          if (
            JSON.stringify(existing.payload) !== JSON.stringify(entry.payload)
          ) {
            throw new Error(
              'Space action ID cannot be reused with different content.',
            );
          }

          return cloneMutationEntry(existing);
        }

        candidate[existingIndex] = entry;
      } else {
        candidate.push(entry);
      }

      await this.persistCandidate(candidate);
      return cloneMutationEntry(entry);
    });
  }

  dequeue(): Promise<MutationQueueEntry | undefined> {
    return this.runExclusive(async () => {
      const entry = this.entries[0];

      if (entry) {
        await this.persistCandidate(this.entries.slice(1));
      }

      return entry ? cloneMutationEntry(entry) : undefined;
    });
  }

  removeIfUnchanged(expected: MutationQueueEntry): Promise<boolean> {
    return this.runExclusive(async () => {
      const entry = this.entries[0];

      if (!entry || !areMutationEntriesEqual(entry, expected)) {
        return false;
      }

      await this.persistCandidate(this.entries.slice(1));
      return true;
    });
  }

  peek(): Promise<MutationQueueEntry | undefined> {
    return this.runExclusive(async () => {
      const entry = this.entries[0];
      return entry ? cloneMutationEntry(entry) : undefined;
    });
  }

  incrementRetry(id: string): Promise<void> {
    return this.runExclusive(async () => {
      const candidate = this.entries.map(cloneMutationEntry);
      const entry = candidate.find(currentEntry => currentEntry.id === id);

      if (!entry) {
        return;
      }

      entry.retryCount += 1;
      await this.persistCandidate(candidate);

      if (entry.retryCount === MAX_MUTATION_RETRIES) {
        console.warn(
          `[MutationQueue] Mutation ${id} reached retry threshold; keeping it queued until remote ack.`,
        );
      }
    });
  }

  incrementRetryIfUnchanged(expected: MutationQueueEntry): Promise<boolean> {
    return this.runExclusive(async () => {
      const entry = this.entries[0];

      if (!entry || !areMutationEntriesEqual(entry, expected)) {
        return false;
      }

      const candidate = this.entries.map(cloneMutationEntry);
      candidate[0].retryCount += 1;
      await this.persistCandidate(candidate);

      if (candidate[0].retryCount === MAX_MUTATION_RETRIES) {
        console.warn(
          `[MutationQueue] Mutation ${candidate[0].id} reached retry threshold; keeping it queued until remote ack.`,
        );
      }
      return true;
    });
  }

  clear(): Promise<void> {
    return this.runExclusive(() => this.persistCandidate([]));
  }

  size(): Promise<number> {
    return this.runExclusive(async () => this.entries.length);
  }

  getAll(): Promise<MutationQueueEntry[]> {
    return this.runExclusive(async () => this.entries.map(cloneMutationEntry));
  }

  private runExclusive<Result>(
    operation: () => Promise<Result>,
  ): Promise<Result> {
    const result = this.operationTail
      .then(() => this.hydrationPromise)
      .then(operation);

    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async persistCandidate(candidate: MutationQueueEntry[]) {
    await this.storage.setItem(this.key, JSON.stringify(candidate));
    this.entries = candidate;
  }
}

function areMutationEntriesEqual(
  left: MutationQueueEntry,
  right: MutationQueueEntry,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sanitizeMutationEntries(value: unknown): MutationQueueEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(entry => {
    if (
      !isObject(entry) ||
      typeof entry.id !== 'string' ||
      entry.id.length === 0 ||
      typeof entry.timestamp !== 'string' ||
      !Number.isInteger(entry.retryCount) ||
      (entry.retryCount as number) < 0 ||
      !isObject(entry.payload)
    ) {
      return [];
    }

    if (entry.type === 'sync_daily_progress') {
      const migrated = migrateLegacyDailyProgressEntry(entry);
      return migrated === null ? [] : [migrated];
    }

    if (entry.type === 'sync_space_state') {
      return migrateLegacySpaceStateEntry(entry);
    }

    if (!isMutationType(entry.type)) {
      return [];
    }

    try {
      const payload = sanitizeMutationPayload(entry.type, entry.payload);
      return [
        {
          id: sanitizeMutationId(entry.type, entry.id, payload),
          payload,
          retryCount: entry.retryCount,
          timestamp: entry.timestamp,
          type: entry.type,
        } as MutationQueueEntry,
      ];
    } catch {
      return [];
    }
  });
}

function sanitizeMutationId(
  type: MutationType,
  id: string,
  payload: MutationPayloadByType[MutationType],
): string {
  if (type === 'check_in_daily_progress') {
    const checkInPayload =
      payload as MutationPayloadByType['check_in_daily_progress'];
    return `check-in:${checkInPayload.context.phoneNumber}:${checkInPayload.dayKey}`;
  }

  if (type === 'apply_space_action') {
    const actionPayload =
      payload as MutationPayloadByType['apply_space_action'];
    return `space-action:${actionPayload.context.phoneNumber}:${actionPayload.action.actionId}`;
  }

  if (type === 'refresh_membership') {
    return id === 'membership:restore' ||
      id === 'membership:login' ||
      id === 'membership:mine'
      ? id
      : 'membership:replay';
  }

  if (type === 'start_membership_trial') {
    return id === 'membership-trial:start' ? id : 'membership-trial:replay';
  }

  return id;
}

function sanitizeMutationPayload<Type extends MutationType>(
  type: Type,
  payload: unknown,
): MutationPayloadByType[Type] {
  if (!isObject(payload) || !isObject(payload.context)) {
    throw new Error(`Mutation ${type} requires an account context.`);
  }

  const phoneNumber = payload.context.phoneNumber;

  if (typeof phoneNumber !== 'string' || !/^\d{11}$/.test(phoneNumber)) {
    throw new Error(`Mutation ${type} requires an 11-digit phone number.`);
  }

  const context = { phoneNumber };

  switch (type) {
    case 'refresh_membership':
      return { context } as MutationPayloadByType[Type];
    case 'start_membership_trial':
      if (!isObject(payload.currentState)) {
        throw new Error('Membership trial mutation requires currentState.');
      }

      return {
        context,
        currentState: cloneCredentialFreeObject(payload.currentState),
      } as MutationPayloadByType[Type];
    case 'check_in_daily_progress':
      if (
        typeof payload.dayKey !== 'string' ||
        !isValidDayKey(payload.dayKey)
      ) {
        throw new Error(
          'Daily check-in mutation requires a valid YYYY-MM-DD dayKey.',
        );
      }

      return {
        context,
        dayKey: payload.dayKey,
      } as MutationPayloadByType[Type];
    case 'apply_space_action': {
      const track = sanitizeOptionalTrack(payload.track);
      const contentVersion = sanitizeOptionalContentVersion(
        payload.contentVersion,
      );

      if ((track === null) !== (contentVersion === null)) {
        throw new Error(
          'Space action mutation scope must be complete or legacy-unbound.',
        );
      }

      return {
        action: sanitizeSpaceAction(payload.action),
        contentVersion,
        context,
        track,
      } as MutationPayloadByType[Type];
    }
  }
}

function cloneMutationEntry(entry: MutationQueueEntry): MutationQueueEntry {
  return JSON.parse(JSON.stringify(entry)) as MutationQueueEntry;
}

function cloneCredentialFreeObject(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const cloned: unknown = JSON.parse(JSON.stringify(value));

  if (!isObject(cloned)) {
    throw new Error('Mutation payload must be a JSON object.');
  }

  assertNoCredentialFields(cloned);
  return cloned;
}

function assertNoCredentialFields(value: unknown) {
  if (Array.isArray(value)) {
    value.forEach(assertNoCredentialFields);
    return;
  }

  if (!isObject(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (
      key === 'authToken' ||
      key === 'auth_token' ||
      key === 'accessToken' ||
      key === 'access_token' ||
      key === 'refreshToken' ||
      key === 'refresh_token'
    ) {
      throw new Error(
        'Mutation payload contains a forbidden credential field.',
      );
    }

    assertNoCredentialFields(nestedValue);
  }
}

function isMutationType(value: unknown): value is MutationType {
  return (
    value === 'check_in_daily_progress' ||
    value === 'apply_space_action' ||
    value === 'refresh_membership' ||
    value === 'start_membership_trial'
  );
}

function migrateLegacyDailyProgressEntry(
  entry: Record<string, unknown>,
): MutationQueueEntry | null {
  if (
    !isObject(entry.payload) ||
    !isObject(entry.payload.context) ||
    typeof entry.payload.context.phoneNumber !== 'string' ||
    !/^\d{11}$/.test(entry.payload.context.phoneNumber) ||
    !isValidLegacyDailyProgressSnapshot(entry.payload.snapshot)
  ) {
    return null;
  }

  const phoneNumber = entry.payload.context.phoneNumber;
  const dayKey = entry.payload.snapshot.dayKey;

  return {
    id: `check-in:${phoneNumber}:${dayKey}`,
    payload: {
      context: { phoneNumber },
      dayKey,
    },
    retryCount: entry.retryCount as number,
    timestamp: entry.timestamp as string,
    type: 'check_in_daily_progress',
  };
}

function migrateLegacySpaceStateEntry(
  entry: Record<string, unknown>,
): MutationQueueEntry[] {
  if (
    !isObject(entry.payload) ||
    !isObject(entry.payload.context) ||
    typeof entry.payload.context.phoneNumber !== 'string' ||
    !/^\d{11}$/.test(entry.payload.context.phoneNumber) ||
    !isValidLegacySpaceStateSnapshot(entry.payload.snapshot)
  ) {
    return [];
  }

  const phoneNumber = entry.payload.context.phoneNumber;
  const snapshot = entry.payload.snapshot;

  return snapshot.states.flatMap((state, index) =>
    (['favorite', 'sleep'] as const).map(dimension => {
      const actionId = createLegacySpaceActionId({
        cardId: state.cardId,
        dimension,
        entryId: entry.id as string,
        index,
        timestamp: state.lastModifiedAt,
        value: dimension === 'favorite' ? state.isFavorited : state.isSleeping,
      });
      const action: SpaceAction = {
        actionId,
        cardId: state.cardId,
        clientOccurredAt: state.lastModifiedAt,
        dimension,
        value: dimension === 'favorite' ? state.isFavorited : state.isSleeping,
      };

      return {
        id: `space-action:${phoneNumber}:${actionId}`,
        payload: {
          action,
          contentVersion: null,
          context: { phoneNumber },
          track: null,
        },
        retryCount: entry.retryCount as number,
        timestamp: entry.timestamp as string,
        type: 'apply_space_action',
      };
    }),
  );
}

function isValidLegacySpaceStateSnapshot(value: unknown): value is {
  dayKey: string;
  states: Array<{
    cardId: string;
    isFavorited: boolean;
    isSleeping: boolean;
    lastModifiedAt: string;
  }>;
} {
  if (
    !isObject(value) ||
    typeof value.dayKey !== 'string' ||
    !isValidDayKey(value.dayKey) ||
    !Array.isArray(value.states)
  ) {
    return false;
  }

  const seenCardIds = new Set<string>();

  return value.states.every(state => {
    if (
      !isObject(state) ||
      typeof state.cardId !== 'string' ||
      !/^[0-9A-Za-z][0-9A-Za-z._:-]{0,127}$/.test(state.cardId) ||
      seenCardIds.has(state.cardId) ||
      typeof state.isFavorited !== 'boolean' ||
      typeof state.isSleeping !== 'boolean' ||
      typeof state.lastModifiedAt !== 'string' ||
      !isValidRfc3339Timestamp(state.lastModifiedAt)
    ) {
      return false;
    }

    seenCardIds.add(state.cardId);
    return true;
  });
}

function createLegacySpaceActionId(input: {
  cardId: string;
  dimension: 'favorite' | 'sleep';
  entryId: string;
  index: number;
  timestamp: string;
  value: boolean;
}) {
  const seed = JSON.stringify(input);
  return `legacy_${stableHash(seed)}_${stableHash(`v2:${seed}`)}`;
}

function stableHash(value: string) {
  const modulus = 2 ** 32;
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % modulus;
  }

  return hash.toString(16).padStart(8, '0');
}

function sanitizeSpaceAction(value: unknown): SpaceAction {
  if (!isObject(value)) {
    throw new Error('Space action mutation requires an action object.');
  }

  const keys = Object.keys(value).sort();
  const expectedKeys = [
    'actionId',
    'cardId',
    'clientOccurredAt',
    'dimension',
    'value',
  ];

  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error('Space action mutation has unexpected action fields.');
  }

  if (
    typeof value.actionId !== 'string' ||
    !/^[0-9A-Za-z][0-9A-Za-z._:-]{0,127}$/.test(value.actionId) ||
    typeof value.cardId !== 'string' ||
    !/^[0-9A-Za-z][0-9A-Za-z._:-]{0,127}$/.test(value.cardId) ||
    typeof value.clientOccurredAt !== 'string' ||
    !isValidRfc3339Timestamp(value.clientOccurredAt) ||
    (value.dimension !== 'favorite' && value.dimension !== 'sleep') ||
    typeof value.value !== 'boolean'
  ) {
    throw new Error('Space action mutation contains an invalid action.');
  }

  return {
    actionId: value.actionId,
    cardId: value.cardId,
    clientOccurredAt: new Date(value.clientOccurredAt).toISOString(),
    dimension: value.dimension,
    value: value.value,
  };
}

function sanitizeOptionalTrack(value: unknown): LearningTrack | null {
  if (value === null) {
    return null;
  }

  if (value !== 'cet4' && value !== 'cet6') {
    throw new Error('Space action mutation track must be cet4 or cet6.');
  }

  return value;
}

function sanitizeOptionalContentVersion(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) {
    throw new Error(
      'Space action mutation contentVersion must be a SHA-256 identifier.',
    );
  }

  return value;
}

function isValidLegacyDailyProgressSnapshot(value: unknown): value is Record<
  string,
  unknown
> & {
  checkedInToday: true;
  dayKey: string;
} {
  if (
    !isObject(value) ||
    value.checkedInToday !== true ||
    typeof value.dayKey !== 'string' ||
    !isValidDayKey(value.dayKey)
  ) {
    return false;
  }

  const counterKeys = [
    'favoriteCount',
    'learningCompletedCount',
    'pendingReviewCount',
    'reviewCompletedCount',
    'sleepingCount',
    'totalCompletedCount',
  ];

  if (
    counterKeys.some(
      key => !Number.isInteger(value[key]) || (value[key] as number) < 0,
    )
  ) {
    return false;
  }

  return (
    value.totalCompletedCount ===
    (value.learningCompletedCount as number) +
      (value.reviewCompletedCount as number)
  );
}

function isValidDayKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
