import type { MembershipRepository } from '../membership/membershipRepository';
import type { MembershipState } from '../membership/localMembership';
import type {
  SpaceAction,
  SpaceActionAck,
  SpaceStateRepository,
} from '../space/spaceStateRepository';
import {
  MutationQueueManager,
  MutationPayloadByType,
  MutationQueueEntry,
  MutationType,
} from './mutationQueue';
import type { ProgressSyncRepository } from './progressSyncRepository';
import { isRemoteAuthorizationError } from '../runtime/remoteHttpError';
import { isRemoteRequestCancellationError } from '../runtime/remoteRequest';

export type MutationReplayResult =
  | {
      entry: Exclude<
        MutationQueueEntry,
        {
          type:
            | 'refresh_membership'
            | 'start_membership_trial'
            | 'apply_space_action';
        }
      >;
    }
  | {
      entry: Extract<MutationQueueEntry, { type: 'apply_space_action' }>;
      spaceActionAck: SpaceActionAck;
    }
  | {
      entry: Extract<
        MutationQueueEntry,
        { type: 'refresh_membership' | 'start_membership_trial' }
      >;
      membershipState: MembershipState;
    };

export type MutationReplayContext = {
  authToken?: string;
  contentVersion?: string;
  dayKey?: string;
  phoneNumber: string;
  track?: 'cet4' | 'cet6';
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
  hasPendingCheckIn(phoneNumber: string, dayKey: string): Promise<boolean>;
  getPendingSpaceActions(
    phoneNumber: string,
    scope?: { contentVersion: string; track: 'cet4' | 'cet6' },
  ): Promise<SpaceAction[]>;
  clear(): Promise<void>;
}

export function createMutationQueueRepository(options: {
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
        case 'check_in_daily_progress':
          await options.progressSyncRepository.checkIn(
            entry.payload.context,
            entry.payload.dayKey,
          );
          return { entry };
        case 'apply_space_action':
          if (
            entry.payload.contentVersion === null ||
            entry.payload.track === null ||
            !entry.payload.context.authToken
          ) {
            throw new Error(
              'Space action replay requires authenticated content scope.',
            );
          }

          return {
            entry,
            spaceActionAck: await options.spaceStateRepository.applyActions(
              entry.payload.context,
              {
                actions: [entry.payload.action],
                contentVersion: entry.payload.contentVersion,
                track: entry.payload.track,
              },
              requireReplayDayKey(entry),
            ),
          };
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
      if (
        isRemoteAuthorizationError(error) ||
        isRemoteRequestCancellationError(error)
      ) {
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
            await queue.removeIfUnchanged(entry);
            continue;
          }

          const replayEntry = context
            ? withReplayContext(entry, context)
            : entry;
          const replayResult = await replayMutation(replayEntry);

          if (replayResult) {
            if (await queue.removeIfUnchanged(entry)) {
              replayedResults.push(replayResult);
            }
            continue;
          }

          if (await queue.incrementRetryIfUnchanged(entry)) {
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

    async hasPendingCheckIn(phoneNumber, dayKey) {
      await queue.hydrate();
      const entries = await queue.getAll();

      return entries.some(
        entry =>
          entry.type === 'check_in_daily_progress' &&
          entry.payload.context.phoneNumber === phoneNumber &&
          entry.payload.dayKey === dayKey,
      );
    },

    async getPendingSpaceActions(phoneNumber, scope) {
      await queue.hydrate();
      const entries = await queue.getAll();

      return entries.flatMap(entry => {
        if (
          entry.type !== 'apply_space_action' ||
          entry.payload.context.phoneNumber !== phoneNumber ||
          (scope !== undefined &&
            entry.payload.track !== null &&
            entry.payload.track !== scope.track)
        ) {
          return [];
        }

        return [entry.payload.action];
      });
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
  if (entry.type === 'apply_space_action') {
    const replayingCurrentTrack =
      entry.payload.track === null || entry.payload.track === context.track;

    return {
      ...entry,
      payload: {
        ...entry.payload,
        contentVersion:
          replayingCurrentTrack && context.contentVersion !== undefined
            ? context.contentVersion
            : entry.payload.contentVersion,
        context: {
          authToken: context.authToken,
          dayKey: context.dayKey,
          phoneNumber: context.phoneNumber,
        },
        track:
          replayingCurrentTrack && context.track !== undefined
            ? context.track
            : entry.payload.track,
      },
    };
  }

  return {
    ...entry,
    payload: {
      ...entry.payload,
      context,
    },
  } as MutationQueueEntry;
}

function requireReplayDayKey(
  entry: Extract<MutationQueueEntry, { type: 'apply_space_action' }>,
) {
  const dayKey = entry.payload.context.dayKey;

  if (typeof dayKey !== 'string') {
    throw new Error('Space action replay requires a current day key.');
  }

  return dayKey;
}
