import {isRemoteAuthorizationError} from '../runtime/remoteHttpError';
import {isRemoteRequestCancellationError} from '../runtime/remoteRequest';
import {
  LearningEventOutbox,
  type EnqueueLearningCompletionInput,
  type LearningEventOutboxEntry,
  type RejectedLearningEvent,
} from './learningEventOutbox';
import {getLearningEventTerminalRejectionCode} from './learningEventsRepository';
import type {
  LearningEventAcknowledgement,
  LearningEventsContext,
  LearningEventsRepository,
} from './learningEventsRepository';

export type LearningEventReplayResult = {
  acknowledgements: LearningEventAcknowledgement[];
  acknowledgedEntries: LearningEventOutboxEntry[];
  pendingCount: number;
  rejectedEntries: RejectedLearningEvent[];
  rejectedCount: number;
};

export type LearningEventSyncRepository = {
  clearAccount: (phoneNumber: string) => Promise<void>;
  enqueueCompletion: (
    input: EnqueueLearningCompletionInput,
  ) => Promise<LearningEventOutboxEntry>;
  getPendingCount: (phoneNumber: string) => Promise<number>;
  getRejectedEntries: (phoneNumber: string) => Promise<RejectedLearningEvent[]>;
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
    {authToken: string | undefined; task: Promise<LearningEventReplayResult>}
  >();

  const replay = async (
    context: LearningEventsContext,
    options: {canSubmit?: () => boolean} = {},
  ): Promise<LearningEventReplayResult> => {
    const acknowledgedEntries: LearningEventOutboxEntry[] = [];
    const acknowledgements: LearningEventAcknowledgement[] = [];
    const rejectedEntries: RejectedLearningEvent[] = [];

    while (true) {
      // A batch-level 409 does not identify the rejected event. Replay one
      // immutable event at a time so an accepted duplicate can never inherit
      // a later event's rejection during compatible outbox recovery.
      const batch = await outbox.getBatch(context.phoneNumber, 1);

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

        if (options.canSubmit?.() === false) break;

        await outbox.acknowledge(context.phoneNumber, acknowledgedIds);
        acknowledgedEntries.push(...batch);
        acknowledgements.push(acknowledgement);
      } catch (error) {
        if (options.canSubmit?.() === false) break;
        const rejectionCode = getLearningEventTerminalRejectionCode(error);
        if (rejectionCode !== null) {
          for (const entry of batch) {
            const rejected = await outbox.rejectIfUnchanged(entry, rejectionCode);
            if (rejected) rejectedEntries.push(rejected);
          }
          continue;
        }
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
      rejectedEntries,
      rejectedCount: (await outbox.getRejectedEntries(context.phoneNumber)).length,
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

    getRejectedEntries(phoneNumber) {
      return outbox.getRejectedEntries(phoneNumber);
    },

    startReplay(context, replayOptions) {
      const existingReplay = replayInFlightByAccount.get(context.phoneNumber);

      if (existingReplay && existingReplay.authToken === context.authToken) {
        return existingReplay.task;
      }

      // Do not return a previous session's acknowledgement or rejection to a
      // replacement session of the same phone. Its pass starts after the old
      // pass settles and reads fresh durable state.
      const task = existingReplay
        ? existingReplay.task.catch(() => undefined).then(() => replay(context, replayOptions))
        : replay(context, replayOptions);
      replayInFlightByAccount.set(context.phoneNumber, {authToken: context.authToken, task});
      task.then(
        () => {
          if (replayInFlightByAccount.get(context.phoneNumber)?.task === task) {
            replayInFlightByAccount.delete(context.phoneNumber);
          }
        },
        () => {
          if (replayInFlightByAccount.get(context.phoneNumber)?.task === task) {
            replayInFlightByAccount.delete(context.phoneNumber);
          }
        },
      );
      return task;
    },
  };
}
