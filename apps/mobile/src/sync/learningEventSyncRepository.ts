import {isRemoteAuthorizationError} from '../runtime/remoteHttpError';
import {isRemoteRequestCancellationError} from '../runtime/remoteRequest';
import {
  LearningEventOutbox,
  type EnqueueLearningCompletionInput,
  type LearningEventOutboxEntry,
} from './learningEventOutbox';
import type {
  LearningEventAcknowledgement,
  LearningEventsContext,
  LearningEventsRepository,
} from './learningEventsRepository';

export type LearningEventReplayResult = {
  acknowledgements: LearningEventAcknowledgement[];
  acknowledgedEntries: LearningEventOutboxEntry[];
  pendingCount: number;
};

export type LearningEventSyncRepository = {
  clearAccount: (phoneNumber: string) => Promise<void>;
  enqueueCompletion: (
    input: EnqueueLearningCompletionInput,
  ) => Promise<LearningEventOutboxEntry>;
  getPendingCount: (phoneNumber: string) => Promise<number>;
  startReplay: (
    context: LearningEventsContext,
    options?: {canSubmit?: () => boolean},
  ) => Promise<LearningEventReplayResult>;
};

export function createLearningEventSyncRepository(config: {
  eventsRepository: LearningEventsRepository;
  outbox: LearningEventOutbox;
}): LearningEventSyncRepository {
  const outbox = config.outbox;
  const replayInFlightByAccount = new Map<
    string,
    Promise<LearningEventReplayResult>
  >();

  const replay = async (
    context: LearningEventsContext,
    options: {canSubmit?: () => boolean} = {},
  ): Promise<LearningEventReplayResult> => {
    const acknowledgedEntries: LearningEventOutboxEntry[] = [];
    const acknowledgements: LearningEventAcknowledgement[] = [];

    while (true) {
      const batch = await outbox.getBatch(context.phoneNumber);

      if (batch.length === 0) {
        break;
      }

      if (options.canSubmit?.() === false) {
        break;
      }

      try {
        const acknowledgement = await config.eventsRepository.submitEvents(
          context,
          batch[0].track,
          batch.map(entry => entry.event),
        );
        const acknowledgedIds = acknowledgement.results.map(
          result => result.eventId,
        );

        await outbox.acknowledge(context.phoneNumber, acknowledgedIds);
        acknowledgedEntries.push(...batch);
        acknowledgements.push(acknowledgement);
      } catch (error) {
        if (
          !isRemoteAuthorizationError(error) &&
          !isRemoteRequestCancellationError(error)
        ) {
          await outbox.incrementRetry(
            context.phoneNumber,
            batch.map(entry => entry.event.event_id),
          );
        }

        throw error;
      }
    }

    return {
      acknowledgements,
      acknowledgedEntries,
      pendingCount: await outbox.getPendingCount(context.phoneNumber),
    };
  };

  return {
    clearAccount(phoneNumber) {
      return outbox.clearAccount(phoneNumber);
    },

    enqueueCompletion(input) {
      return outbox.enqueueCompletion(input);
    },

    getPendingCount(phoneNumber) {
      return outbox.getPendingCount(phoneNumber);
    },

    startReplay(context, replayOptions) {
      const existingReplay = replayInFlightByAccount.get(context.phoneNumber);

      if (existingReplay) {
        return existingReplay;
      }

      const task = replay(context, replayOptions);
      replayInFlightByAccount.set(context.phoneNumber, task);
      task.then(
        () => {
          if (replayInFlightByAccount.get(context.phoneNumber) === task) {
            replayInFlightByAccount.delete(context.phoneNumber);
          }
        },
        () => {
          if (replayInFlightByAccount.get(context.phoneNumber) === task) {
            replayInFlightByAccount.delete(context.phoneNumber);
          }
        },
      );
      return task;
    },
  };
}
