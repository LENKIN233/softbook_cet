import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  LearningPilotRoundCompletion,
  LearningTrack,
} from '../learning/model';
import type { SpaceCardStateValue } from '../space/spaceStateRepository';

export type PersistedSpaceCardState = SpaceCardStateValue;

export type PersistedLearningCursor = {
  cardId: string;
  sourceId: string;
  track: LearningTrack;
};

export type PersistedUserState = {
  checkedInDayKey: string | null;
  learningCursor: PersistedLearningCursor | null;
  pilotRoundCompletion:
    | (LearningPilotRoundCompletion & {
        contentVersion: string;
        track: LearningTrack;
      })
    | null;
  presentedTrialStartedAt: string | null;
  spaceCardStateById: Record<string, PersistedSpaceCardState>;
};

export type UserStateStorage = {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type UserStateStore = {
  clear: () => Promise<void>;
  load: (phoneNumber: string) => Promise<PersistedUserState>;
  save: (phoneNumber: string, state: PersistedUserState) => Promise<void>;
};

export const USER_STATE_STORAGE_KEY = 'softbook-cet/user-state/v1';
const USER_STATE_SCHEMA_VERSION = 'user-state.v4';
const LEGACY_USER_STATE_SCHEMA_V3 = 'user-state.v3';
const LEGACY_USER_STATE_SCHEMA_V2 = 'user-state.v2';
const LEGACY_USER_STATE_SCHEMA_VERSION = 'user-state.v1';
export const LEGACY_SPACE_STATE_TIMESTAMP = '1970-01-01T00:00:00.000Z';

type UserStatePayload = {
  checked_in_day_key: string | null;
  learning_cursor: {
    card_id: string;
    source_id: string;
    track: LearningTrack;
  } | null;
  owner_phone_number: string;
  pilot_round_completion: {
    completed_count: number;
    content_version: string;
    receipt_id: string;
    review_card_ids: string[];
    schema_version: 'pilot-round-completion.v1';
    track: LearningTrack;
  } | null;
  presented_trial_started_at: string | null;
  schema_version: typeof USER_STATE_SCHEMA_VERSION;
  space_card_state_by_id: Record<
    string,
    {
      is_favorited: boolean;
      is_sleeping: boolean;
      last_modified_at: string;
    }
  >;
};

export function createEmptyPersistedUserState(): PersistedUserState {
  return {
    checkedInDayKey: null,
    learningCursor: null,
    pilotRoundCompletion: null,
    presentedTrialStartedAt: null,
    spaceCardStateById: {},
  };
}

export function createUserStateStore(
  storage: UserStateStorage = AsyncStorage,
): UserStateStore {
  let writePromise = Promise.resolve();
  let automaticWritesEnabled = true;

  const enqueueWrite = (operation: () => Promise<void>) => {
    writePromise = writePromise.then(operation, operation);
    return writePromise;
  };

  return {
    clear() {
      return enqueueWrite(() => storage.removeItem(USER_STATE_STORAGE_KEY));
    },

    async load(phoneNumber) {
      await writePromise;
      assertPhoneNumber(phoneNumber);
      let rawValue: string | null;

      try {
        rawValue = await storage.getItem(USER_STATE_STORAGE_KEY);
        automaticWritesEnabled = true;
      } catch (error) {
        automaticWritesEnabled = false;
        console.warn('[UserStateStore] Failed to read user state.', error);
        return createEmptyPersistedUserState();
      }

      if (rawValue === null) {
        return createEmptyPersistedUserState();
      }

      try {
        const payload = parseUserStatePayload(JSON.parse(rawValue));

        if (payload.ownerPhoneNumber !== phoneNumber) {
          return createEmptyPersistedUserState();
        }

        return payload.state;
      } catch (error) {
        console.warn('[UserStateStore] Discarding invalid user state.', error);

        try {
          await enqueueWrite(() => storage.removeItem(USER_STATE_STORAGE_KEY));
        } catch (clearError) {
          console.warn(
            '[UserStateStore] Failed to clear invalid user state.',
            clearError,
          );
        }

        return createEmptyPersistedUserState();
      }
    },

    save(phoneNumber, state) {
      assertPhoneNumber(phoneNumber);

      if (!automaticWritesEnabled) {
        return Promise.resolve();
      }

      const payload = serializeUserStatePayload(phoneNumber, state);

      return enqueueWrite(() =>
        storage.setItem(USER_STATE_STORAGE_KEY, JSON.stringify(payload)),
      );
    },
  };
}

function serializeUserStatePayload(
  phoneNumber: string,
  state: PersistedUserState,
): UserStatePayload {
  assertCheckedInDayKey(state.checkedInDayKey);
  const learningCursor = parseLearningCursor(state.learningCursor);
  const pilotRoundCompletion = parsePilotRoundCompletion(
    state.pilotRoundCompletion,
  );
  const presentedTrialStartedAt = parseOptionalCanonicalTimestamp(
    state.presentedTrialStartedAt,
    'presented trial start',
  );
  const spaceCardStateById = parseSpaceCardStateMap(state.spaceCardStateById);

  return {
    checked_in_day_key: state.checkedInDayKey,
    learning_cursor: learningCursor
      ? {
          card_id: learningCursor.cardId,
          source_id: learningCursor.sourceId,
          track: learningCursor.track,
        }
      : null,
    owner_phone_number: phoneNumber,
    pilot_round_completion: pilotRoundCompletion
      ? {
          completed_count: pilotRoundCompletion.completedCount,
          content_version: pilotRoundCompletion.contentVersion,
          receipt_id: pilotRoundCompletion.receiptId,
          review_card_ids: pilotRoundCompletion.reviewCardIds,
          schema_version: 'pilot-round-completion.v1',
          track: pilotRoundCompletion.track,
        }
      : null,
    presented_trial_started_at: presentedTrialStartedAt,
    schema_version: USER_STATE_SCHEMA_VERSION,
    space_card_state_by_id: Object.fromEntries(
      Object.entries(spaceCardStateById).map(([cardId, cardState]) => [
        cardId,
        {
          is_favorited: cardState.isFavorited,
          is_sleeping: cardState.isSleeping,
          last_modified_at: cardState.lastModifiedAt,
        },
      ]),
    ),
  };
}

function parseUserStatePayload(payload: unknown): {
  ownerPhoneNumber: string;
  state: PersistedUserState;
} {
  if (
    !isObject(payload) ||
    (payload.schema_version !== USER_STATE_SCHEMA_VERSION &&
      payload.schema_version !== LEGACY_USER_STATE_SCHEMA_V3 &&
      payload.schema_version !== LEGACY_USER_STATE_SCHEMA_V2 &&
      payload.schema_version !== LEGACY_USER_STATE_SCHEMA_VERSION)
  ) {
    throw new Error('User state payload version is invalid.');
  }

  assertPhoneNumber(payload.owner_phone_number);
  assertCheckedInDayKey(payload.checked_in_day_key);

  return {
    ownerPhoneNumber: payload.owner_phone_number,
    state: {
      checkedInDayKey: payload.checked_in_day_key,
      learningCursor: parseLearningCursorPayload(payload.learning_cursor),
      pilotRoundCompletion:
        payload.schema_version === USER_STATE_SCHEMA_VERSION
          ? parsePilotRoundCompletionPayload(payload.pilot_round_completion)
          : payload.schema_version === LEGACY_USER_STATE_SCHEMA_V3
          ? parseLegacyPilotRoundCompletionPayload(
              payload.pilot_round_completion,
            )
          : null,
      presentedTrialStartedAt:
        payload.schema_version === USER_STATE_SCHEMA_VERSION ||
        payload.schema_version === LEGACY_USER_STATE_SCHEMA_V3
          ? parseOptionalCanonicalTimestamp(
              payload.presented_trial_started_at,
              'persisted presented trial start',
            )
          : null,
      spaceCardStateById: parseSpaceCardStatePayload(
        payload.space_card_state_by_id,
        payload.schema_version === LEGACY_USER_STATE_SCHEMA_VERSION,
      ),
    },
  };
}

function parsePilotRoundCompletion(
  value: unknown,
): PersistedUserState['pilotRoundCompletion'] {
  if (value === null) return null;
  if (!isObject(value)) {
    throw new Error('Pilot round completion must be an object or null.');
  }
  const completion = {
    completedCount: value.completedCount,
    contentVersion: value.contentVersion,
    receiptId: value.receiptId,
    reviewCardIds: value.reviewCardIds,
    schemaVersion: value.schemaVersion,
    track: value.track,
  };
  assertPilotRoundCompletion(completion);
  return completion;
}

function parsePilotRoundCompletionPayload(
  value: unknown,
): PersistedUserState['pilotRoundCompletion'] {
  if (value === null) return null;
  if (!isObject(value)) {
    throw new Error(
      'Persisted pilot round completion must be an object or null.',
    );
  }
  const completion = {
    completedCount: value.completed_count,
    contentVersion: value.content_version,
    receiptId: value.receipt_id,
    reviewCardIds: value.review_card_ids,
    schemaVersion: value.schema_version,
    track: value.track,
  };
  assertPilotRoundCompletion(completion);
  return completion;
}

function parseLegacyPilotRoundCompletionPayload(
  value: unknown,
): PersistedUserState['pilotRoundCompletion'] {
  if (value === null) return null;
  if (!isObject(value)) {
    throw new Error(
      'Legacy persisted pilot round completion must be an object or null.',
    );
  }
  const completion = {
    completedCount: value.completed_count,
    contentVersion: value.content_version,
    receiptId: value.receipt_id,
    reviewCardIds: [],
    schemaVersion: value.schema_version,
    track: value.track,
  };
  assertPilotRoundCompletion(completion);
  return completion;
}

function assertPilotRoundCompletion(value: {
  completedCount: unknown;
  contentVersion: unknown;
  receiptId: unknown;
  reviewCardIds: unknown;
  schemaVersion: unknown;
  track: unknown;
}): asserts value is NonNullable<PersistedUserState['pilotRoundCompletion']> {
  if (
    value.schemaVersion !== 'pilot-round-completion.v1' ||
    !Number.isSafeInteger(value.completedCount) ||
    (value.completedCount as number) <= 0 ||
    (value.completedCount as number) % 5 !== 0 ||
    typeof value.contentVersion !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/.test(value.contentVersion) ||
    typeof value.receiptId !== 'string' ||
    !/^rnd_[A-Za-z0-9_-]{32,64}$/.test(value.receiptId) ||
    !Array.isArray(value.reviewCardIds) ||
    value.reviewCardIds.some(
      cardId => typeof cardId !== 'string' || !/^\d{6}$/.test(cardId),
    ) ||
    new Set(value.reviewCardIds).size !== value.reviewCardIds.length
  ) {
    throw new Error('Pilot round completion is invalid.');
  }
  assertLearningTrack(value.track);
}

function parseOptionalCanonicalTimestamp(
  value: unknown,
  label: string,
): string | null {
  if (value === null) return null;
  if (
    typeof value !== 'string' ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new Error(`${label} must be a canonical timestamp or null.`);
  }
  return value;
}

function parseLearningCursor(value: unknown): PersistedLearningCursor | null {
  if (value === null) {
    return null;
  }

  if (!isObject(value)) {
    throw new Error('Learning cursor must be an object or null.');
  }

  const { cardId, sourceId, track } = value;
  assertNonEmptyString(cardId, 'learning cursor cardId');
  assertNonEmptyString(sourceId, 'learning cursor sourceId');
  assertLearningTrack(track);

  return { cardId, sourceId, track };
}

function parseLearningCursorPayload(
  value: unknown,
): PersistedLearningCursor | null {
  if (value === null) {
    return null;
  }

  if (!isObject(value)) {
    throw new Error('Persisted learning cursor must be an object or null.');
  }

  const { card_id: cardId, source_id: sourceId, track } = value;
  assertNonEmptyString(cardId, 'persisted learning cursor card_id');
  assertNonEmptyString(sourceId, 'persisted learning cursor source_id');
  assertLearningTrack(track);

  return { cardId, sourceId, track };
}

function parseSpaceCardStateMap(
  value: unknown,
): Record<string, PersistedSpaceCardState> {
  if (!isObject(value)) {
    throw new Error('Space card state map must be an object.');
  }

  const parsed: Record<string, PersistedSpaceCardState> = {};

  for (const [cardId, cardState] of Object.entries(value)) {
    assertNonEmptyString(cardId, 'space card id');

    if (
      !isObject(cardState) ||
      typeof cardState.isFavorited !== 'boolean' ||
      typeof cardState.isSleeping !== 'boolean' ||
      typeof cardState.lastModifiedAt !== 'string' ||
      Number.isNaN(Date.parse(cardState.lastModifiedAt))
    ) {
      throw new Error(`Space card state ${cardId} is invalid.`);
    }

    parsed[cardId] = {
      isFavorited: cardState.isFavorited,
      isSleeping: cardState.isSleeping,
      lastModifiedAt: cardState.lastModifiedAt,
    };
  }

  return parsed;
}

function parseSpaceCardStatePayload(
  value: unknown,
  isLegacy: boolean,
): Record<string, PersistedSpaceCardState> {
  if (!isObject(value)) {
    throw new Error('Persisted space card state map must be an object.');
  }

  const parsed: Record<string, PersistedSpaceCardState> = {};

  for (const [cardId, cardState] of Object.entries(value)) {
    assertNonEmptyString(cardId, 'persisted space card id');

    if (
      !isObject(cardState) ||
      typeof cardState.is_favorited !== 'boolean' ||
      typeof cardState.is_sleeping !== 'boolean' ||
      (!isLegacy &&
        (typeof cardState.last_modified_at !== 'string' ||
          Number.isNaN(Date.parse(cardState.last_modified_at))))
    ) {
      throw new Error(`Persisted space card state ${cardId} is invalid.`);
    }

    parsed[cardId] = {
      isFavorited: cardState.is_favorited,
      isSleeping: cardState.is_sleeping,
      lastModifiedAt: isLegacy
        ? LEGACY_SPACE_STATE_TIMESTAMP
        : (cardState.last_modified_at as string),
    };
  }

  return parsed;
}

function assertPhoneNumber(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^\d{11}$/.test(value)) {
    throw new Error('User state phone number must contain 11 digits.');
  }
}

function assertCheckedInDayKey(value: unknown): asserts value is string | null {
  if (
    value !== null &&
    (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
  ) {
    throw new Error('User state check-in day key must use YYYY-MM-DD or null.');
  }
}

function assertLearningTrack(value: unknown): asserts value is LearningTrack {
  if (value !== 'cet4' && value !== 'cet6') {
    throw new Error('Learning cursor track must be cet4 or cet6.');
  }
}

function assertNonEmptyString(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
