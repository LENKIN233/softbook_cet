import type {LearningCardResult} from '../src/learning/model';
import {
  createInMemoryLearningEventOutboxStorage,
  LearningEventOutbox,
} from '../src/sync/learningEventOutbox';

const CONTENT_VERSION = `sha256:${'a'.repeat(64)}`;
const PHONE = '13800138000';

function createResult(
  cardId = '100101',
  completedAt = '2026-07-21T08:00:00.000Z',
): LearningCardResult {
  return {
    cardId,
    completedAt,
    interactionId: 'flip',
    isFavorited: true,
    outcome: 'confident',
    usedHint: false,
    usedPeek: true,
  };
}

function createInput(cardId = '100101') {
  return {
    accountPhoneNumber: PHONE,
    contentVersion: CONTENT_VERSION,
    phase: 'learning' as const,
    result: createResult(cardId),
    track: 'cet4' as const,
  };
}

describe('LearningEventOutbox', () => {
  it('durably allocates an immutable event and pseudonymous cursor', async () => {
    const seed: Record<string, string> = {};
    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_test_device',
      now: () => '2026-07-21T08:00:01.000Z',
      storage: createInMemoryLearningEventOutboxStorage(seed),
    });

    const entry = await outbox.enqueueCompletion(createInput());

    expect(entry).toMatchObject({
      accountPhoneNumber: PHONE,
      enqueuedAt: '2026-07-21T08:00:01.000Z',
      event: {
        event_id: 'event_install_test_device_1',
        answer_grade: 'passed',
        client_occurred_at: '2026-07-21T08:00:00.000Z',
        content_version: CONTENT_VERSION,
        device_cursor: {
          device_id: 'install_test_device',
          sequence: 1,
        },
        phase: 'learning',
      },
      retryCount: 0,
      track: 'cet4',
    });
    expect(JSON.stringify(entry.event)).not.toMatch(
      /phone|token|is_favorited|selected_answer|correct_answer/,
    );
    expect(Object.values(seed)).toHaveLength(1);
  });

  it('reuses persisted identity and advances sequence after restart', async () => {
    const seed: Record<string, string> = {};
    const storage = createInMemoryLearningEventOutboxStorage(seed);
    const first = new LearningEventOutbox({
      createDeviceId: () => 'install_original_device',
      storage,
    });
    await first.enqueueCompletion(createInput('100101'));

    const restored = new LearningEventOutbox({
      createDeviceId: () => 'install_should_not_replace',
      storage,
    });
    const second = await restored.enqueueCompletion(createInput('100102'));
    const entries = await restored.getAll();

    expect(entries.map(entry => entry.event.device_cursor.sequence)).toEqual([
      1, 2,
    ]);
    expect(second.event.device_cursor.device_id).toBe(
      'install_original_device',
    );
    expect(entries[0].event).toEqual((await first.getAll())[0].event);
  });

  it('repairs a stale persisted cursor and drops non-canonical event IDs', async () => {
    const seed: Record<string, string> = {};
    const storage = createInMemoryLearningEventOutboxStorage(seed);
    const first = new LearningEventOutbox({
      createDeviceId: () => 'install_repair_device',
      storage,
    });
    await first.enqueueCompletion(createInput('100101'));

    const storageKey = Object.keys(seed)[0];
    const persisted = JSON.parse(seed[storageKey]);
    persisted.nextSequence = 1;
    persisted.entries.push({
      ...persisted.entries[0],
      event: {
        ...persisted.entries[0].event,
        event_id: 'event_tampered_identifier',
      },
    });
    seed[storageKey] = JSON.stringify(persisted);

    const restored = new LearningEventOutbox({
      createDeviceId: () => 'install_should_not_replace',
      storage,
    });
    const second = await restored.enqueueCompletion(createInput('100102'));

    expect(second.event.device_cursor).toEqual({
      device_id: 'install_repair_device',
      sequence: 2,
    });
    await expect(restored.getAll()).resolves.toHaveLength(2);
  });

  it('does not consume a cursor or mutate memory when persistence fails', async () => {
    let shouldFail = true;
    const values: Record<string, string> = {};
    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_failure_device',
      storage: {
        getItem: async key => values[key] ?? null,
        setItem: async (key, value) => {
          if (shouldFail) {
            throw new Error('disk unavailable');
          }
          values[key] = value;
        },
      },
    });

    await expect(outbox.enqueueCompletion(createInput())).rejects.toThrow(
      'disk unavailable',
    );
    await expect(outbox.getAll()).resolves.toEqual([]);

    shouldFail = false;
    const entry = await outbox.enqueueCompletion(createInput());
    expect(entry.event.device_cursor.sequence).toBe(1);
  });

  it('rejects identifiers that cannot stay within the server event contract', async () => {
    const oversizedIdentity = new LearningEventOutbox({
      createDeviceId: () => `install_${'x'.repeat(121)}`,
      storage: createInMemoryLearningEventOutboxStorage(),
    });
    await expect(oversizedIdentity.hydrate()).rejects.toThrow(
      'device ID is invalid',
    );

    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_valid_device',
      storage: createInMemoryLearningEventOutboxStorage(),
    });
    await expect(
      outbox.enqueueCompletion(createInput('card id with spaces')),
    ).rejects.toThrow('completion result is invalid');
  });

  it('serializes concurrent allocations without duplicate cursors', async () => {
    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_concurrent_device',
      storage: createInMemoryLearningEventOutboxStorage(),
    });
    const entries = await Promise.all(
      Array.from({length: 12}, (_, index) =>
        outbox.enqueueCompletion(createInput(String(100101 + index))),
      ),
    );

    expect(entries.map(entry => entry.event.device_cursor.sequence)).toEqual(
      Array.from({length: 12}, (_, index) => index + 1),
    );
    expect(new Set(entries.map(entry => entry.event.event_id)).size).toBe(12);
  });

  it('batches at most nine events for one track without compaction', async () => {
    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_batch_device',
      storage: createInMemoryLearningEventOutboxStorage(),
    });

    for (let index = 0; index < 11; index += 1) {
      await outbox.enqueueCompletion(createInput(String(100101 + index)));
    }
    await outbox.enqueueCompletion({
      ...createInput('200101'),
      track: 'cet6',
    });

    const first = await outbox.getBatch(PHONE);
    expect(first).toHaveLength(9);
    expect(first.every(entry => entry.track === 'cet4')).toBe(true);

    await outbox.acknowledge(
      PHONE,
      first.map(entry => entry.event.event_id),
    );
    expect(await outbox.getBatch(PHONE)).toHaveLength(2);
    expect(await outbox.getPendingCount(PHONE)).toBe(3);
  });

  it('preserves enqueue order when tracks are interleaved', async () => {
    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_track_order_device',
      storage: createInMemoryLearningEventOutboxStorage(),
    });
    const first = await outbox.enqueueCompletion(createInput('100101'));
    const second = await outbox.enqueueCompletion({
      ...createInput('200101'),
      track: 'cet6',
    });
    const third = await outbox.enqueueCompletion(createInput('100102'));

    await expect(outbox.getBatch(PHONE)).resolves.toEqual([first]);
    await outbox.acknowledge(PHONE, [first.event.event_id]);
    await expect(outbox.getBatch(PHONE)).resolves.toEqual([second]);
    await outbox.acknowledge(PHONE, [second.event.event_id]);
    await expect(outbox.getBatch(PHONE)).resolves.toEqual([third]);
  });

  it('rejects unknown acknowledgements and keeps every event', async () => {
    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_ack_device',
      storage: createInMemoryLearningEventOutboxStorage(),
    });
    await outbox.enqueueCompletion(createInput());

    await expect(
      outbox.acknowledge(PHONE, ['event_install_unknown_1']),
    ).rejects.toThrow('unknown ID');
    await expect(outbox.getPendingCount(PHONE)).resolves.toBe(1);
  });

  it('clears account entries without reusing the installation cursor', async () => {
    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_logout_device',
      storage: createInMemoryLearningEventOutboxStorage(),
    });
    await outbox.enqueueCompletion(createInput());
    await outbox.clearAccount(PHONE);
    const next = await outbox.enqueueCompletion(createInput('100102'));

    expect(next.event.device_cursor).toEqual({
      device_id: 'install_logout_device',
      sequence: 2,
    });
  });

  it('maps review-needed outcomes without introducing four-grade input', async () => {
    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_grade_device',
      storage: createInMemoryLearningEventOutboxStorage(),
    });
    const entry = await outbox.enqueueCompletion({
      ...createInput(),
      result: {
        ...createResult(),
        outcome: 'review',
      },
    });

    expect(entry.event.answer_grade).toBe('review_needed');
    expect(JSON.stringify(entry.event)).not.toMatch(/again|hard|good|easy/);
  });

  it('does not echo unreadable persisted content into logs', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_corrupt_device',
      storage: createInMemoryLearningEventOutboxStorage({
        __softbook_learning_event_outbox_v1:
          '{"phone_number":"13800138000","access_token":"secret"',
      }),
    });

    await outbox.hydrate();

    expect(warn).toHaveBeenCalledWith(
      '[LearningEventOutbox] Discarded unreadable persisted state.',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(
      /13800138000|access_token|secret/,
    );
    warn.mockRestore();
  });
});
