import type { LearningCardResult } from '../src/learning/model';
import {
  createInMemoryLearningEventOutboxStorage,
  LEARNING_EVENT_OUTBOX_STORAGE_KEY,
  LEGACY_LEARNING_EVENT_OUTBOX_STORAGE_KEY,
  LearningEventOutbox,
} from '../src/sync/learningEventOutbox';

const CONTENT_VERSION = `sha256:${'a'.repeat(64)}`;
const PHONE = '13800138000';
const SELECTION_ID = 'sel_1234567890abcdef';

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
    selectionId: SELECTION_ID,
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
        selection_id: SELECTION_ID,
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
    const [persisted] = await restored.getAll();
    await restored.acknowledge(PHONE, [persisted.event.event_id]);
    const second = await restored.enqueueCompletion(createInput('100102'));
    const entries = await restored.getAll();

    expect(entries.map(entry => entry.event.device_cursor.sequence)).toEqual([
      2,
    ]);
    expect(second.event.device_cursor.device_id).toBe(
      'install_original_device',
    );
    expect(persisted.event).toEqual((await first.getAll())[0].event);
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
    const [retained] = await restored.getAll();
    await restored.acknowledge(PHONE, [retained.event.event_id]);
    const second = await restored.enqueueCompletion(createInput('100102'));

    expect(second.event.device_cursor).toEqual({
      device_id: 'install_repair_device',
      sequence: 2,
    });
    await expect(restored.getAll()).resolves.toEqual([second]);
  });

  it('does not consume a cursor or mutate memory when persistence fails', async () => {
    let shouldFail = true;
    const values: Record<string, string> = {};
    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_failure_device',
      storage: {
        getItem: async key => values[key] ?? null,
        removeItem: async key => {
          delete values[key];
        },
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
    await expect(
      outbox.enqueueCompletion({
        ...createInput(),
        selectionId: 'sel_short',
      }),
    ).rejects.toThrow('selection ID is invalid');
  });

  it('serializes concurrent completion attempts and persists only one', async () => {
    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_concurrent_device',
      storage: createInMemoryLearningEventOutboxStorage(),
    });
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, index) =>
        outbox.enqueueCompletion(createInput(String(100101 + index))),
      ),
    );

    expect(
      results.filter(result => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(
      11,
    );
    await expect(outbox.getAll()).resolves.toHaveLength(1);
  });

  it('blocks another completion for the same account until acknowledgement', async () => {
    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_batch_device',
      storage: createInMemoryLearningEventOutboxStorage(),
    });
    const first = await outbox.enqueueCompletion(createInput('100101'));

    await expect(
      outbox.enqueueCompletion(createInput('100102')),
    ).rejects.toThrow('must be acknowledged');
    await expect(outbox.getBatch(PHONE)).resolves.toEqual([first]);
    await outbox.acknowledge(PHONE, [first.event.event_id]);
    const second = await outbox.enqueueCompletion(createInput('100102'));
    expect(second.event.device_cursor.sequence).toBe(2);
  });

  it('keeps one pending completion per account without cross-account mixing', async () => {
    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_track_order_device',
      storage: createInMemoryLearningEventOutboxStorage(),
    });
    const secondPhone = '13900139000';
    const first = await outbox.enqueueCompletion(createInput('100101'));
    const second = await outbox.enqueueCompletion({
      ...createInput('200101'),
      accountPhoneNumber: secondPhone,
      track: 'cet6',
    });

    await expect(outbox.getBatch(PHONE)).resolves.toEqual([first]);
    await expect(outbox.getBatch(secondPhone)).resolves.toEqual([second]);
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

  it('removes the unbound v1 outbox without replay or logging its payload', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const seed = {
      [LEGACY_LEARNING_EVENT_OUTBOX_STORAGE_KEY]:
        '{"phone_number":"13800138000","access_token":"secret"',
    };
    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_migration_device',
      storage: createInMemoryLearningEventOutboxStorage(seed),
    });

    await outbox.hydrate();

    expect(seed).not.toHaveProperty(LEGACY_LEARNING_EVENT_OUTBOX_STORAGE_KEY);
    await expect(outbox.getAll()).resolves.toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not echo unreadable v2 persisted content into logs', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const outbox = new LearningEventOutbox({
      createDeviceId: () => 'install_corrupt_device',
      storage: createInMemoryLearningEventOutboxStorage({
        [LEARNING_EVENT_OUTBOX_STORAGE_KEY]:
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
