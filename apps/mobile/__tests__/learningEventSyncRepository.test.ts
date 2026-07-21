import {RemoteHttpError} from '../src/runtime/remoteHttpError';
import {
  createInMemoryLearningEventOutboxStorage,
  LearningEventOutbox,
} from '../src/sync/learningEventOutbox';
import {createLearningEventSyncRepository} from '../src/sync/learningEventSyncRepository';
import type {
  LearningEventsRepository,
  LearningEventV2,
} from '../src/sync/learningEventsRepository';

const PHONE = '13800138000';
const CONTENT_VERSION = `sha256:${'a'.repeat(64)}`;

function createInput(cardId = '100101') {
  return {
    accountPhoneNumber: PHONE,
    contentVersion: CONTENT_VERSION,
    phase: 'learning' as const,
    result: {
      cardId,
      completedAt: '2026-07-21T08:00:00.000Z',
      interactionId: 'flip' as const,
      isFavorited: false,
      outcome: 'confident' as const,
      usedHint: false,
      usedPeek: false,
    },
    track: 'cet4' as const,
  };
}

function createOutbox() {
  return new LearningEventOutbox({
    createDeviceId: () => 'install_sync_device',
    storage: createInMemoryLearningEventOutboxStorage(),
  });
}

describe('learningEventSyncRepository', () => {
  it('removes events only after accepted or duplicate acknowledgement', async () => {
    const outbox = createOutbox();
    const submitEvents = jest.fn<
      ReturnType<LearningEventsRepository['submitEvents']>,
      Parameters<LearningEventsRepository['submitEvents']>
    >(async (_context, track, events) => ({
      acknowledgedAt: '2026-07-21T08:00:01.000Z',
      results: events.map((event, index) => ({
        eventId: event.event_id,
        serverSequence: index + 1,
        status: index === 0 ? ('accepted' as const) : ('duplicate' as const),
      })),
      track,
    }));
    const eventsRepository: LearningEventsRepository = {submitEvents};
    const repository = createLearningEventSyncRepository({
      eventsRepository,
      outbox,
    });
    await repository.enqueueCompletion(createInput('100101'));
    await repository.enqueueCompletion(createInput('100102'));

    const result = await repository.startReplay({
      authToken: 'fresh-token',
      phoneNumber: PHONE,
    });

    expect(result.acknowledgedEntries).toHaveLength(2);
    expect(result.pendingCount).toBe(0);
    expect(submitEvents).toHaveBeenCalledWith(
      {authToken: 'fresh-token', phoneNumber: PHONE},
      'cet4',
      expect.any(Array),
    );
    await expect(outbox.getAll()).resolves.toEqual([]);
  });

  it('keeps byte-equivalent events after a transient failure', async () => {
    const outbox = createOutbox();
    const submitEvents = jest
      .fn<
        ReturnType<LearningEventsRepository['submitEvents']>,
        Parameters<LearningEventsRepository['submitEvents']>
      >()
      .mockRejectedValue(new Error('network failed'));
    const eventsRepository: LearningEventsRepository = {submitEvents};
    const repository = createLearningEventSyncRepository({
      eventsRepository,
      outbox,
    });
    const original = await repository.enqueueCompletion(createInput());

    await expect(
      repository.startReplay({authToken: 'token', phoneNumber: PHONE}),
    ).rejects.toThrow('network failed');

    const [retained] = await outbox.getAll();
    expect(retained.event).toEqual(original.event);
    expect(retained.retryCount).toBe(1);
  });

  it('surfaces authorization failure without removing or rewriting the event', async () => {
    const outbox = createOutbox();
    const submitEvents = jest
      .fn()
      .mockRejectedValue(
        new RemoteHttpError('Unauthorized', 401),
      ) as jest.MockedFunction<LearningEventsRepository['submitEvents']>;
    const eventsRepository: LearningEventsRepository = {submitEvents};
    const repository = createLearningEventSyncRepository({
      eventsRepository,
      outbox,
    });
    const original = await repository.enqueueCompletion(createInput());

    await expect(
      repository.startReplay({authToken: 'expired', phoneNumber: PHONE}),
    ).rejects.toMatchObject({status: 401});
    await expect(outbox.getAll()).resolves.toEqual([original]);
  });

  it('shares one in-flight replay instead of submitting a duplicate request', async () => {
    const outbox = createOutbox();
    let release: (() => void) | undefined;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>(resolve => {
      markStarted = resolve;
    });
    const submitEvents = jest.fn<
      ReturnType<LearningEventsRepository['submitEvents']>,
      Parameters<LearningEventsRepository['submitEvents']>
    >(
      (
        _context,
        track,
        events,
      ): Promise<{
        acknowledgedAt: string;
        results: Array<{
          eventId: string;
          serverSequence: number;
          status: 'accepted';
        }>;
        track: typeof track;
      }> =>
        new Promise(resolve => {
          markStarted?.();
          release = () =>
            resolve({
              acknowledgedAt: '2026-07-21T08:00:01.000Z',
              results: events.map((event, index) => ({
                eventId: event.event_id,
                serverSequence: index + 1,
                status: 'accepted' as const,
              })),
              track,
            });
        }),
    );
    const eventsRepository: LearningEventsRepository = {submitEvents};
    const repository = createLearningEventSyncRepository({
      eventsRepository,
      outbox,
    });
    await repository.enqueueCompletion(createInput());
    const context = {authToken: 'token', phoneNumber: PHONE};
    const first = repository.startReplay(context);
    const second = repository.startReplay(context);

    expect(first).toBe(second);
    await started;
    release?.();
    await Promise.all([first, second]);
    expect(submitEvents).toHaveBeenCalledTimes(1);
  });

  it('does not share an in-flight replay across accounts', async () => {
    const secondPhone = '13800138001';
    const outbox = createOutbox();
    let releaseFirst: (() => void) | undefined;
    let markFirstStarted: (() => void) | undefined;
    const firstStarted = new Promise<void>(resolve => {
      markFirstStarted = resolve;
    });
    const submitEvents = jest.fn<
      ReturnType<LearningEventsRepository['submitEvents']>,
      Parameters<LearningEventsRepository['submitEvents']>
    >((context, track, events) => {
      const acknowledgement = {
        acknowledgedAt: '2026-07-21T08:00:01.000Z',
        results: events.map((event, index) => ({
          eventId: event.event_id,
          serverSequence: index + 1,
          status: 'accepted' as const,
        })),
        track,
      };

      if (context.phoneNumber === PHONE) {
        markFirstStarted?.();
        return new Promise(resolve => {
          releaseFirst = () => resolve(acknowledgement);
        });
      }

      return Promise.resolve(acknowledgement);
    });
    const repository = createLearningEventSyncRepository({
      eventsRepository: {submitEvents},
      outbox,
    });
    await repository.enqueueCompletion(createInput('100101'));
    await repository.enqueueCompletion({
      ...createInput('100102'),
      accountPhoneNumber: secondPhone,
    });

    const firstReplay = repository.startReplay({
      authToken: 'first-token',
      phoneNumber: PHONE,
    });
    await firstStarted;
    const secondReplay = repository.startReplay({
      authToken: 'second-token',
      phoneNumber: secondPhone,
    });

    await expect(secondReplay).resolves.toMatchObject({pendingCount: 0});
    releaseFirst?.();
    await expect(firstReplay).resolves.toMatchObject({pendingCount: 0});
    expect(submitEvents).toHaveBeenCalledTimes(2);
  });

  it('splits larger queues into server-safe batches of nine', async () => {
    const outbox = createOutbox();
    const batchSizes: number[] = [];
    const submitEvents = jest.fn<
      ReturnType<LearningEventsRepository['submitEvents']>,
      Parameters<LearningEventsRepository['submitEvents']>
    >(async (_context, track, events: LearningEventV2[]) => {
      batchSizes.push(events.length);
      return {
        acknowledgedAt: '2026-07-21T08:00:01.000Z',
        results: events.map((event, index) => ({
          eventId: event.event_id,
          serverSequence: batchSizes.length * 100 + index,
          status: 'accepted' as const,
        })),
        track,
      };
    });
    const eventsRepository: LearningEventsRepository = {submitEvents};
    const repository = createLearningEventSyncRepository({
      eventsRepository,
      outbox,
    });

    for (let index = 0; index < 11; index += 1) {
      await repository.enqueueCompletion(createInput(String(100101 + index)));
    }

    await repository.startReplay({authToken: 'token', phoneNumber: PHONE});
    expect(batchSizes).toEqual([9, 2]);
  });
});
