import { RemoteHttpError } from '../src/runtime/remoteHttpError';
import { RemoteRequestLifecycleError } from '../src/runtime/remoteRequest';
import {
  createInMemoryLearningEventOutboxStorage,
  LearningEventOutbox,
} from '../src/sync/learningEventOutbox';
import { createLearningEventSyncRepository } from '../src/sync/learningEventSyncRepository';
import type {
  LearningEventsRepository,
  LearningEventV2,
} from '../src/sync/learningEventsRepository';

const PHONE = '13800138000';
const CONTENT_VERSION = `sha256:${'a'.repeat(64)}`;
const SELECTION_ID = 'sel_1234567890abcdef';

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
    selectionId: SELECTION_ID,
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
  it('confirms each compatible queued entry separately so a batch conflict cannot quarantine an already accepted duplicate', async () => {
    const outbox = createOutbox();
    const duplicate = await outbox.enqueueCompletion(createInput());
    await outbox.acknowledge(PHONE, [duplicate.event.event_id]);
    const stale = await outbox.enqueueCompletion({...createInput('100102'), selectionId: 'sel_stale_later_123456789'});
    // Simulate a compatible multi-entry reader; each current enqueue still
    // permits only one unseen completion for an account.
    let pending = [duplicate, stale];
    const rejected: Awaited<ReturnType<LearningEventOutbox['getRejectedEntries']>> = [];
    const batches = jest.spyOn(outbox, 'getBatch').mockImplementation(async (_phone, limit = 9) => pending.slice(0, limit));
    jest.spyOn(outbox, 'acknowledge').mockImplementation(async (_phone, ids) => {pending = pending.filter(entry => !ids.includes(entry.event.event_id));});
    jest.spyOn(outbox, 'rejectIfUnchanged').mockImplementation(async (entry, code) => {
      const item = {entry, rejection: {code, rejectedAt: '2026-09-12T08:00:01.000Z'}};
      rejected.push(item); pending = pending.filter(candidate => candidate.event.event_id !== entry.event.event_id); return item;
    });
    jest.spyOn(outbox, 'getPendingCount').mockImplementation(async () => pending.length);
    jest.spyOn(outbox, 'getRejectedEntries').mockImplementation(async () => rejected);
    const submitted: string[][] = [];
    const repository = createLearningEventSyncRepository({outbox, eventsRepository: {
      submitEvents: async (_context, track, events) => {
        submitted.push(events.map(event => event.event_id));
        if (events.some(event => event.event_id === stale.event.event_id)) throw new RemoteHttpError('batch selection conflict', 409, 'learning_event_selection_conflict');
        return {acknowledgedAt: '2026-09-12T08:00:01.000Z', track, results: [{eventId: duplicate.event.event_id, serverSequence: 1, status: 'duplicate'}]};
      },
    }});
    const replay = await repository.startReplay({authToken: 'token', phoneNumber: PHONE});
    expect(batches).toHaveBeenCalledWith(PHONE, 1);
    expect(submitted).toEqual([[duplicate.event.event_id], [stale.event.event_id]]);
    expect(replay.acknowledgedEntries).toEqual([duplicate]);
    expect(replay.rejectedEntries.map(item => item.entry)).toEqual([stale]);
  });

  it('quarantines a permanent selection conflict and resumes a new content selection without acknowledging the rejected answer', async () => {
    const storage = createInMemoryLearningEventOutboxStorage();
    const outbox = new LearningEventOutbox({storage, createDeviceId: () => 'install_recovery_device'});
    const submitEvents = jest.fn<ReturnType<LearningEventsRepository['submitEvents']>, Parameters<LearningEventsRepository['submitEvents']>>(
      async (_context, track, events) => {
        if (events[0].selection_id === SELECTION_ID) {
          throw new RemoteHttpError('stale selection', 409, 'learning_event_selection_conflict');
        }
        return {acknowledgedAt: '2026-09-12T08:00:01.000Z', track, results: events.map(event => ({eventId: event.event_id, serverSequence: 1, status: 'accepted'}))};
      },
    );
    const repository = createLearningEventSyncRepository({eventsRepository: {submitEvents}, outbox});
    const original = await repository.enqueueCompletion(createInput());
    const first = await repository.startReplay({authToken: 'token', phoneNumber: PHONE});
    expect(first).toMatchObject({pendingCount: 0, rejectedCount: 1, acknowledgements: [], acknowledgedEntries: []});
    expect(first.rejectedEntries[0].entry).toEqual(original);
    const restarted = createLearningEventSyncRepository({eventsRepository: {submitEvents}, outbox: new LearningEventOutbox({storage})});
    const restored = await restarted.startReplay({authToken: 'new-token', phoneNumber: PHONE});
    expect(restored).toMatchObject({pendingCount: 0, rejectedCount: 1, rejectedEntries: [], acknowledgedEntries: []});
    expect(submitEvents).toHaveBeenCalledTimes(1);
    const next = await restarted.enqueueCompletion({...createInput('100102'), contentVersion: `sha256:${'b'.repeat(64)}`, selectionId: 'sel_new_content_123456789'});
    const resumed = await restarted.startReplay({authToken: 'new-token', phoneNumber: PHONE});
    expect(resumed.acknowledgedEntries).toEqual([next]);
    expect(resumed.rejectedCount).toBe(1);
    await expect(restarted.getRejectedEntries(PHONE)).resolves.toEqual(first.rejectedEntries);
    expect(next.event.event_id).not.toBe(original.event.event_id);
  });

  it('does not isolate unknown 409s or malformed error-shaped objects', async () => {
    for (const failure of [new RemoteHttpError('unknown', 409), Object.assign(new Error('untrusted error'), {status: 409, code: 'learning_event_selection_conflict'})]) {
      const outbox = createOutbox();
      const repository = createLearningEventSyncRepository({eventsRepository: {submitEvents: jest.fn().mockRejectedValue(failure)}, outbox});
      const original = await repository.enqueueCompletion(createInput());
      await expect(repository.startReplay({authToken: 'token', phoneNumber: PHONE})).rejects.toBe(failure);
      const pending = await outbox.getAll();
      expect(pending[0].event).toEqual(original.event);
      await expect(repository.getRejectedEntries(PHONE)).resolves.toEqual([]);
    }
  });

  it('does not hand a previous same-phone session rejection to a new session or recreate its cleared event', async () => {
    const outbox = createOutbox();
    let rejectOld: (error: Error) => void = () => undefined;
    let oldCurrent = true;
    const submitEvents = jest.fn<ReturnType<LearningEventsRepository['submitEvents']>, Parameters<LearningEventsRepository['submitEvents']>>(
      async (context, track, events) => {
        if (context.authToken === 'old-token') return new Promise((_resolve, reject) => {rejectOld = reject;});
        return {acknowledgedAt: '2026-09-12T08:00:01.000Z', track, results: events.map(event => ({eventId: event.event_id, serverSequence: 1, status: 'accepted'}))};
      },
    );
    const repository = createLearningEventSyncRepository({eventsRepository: {submitEvents}, outbox});
    await repository.enqueueCompletion(createInput());
    const old = repository.startReplay({authToken: 'old-token', phoneNumber: PHONE}, {canSubmit: () => oldCurrent});
    while (submitEvents.mock.calls.length === 0) await Promise.resolve();
    oldCurrent = false;
    await repository.clearAccount(PHONE);
    const current = await repository.enqueueCompletion({...createInput('100102'), selectionId: 'sel_reregistered_12345678'});
    const fresh = repository.startReplay({authToken: 'fresh-token', phoneNumber: PHONE}, {canSubmit: () => true});
    expect(fresh).not.toBe(old);
    rejectOld(new RemoteHttpError('stale response', 409, 'learning_event_selection_conflict'));
    expect((await old).rejectedEntries).toEqual([]);
    expect((await fresh).acknowledgedEntries).toEqual([current]);
    await expect(repository.getRejectedEntries(PHONE)).resolves.toEqual([]);
  });

  it('removes one selection-bound event only after acknowledgement', async () => {
    const outbox = createOutbox();
    const submitEvents = jest.fn<
      ReturnType<LearningEventsRepository['submitEvents']>,
      Parameters<LearningEventsRepository['submitEvents']>
    >(async (_context, track, events) => ({
      acknowledgedAt: '2026-07-21T08:00:01.000Z',
      results: events.map((event, index) => ({
        eventId: event.event_id,
        serverSequence: index + 1,
        status: 'accepted' as const,
      })),
      track,
    }));
    const eventsRepository: LearningEventsRepository = { submitEvents };
    const repository = createLearningEventSyncRepository({
      eventsRepository,
      outbox,
    });
    await repository.enqueueCompletion(createInput('100101'));

    const result = await repository.startReplay({
      authToken: 'fresh-token',
      phoneNumber: PHONE,
    });

    expect(result.acknowledgedEntries).toHaveLength(1);
    expect(result.pendingCount).toBe(0);
    expect(submitEvents).toHaveBeenCalledWith(
      { authToken: 'fresh-token', phoneNumber: PHONE },
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
    const eventsRepository: LearningEventsRepository = { submitEvents };
    const repository = createLearningEventSyncRepository({
      eventsRepository,
      outbox,
    });
    const original = await repository.enqueueCompletion(createInput());

    await expect(
      repository.startReplay({ authToken: 'token', phoneNumber: PHONE }),
    ).rejects.toThrow('network failed');

    const [retained] = await outbox.getAll();
    expect(retained.event).toEqual(original.event);
    expect(retained.retryCount).toBe(1);
  });

  it('rechecks canonical write authority after reading the durable batch', async () => {
    const outbox = createOutbox();
    const submitEvents = jest.fn();
    const repository = createLearningEventSyncRepository({
      eventsRepository: {submitEvents} as never,
      outbox,
    });
    const original = await repository.enqueueCompletion(createInput());

    await expect(
      repository.startReplay(
        {authToken: 'token', phoneNumber: PHONE},
        {canSubmit: () => false},
      ),
    ).resolves.toMatchObject({
      acknowledgedEntries: [],
      pendingCount: 1,
    });

    expect(submitEvents).not.toHaveBeenCalled();
    await expect(outbox.getAll()).resolves.toEqual([original]);
  });

  it('surfaces authorization failure without removing or rewriting the event', async () => {
    const outbox = createOutbox();
    const submitEvents = jest
      .fn()
      .mockRejectedValue(
        new RemoteHttpError('Unauthorized', 401),
      ) as jest.MockedFunction<LearningEventsRepository['submitEvents']>;
    const eventsRepository: LearningEventsRepository = { submitEvents };
    const repository = createLearningEventSyncRepository({
      eventsRepository,
      outbox,
    });
    const original = await repository.enqueueCompletion(createInput());

    await expect(
      repository.startReplay({ authToken: 'expired', phoneNumber: PHONE }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(outbox.getAll()).resolves.toEqual([original]);
  });

  it('retains the exact event and increments retry state after timeout', async () => {
    const outbox = createOutbox();
    const submitEvents = jest
      .fn()
      .mockRejectedValue(
        new RemoteRequestLifecycleError('timeout'),
      ) as jest.MockedFunction<LearningEventsRepository['submitEvents']>;
    const repository = createLearningEventSyncRepository({
      eventsRepository: { submitEvents },
      outbox,
    });
    const original = await repository.enqueueCompletion(createInput());

    await expect(
      repository.startReplay({ authToken: 'token', phoneNumber: PHONE }),
    ).rejects.toMatchObject({ reason: 'timeout', retryable: true });

    const [retained] = await outbox.getAll();
    expect(retained.event).toEqual(original.event);
    expect(retained.retryCount).toBe(1);
  });

  it.each(['caller_cancelled', 'session_superseded'] as const)(
    'keeps retry state unchanged after %s cancellation',
    async reason => {
      const outbox = createOutbox();
      const submitEvents = jest
        .fn()
        .mockRejectedValue(
          new RemoteRequestLifecycleError(reason),
        ) as jest.MockedFunction<LearningEventsRepository['submitEvents']>;
      const repository = createLearningEventSyncRepository({
        eventsRepository: { submitEvents },
        outbox,
      });
      const original = await repository.enqueueCompletion(createInput());

      await expect(
        repository.startReplay({ authToken: 'token', phoneNumber: PHONE }),
      ).rejects.toMatchObject({ reason, retryable: false });

      await expect(outbox.getAll()).resolves.toEqual([original]);
    },
  );

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
    const eventsRepository: LearningEventsRepository = { submitEvents };
    const repository = createLearningEventSyncRepository({
      eventsRepository,
      outbox,
    });
    await repository.enqueueCompletion(createInput());
    const context = { authToken: 'token', phoneNumber: PHONE };
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
      eventsRepository: { submitEvents },
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

    await expect(secondReplay).resolves.toMatchObject({ pendingCount: 0 });
    releaseFirst?.();
    await expect(firstReplay).resolves.toMatchObject({ pendingCount: 0 });
    expect(submitEvents).toHaveBeenCalledTimes(2);
  });

  it('never submits a second unseen completion while one is pending', async () => {
    const outbox = createOutbox();
    const submitEvents = jest.fn<
      ReturnType<LearningEventsRepository['submitEvents']>,
      Parameters<LearningEventsRepository['submitEvents']>
    >(async (_context, track, events: LearningEventV2[]) => {
      return {
        acknowledgedAt: '2026-07-21T08:00:01.000Z',
        results: events.map((event, index) => ({
          eventId: event.event_id,
          serverSequence: index + 1,
          status: 'accepted' as const,
        })),
        track,
      };
    });
    const eventsRepository: LearningEventsRepository = { submitEvents };
    const repository = createLearningEventSyncRepository({
      eventsRepository,
      outbox,
    });

    await repository.enqueueCompletion(createInput('100101'));
    await expect(
      repository.enqueueCompletion(createInput('100102')),
    ).rejects.toThrow('must be acknowledged');

    await repository.startReplay({ authToken: 'token', phoneNumber: PHONE });
    expect(submitEvents).toHaveBeenCalledTimes(1);
    expect(submitEvents.mock.calls[0][2]).toHaveLength(1);
  });
});
