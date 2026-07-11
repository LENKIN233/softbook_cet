import type {MembershipRepository} from '../membership/membershipRepository';
import type {MembershipState} from '../membership/localMembership';
import type {
  SpaceStateRepository,
  SpaceStateSnapshot,
} from '../space/spaceStateRepository';
import type {LearningStateRepository} from './learningStateRepository';
import {
  MutationQueueManager,
  MutationPayloadByType,
  MutationQueueEntry,
  MutationType,
} from './mutationQueue';
import type {ProgressSyncRepository} from './progressSyncRepository';
import {isRemoteAuthorizationError} from '../runtime/remoteHttpError';

export type MutationReplayResult =
  | {
      entry: Exclude<
        MutationQueueEntry,
        {
          type:
            | 'refresh_membership'
            | 'start_membership_trial'
            | 'sync_space_state';
        }
      >;
    }
  | {
      entry: Extract<MutationQueueEntry, {type: 'sync_space_state'}>;
      spaceStateSnapshot: SpaceStateSnapshot;
    }
  | {
      entry: Extract<
        MutationQueueEntry,
        {type: 'refresh_membership' | 'start_membership_trial'}
      >;
      membershipState: MembershipState;
    };

export type MutationReplayContext = {
  authToken?: string;
  phoneNumber: string;
};

export interface MutationQueueRepository {
  enqueueMutation<Type extends MutationType>(
    type: Type,
    payload: MutationPayloadByType[Type],
    id?: string,
  ): Promise<MutationQueueEntry>;
  hydrate(): Promise<void>;
  startReplay(context?: MutationReplayContext): Promise<MutationReplayResult[]>;
  isReplaying(): boolean;
  getQueueSize(): Promise<number>;
  clear(): Promise<void>;
}

export function createMutationQueueRepository(options: {
  learningStateRepository: LearningStateRepository;
  membershipRepository: MembershipRepository;
  progressSyncRepository: ProgressSyncRepository;
  queueManager?: MutationQueueManager;
  spaceStateRepository: SpaceStateRepository;
}): MutationQueueRepository {
  const queue = options.queueManager ?? new MutationQueueManager();
  let replaying = false;

  const replayMutation = async (
    entry: MutationQueueEntry,
  ): Promise<MutationReplayResult | null> => {
    try {
      switch (entry.type) {
        case 'sync_daily_progress':
          await options.progressSyncRepository.syncDailyProgress(
            entry.payload.context,
            entry.payload.snapshot,
          );
          return {entry};
        case 'sync_space_state':
          return {
            entry,
            spaceStateSnapshot: (
              await options.spaceStateRepository.syncSpaceState(
                entry.payload.context,
                entry.payload.snapshot,
              )
            ).snapshot,
          };
        case 'sync_learning_state':
          await options.learningStateRepository.syncLearningState(
            entry.payload.context,
            entry.payload.snapshot,
          );
          return {entry};
        case 'refresh_membership':
          return {
            entry,
            membershipState: await options.membershipRepository.loadState(
              entry.payload.context,
            ),
          };
        case 'start_membership_trial':
          return {
            entry,
            membershipState: (
              await options.membershipRepository.startTrial(
                entry.payload.context,
                entry.payload.currentState,
              )
            ).state,
          };
      }
    } catch (error) {
      if (isRemoteAuthorizationError(error)) {
        throw error;
      }

      console.warn(
        `[MutationQueue] Replay failed for ${entry.type}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  };

  return {
    enqueueMutation(type, payload, id) {
      return queue.enqueue(type, payload, id);
    },

    hydrate() {
      return queue.hydrate();
    },

    async startReplay(context) {
      await queue.hydrate();
      const replayedResults: MutationReplayResult[] = [];

      if (replaying || (await queue.size()) === 0) {
        return replayedResults;
      }

      replaying = true;

      try {
        while (true) {
          const entry = await queue.peek();

          if (!entry) {
            break;
          }

          if (context && !isSameReplayContext(context, entry)) {
            console.warn(
              `[MutationQueue] Dropping stale queued mutation ${entry.id} for a different auth context.`,
            );
            await queue.dequeue();
            continue;
          }

          const replayEntry = context
            ? withReplayContext(entry, context)
            : entry;
          const replayResult = await replayMutation(replayEntry);

          if (replayResult) {
            replayedResults.push(replayResult);
            await queue.dequeue();
            continue;
          }

          await queue.incrementRetry(entry.id);

          if ((await queue.peek())?.id === entry.id) {
            break;
          }
        }
      } finally {
        replaying = false;
      }

      return replayedResults;
    },

    isReplaying() {
      return replaying;
    },

    getQueueSize() {
      return queue.size();
    },

    clear() {
      return queue.clear();
    },
  };
}

function isSameReplayContext(
  context: MutationReplayContext,
  entry: MutationQueueEntry,
) {
  const entryContext = entry.payload.context;

  return entryContext.phoneNumber === context.phoneNumber;
}

function withReplayContext(
  entry: MutationQueueEntry,
  context: MutationReplayContext,
): MutationQueueEntry {
  return {
    ...entry,
    payload: {
      ...entry.payload,
      context,
    },
  } as MutationQueueEntry;
}
