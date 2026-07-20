import AsyncStorage from '@react-native-async-storage/async-storage';

import type {MembershipState} from '../membership/localMembership';
import type {MembershipRepositoryContext} from '../membership/membershipRepository';
import type {
  SpaceStateContext,
  SpaceStateSnapshot,
} from '../space/spaceStateRepository';
import type {
  DailyProgressSnapshot,
  ProgressSyncContext,
} from './progressSyncRepository';
import type {
  LearningStateContext,
  LearningStateSnapshot,
} from './learningStateRepository';

export type MutationType =
  | 'sync_daily_progress'
  | 'sync_space_state'
  | 'sync_learning_state'
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
  sync_daily_progress: {
    context: ProgressSyncContext;
    snapshot: DailyProgressSnapshot;
  };
  sync_space_state: {
    context: SpaceStateContext;
    snapshot: SpaceStateSnapshot;
  };
  sync_learning_state: {
    context: LearningStateContext;
    snapshot: LearningStateSnapshot;
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
  private persistPromise: Promise<void> = Promise.resolve();

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

  private async save(): Promise<void> {
    this.persistPromise = this.persistPromise
      .then(() => this.storage.setItem(this.key, JSON.stringify(this.entries)))
      .catch(error => {
        console.warn('[MutationQueue] Failed to persist entries.', error);
      });

    await this.persistPromise;
  }

  async hydrate(): Promise<void> {
    await this.hydrationPromise;
  }

  async enqueue<Type extends MutationType>(
    type: Type,
    payload: MutationPayloadByType[Type],
    id?: string,
  ): Promise<MutationQueueEntry> {
    await this.hydrate();

    const entry = {
      id: id ?? `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      payload: sanitizeMutationPayload(type, payload),
      retryCount: 0,
      timestamp: this.now(),
      type,
    } as MutationQueueEntry;

    const existingIndex = this.entries.findIndex(
      currentEntry => currentEntry.id === entry.id,
    );

    if (existingIndex >= 0) {
      this.entries[existingIndex] = entry;
    } else {
      this.entries.push(entry);
    }

    await this.save();
    return cloneMutationEntry(entry);
  }

  async dequeue(): Promise<MutationQueueEntry | undefined> {
    await this.hydrate();
    const entry = this.entries[0];

    if (entry) {
      this.entries.shift();
      await this.save();
    }

    return entry ? cloneMutationEntry(entry) : undefined;
  }

  async peek(): Promise<MutationQueueEntry | undefined> {
    await this.hydrate();
    const entry = this.entries[0];
    return entry ? cloneMutationEntry(entry) : undefined;
  }

  async incrementRetry(id: string): Promise<void> {
    await this.hydrate();
    const entry = this.entries.find(currentEntry => currentEntry.id === id);

    if (!entry) {
      return;
    }

    entry.retryCount += 1;

    if (entry.retryCount === MAX_MUTATION_RETRIES) {
      console.warn(
        `[MutationQueue] Mutation ${id} reached retry threshold; keeping it queued until remote ack.`,
      );
    }

    await this.save();
  }

  async clear(): Promise<void> {
    await this.hydrate();
    this.entries = [];
    await this.save();
  }

  async size(): Promise<number> {
    await this.hydrate();
    return this.entries.length;
  }

  async getAll(): Promise<MutationQueueEntry[]> {
    await this.hydrate();
    return this.entries.map(cloneMutationEntry);
  }
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
      !isMutationType(entry.type) ||
      !isObject(entry.payload)
    ) {
      return [];
    }

    try {
      return [
        {
          id: sanitizePersistedMutationId(entry.type, entry.id),
          payload: sanitizeMutationPayload(entry.type, entry.payload),
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

function sanitizePersistedMutationId(type: MutationType, id: string): string {
  if (type === 'refresh_membership') {
    return id === 'membership:restore' ||
      id === 'membership:login' ||
      id === 'membership:mine'
      ? id
      : 'membership:replay';
  }

  if (type === 'start_membership_trial') {
    return id === 'membership-trial:start'
      ? id
      : 'membership-trial:replay';
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

  const context = {phoneNumber};

  switch (type) {
    case 'refresh_membership':
      return {context} as MutationPayloadByType[Type];
    case 'start_membership_trial':
      if (!isObject(payload.currentState)) {
        throw new Error('Membership trial mutation requires currentState.');
      }

      return {
        context,
        currentState: cloneCredentialFreeObject(payload.currentState),
      } as MutationPayloadByType[Type];
    case 'sync_daily_progress':
    case 'sync_learning_state':
    case 'sync_space_state':
      if (!isObject(payload.snapshot)) {
        throw new Error(`Mutation ${type} requires a snapshot.`);
      }

      return {
        context,
        snapshot: cloneCredentialFreeObject(payload.snapshot),
      } as MutationPayloadByType[Type];
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
    value === 'refresh_membership' ||
    value === 'start_membership_trial' ||
    value === 'sync_daily_progress' ||
    value === 'sync_learning_state' ||
    value === 'sync_space_state'
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
