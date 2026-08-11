import type { MembershipRepository } from '../membership/membershipRepository';
import type { MembershipState } from '../membership/localMembership';
import type { AccountBootstrapComponentRevisions } from '../bootstrap/accountBootstrapRepository';
import { areAccountBootstrapComponentRevisionsAtLeast } from '../bootstrap/accountBootstrapRevision';
import type {
  SpaceAction,
  SpaceActionAck,
  SpaceStateRepository,
} from '../space/spaceStateRepository';
import {
  AccountBootstrapObservationProof,
  MutationQueueManager,
  MutationPayloadByType,
  MutationQueueEntry,
  MutationQueueTerminalRejection,
  MutationType,
  SpaceCanonicalRefreshBaseline,
} from './mutationQueue';
import type { ProgressSyncRepository } from './progressSyncRepository';
import {
  isRemoteAuthorizationError,
  RemoteHttpError,
} from '../runtime/remoteHttpError';
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
      entry: Extract<MutationQueueEntry, { type: 'apply_space_action' }>;
      canonicalRefreshRequired: SpaceCanonicalRefreshBaseline;
    }
  | {
      entry: Extract<MutationQueueEntry, { type: 'apply_space_action' }>;
      terminalRejection: MutationQueueTerminalRejection;
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
  bootstrapObservation?: AccountBootstrapObservationProof;
  componentRevisions?: AccountBootstrapComponentRevisions;
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
  startReplay(
    context?: MutationReplayContext,
    options?: {canSubmit?: () => boolean},
  ): Promise<MutationReplayResult[]>;
  isReplaying(): boolean;
  getQueueSize(): Promise<number>;
  hasPendingCheckIn(phoneNumber: string, dayKey: string): Promise<boolean>;
  getPendingSpaceActions(
    phoneNumber: string,
    scope?: { contentVersion: string; track: 'cet4' | 'cet6' },
  ): Promise<SpaceAction[]>;
  clear(): Promise<void>;
}

type MutationReplayAttempt =
  | {
      result: MutationReplayResult;
      status: 'replayed';
    }
  | {
      rejection: MutationQueueTerminalRejection;
      status: 'terminal_rejection';
    }
  | {
      baseline: SpaceCanonicalRefreshBaseline;
      status: 'canonical_refresh_required';
    }
  | {
      status: 'retryable_failure';
    };

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
    context?: MutationReplayContext,
  ): Promise<MutationReplayAttempt> => {
    try {
      switch (entry.type) {
        case 'check_in_daily_progress':
          await options.progressSyncRepository.checkIn(
            entry.payload.context,
            entry.payload.dayKey,
          );
          return { result: { entry }, status: 'replayed' };
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
            result: {
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
            },
            status: 'replayed',
          };
        case 'refresh_membership':
          return {
            result: {
              entry,
              membershipState: await options.membershipRepository.loadState(
                entry.payload.context,
              ),
            },
            status: 'replayed',
          };
        case 'start_membership_trial':
          return {
            result: {
              entry,
              membershipState: (
                await options.membershipRepository.startTrial(
                  entry.payload.context,
                  entry.payload.currentState,
                )
              ).state,
            },
            status: 'replayed',
          };
      }
    } catch (error) {
      if (
        isRemoteAuthorizationError(error) ||
        isRemoteRequestCancellationError(error)
      ) {
        throw error;
      }

      const terminalRejection = readTerminalSpaceActionRejection(entry, error);

      if (terminalRejection !== null) {
        return {
          rejection: terminalRejection,
          status: 'terminal_rejection',
        };
      }

      const canonicalRefreshBaseline =
        readSpaceCanonicalRefreshBaseline(entry, context, error);

      if (canonicalRefreshBaseline !== null) {
        return {
          baseline: canonicalRefreshBaseline,
          status: 'canonical_refresh_required',
        };
      }

      console.warn(
        `[MutationQueue] Replay failed for ${entry.type}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { status: 'retryable_failure' };
    }
  };

  return {
    enqueueMutation(type, payload, id) {
      return queue.enqueue(type, payload, id);
    },

    hydrate() {
      return queue.hydrate();
    },

    async startReplay(context, replayOptions) {
      await queue.hydrate();
      const replayedResults: MutationReplayResult[] = [];

      if (replaying) {
        return replayedResults;
      }

      replaying = true;

      try {
        const initialQueueSize = await queue.size();
        if (initialQueueSize === 0) {
          return replayedResults;
        }
        let consecutiveScopeSkips = 0;

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

          if (
            context?.track !== undefined &&
            entry.type === 'apply_space_action' &&
            entry.payload.track !== null &&
            entry.payload.track !== context.track
          ) {
            if (!(await queue.moveFirstToEndIfUnchanged(entry))) {
              continue;
            }
            consecutiveScopeSkips += 1;
            if (consecutiveScopeSkips >= (await queue.size())) {
              break;
            }
            continue;
          }

          if (
            entry.type === 'apply_space_action' &&
            entry.payload.canonicalRefreshBaseline !== undefined &&
            !hasCausalSpaceBootstrapAdvance(
              context,
              entry.payload.canonicalRefreshBaseline,
            )
          ) {
            replayedResults.push({
              canonicalRefreshRequired:
                entry.payload.canonicalRefreshBaseline,
              entry,
            });
            break;
          }

          const replayEntry = context
            ? withReplayContext(entry, context)
            : entry;
          if (replayOptions?.canSubmit?.() === false) {
            break;
          }
          const replayAttempt = await replayMutation(replayEntry, context);

          if (replayAttempt.status === 'replayed') {
            if (await queue.removeIfUnchanged(entry)) {
              replayedResults.push(replayAttempt.result);
              consecutiveScopeSkips = 0;
            }
            continue;
          }

          if (replayAttempt.status === 'terminal_rejection') {
            if (entry.type !== 'apply_space_action') {
              throw new Error(
                'Only physical-space actions can be terminally rejected.',
              );
            }

            if (
              await queue.quarantineIfUnchanged(
                entry,
                replayAttempt.rejection,
              )
            ) {
              replayedResults.push({
                entry,
                terminalRejection: replayAttempt.rejection,
              });
              consecutiveScopeSkips = 0;
            }
            continue;
          }

          if (replayAttempt.status === 'canonical_refresh_required') {
            if (entry.type !== 'apply_space_action') {
              throw new Error(
                'Only physical-space actions can require canonical refresh.',
              );
            }

            const updatedEntry =
              await queue.markCanonicalRefreshRequiredIfUnchanged(
                entry,
                replayAttempt.baseline,
              );

            if (updatedEntry !== undefined) {
              replayedResults.push({
                canonicalRefreshRequired: replayAttempt.baseline,
                entry: updatedEntry,
              });
            }
            break;
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

function readSpaceCanonicalRefreshBaseline(
  entry: MutationQueueEntry,
  context: MutationReplayContext | undefined,
  error: unknown,
): SpaceCanonicalRefreshBaseline | null {
  if (
    entry.type !== 'apply_space_action' ||
    !(error instanceof RemoteHttpError) ||
    error.status !== 409 ||
    error.code !== 'space_content_version_mismatch' ||
    entry.payload.contentVersion === null ||
    entry.payload.track === null ||
    context?.bootstrapObservation === undefined ||
    context?.componentRevisions === undefined ||
    context.dayKey === undefined ||
    context.track !== entry.payload.track
  ) {
    return null;
  }

  return {
    bootstrapObservation: context.bootstrapObservation,
    componentRevisions: context.componentRevisions,
    contentVersion: entry.payload.contentVersion,
    dayKey: context.dayKey,
    schemaVersion: 'space-canonical-refresh-baseline.v1',
    track: entry.payload.track,
  };
}

export function hasCausalSpaceBootstrapAdvance(
  context: MutationReplayContext | undefined,
  baseline: SpaceCanonicalRefreshBaseline,
): boolean {
  if (
    context?.bootstrapObservation === undefined ||
    context?.contentVersion === undefined ||
    context.componentRevisions === undefined ||
    context.dayKey === undefined ||
    context.track !== baseline.track ||
    context.contentVersion === baseline.contentVersion ||
    !isCausallyLaterForcedObservation(
      context.bootstrapObservation,
      baseline.bootstrapObservation,
    )
  ) {
    return false;
  }

  if (context.dayKey === baseline.dayKey) {
    return areAccountBootstrapComponentRevisionsAtLeast(
      context.componentRevisions,
      baseline.componentRevisions,
    );
  }

  return haveCrossDayCanonicalOwnersNotRegressed(
    context.componentRevisions,
    baseline.componentRevisions,
  );
}

function isCausallyLaterForcedObservation(
  candidate: AccountBootstrapObservationProof,
  baseline: AccountBootstrapObservationProof,
): boolean {
  if (!candidate.forceFresh) {
    return false;
  }

  return (
    candidate.runtimeSessionId !== baseline.runtimeSessionId ||
    candidate.generation > baseline.generation
  );
}

function haveCrossDayCanonicalOwnersNotRegressed(
  candidate: AccountBootstrapComponentRevisions,
  baseline: AccountBootstrapComponentRevisions,
): boolean {
  return (
    candidate.membership.baseMembershipRevision >=
      baseline.membership.baseMembershipRevision &&
    candidate.membership.betaEntitlementRevision >=
      baseline.membership.betaEntitlementRevision &&
    candidate.learning.eventServerSequence >=
      baseline.learning.eventServerSequence &&
    candidate.learning.sessionRevision >=
      baseline.learning.sessionRevision &&
    candidate.progress.learningServerSequence >=
      baseline.progress.learningServerSequence &&
    candidate.space.stateRevision >= baseline.space.stateRevision
  );
}

function readTerminalSpaceActionRejection(
  entry: MutationQueueEntry,
  error: unknown,
): MutationQueueTerminalRejection | null {
  if (
    entry.type !== 'apply_space_action' ||
    !(error instanceof RemoteHttpError) ||
    error.status !== 409 ||
    (error.code !== 'space_card_not_in_content' &&
      error.code !== 'space_action_id_conflict')
  ) {
    return null;
  }

  return {
    code: error.code,
    status: 409,
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
