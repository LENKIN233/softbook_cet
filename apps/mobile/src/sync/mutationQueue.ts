import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  MembershipRepositoryContext,
} from '../membership/membershipRepository';
import type {
  SpaceStateContext,
  SpaceStateSnapshot,
} from '../space/spaceStateRepository';
import type {
  DailyProgressSnapshot,
  ProgressSyncContext,
} from './progressSyncRepository';

export type MutationType =
  | 'sync_daily_progress'
  | 'sync_space_state'
  | 'refresh_membership';

export type MutationPayloadByType = {
  refresh_membership: {
    context: MembershipRepositoryContext;
  };
  sync_daily_progress: {
    context: ProgressSyncContext;
    snapshot: DailyProgressSnapshot;
  };
  sync_space_state: {
    context: SpaceStateContext;
    snapshot: SpaceStateSnapshot;
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

  constructor(options: {
    key?: string;
    now?: () => string;
    storage?: MutationQueueStorage;
  } = {}) {
    this.key = options.key ?? MUTATION_QUEUE_KEY;
    this.now = options.now ?? (() => new Date().toISOString());
    this.storage =
      options.storage ?? createReactNativeMutationQueueStorage();
    this.hydrationPromise = this.load();
  }

  private async load(): Promise<void> {
    try {
      const stored = await this.storage.getItem(this.key);
      this.entries = stored ? (JSON.parse(stored) as MutationQueueEntry[]) : [];
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
      payload,
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
    return entry;
  }

  async dequeue(): Promise<MutationQueueEntry | undefined> {
    await this.hydrate();
    const entry = this.entries[0];

    if (entry) {
      this.entries.shift();
      await this.save();
    }

    return entry;
  }

  async peek(): Promise<MutationQueueEntry | undefined> {
    await this.hydrate();
    return this.entries[0];
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
    return [...this.entries];
  }
}
