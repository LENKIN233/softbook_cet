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
  ) => Promise<LearningEventReplayResult>;
};

export function createLearningEventSyncRepository(options: {
  eventsRepository: LearningEventsRepository;
  outbox?: LearningEventOutbox;
}): LearningEventSyncRepository {
  const outbox = options.outbox ?? new LearningEventOutbox();
  const replayInFlightByAccount = new Map<
    string,
    Promise<LearningEventReplayResult>
  >();

  const replay = async (
    context: LearningEventsContext,
  ): Promise<LearningEventReplayResult> => {
    const acknowledgedEntries: LearningEventOutboxEntry[] = [];
    const acknowledgements: LearningEventAcknowledgement[] = [];

    while (true) {
      const batch = await outbox.getBatch(context.phoneNumber);

      if (batch.length === 0) {
        break;
      }

      try {
        const acknowledgement = await options.eventsRepository.submitEvents(
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

    startReplay(context) {
      const existingReplay = replayInFlightByAccount.get(context.phoneNumber);

      if (existingReplay) {
        return existingReplay;
      }

      const task = replay(context);
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
