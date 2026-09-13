import {
  createInMemoryLearningEventOutboxStorage,
  LearningEventOutbox,
  LEARNING_EVENT_OUTBOX_STORAGE_KEY as OUTBOX_KEY,
} from '../../mobile/src/sync/learningEventOutbox';
import {
  createWebAccountDeletionStateStore,
  isCommittedWebLearningStorageUpgrade,
  WEB_ACCOUNT_DELETION_STORAGE_KEY as EPOCH_KEY,
} from './webAccountDeletionState';
import {
  createWebAccountWriteFence,
  createWebLearningEventStorage,
  runWebStorageExclusive,
} from './webStorage';

const PHONE = '13800138000';
const OTHER_PHONE = '13900139000';
const V2 = 'web-account-deletion-envelope.v2';
const V3 = 'web-account-deletion-envelope.v3';
type BrowserStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

// Pre-rejection Web clients require exactly four outbox fields and exactly a
// v2 account envelope. Keep their normalize-on-read behavior and the fresh
// account epoch check as a focused mixed-version compatibility probe.
function legacyClient(storage: BrowserStorage, revision = 0) {
  const readRevision = () => {
    const raw = storage.getItem(EPOCH_KEY);
    if (raw === null) return 0;
    const envelope = JSON.parse(raw);
    if (Object.keys(envelope).sort().join(',') !== 'revision,schema_version,state' ||
      envelope.schema_version !== V2 || envelope.state !== null) {
      throw new Error('Legacy account envelope is unreadable.');
    }
    return envelope.revision as number;
  };
  const write = (value: string) => {
    if (readRevision() !== revision) throw new Error('Legacy account epoch changed.');
    storage.setItem(OUTBOX_KEY, value);
  };
  return {
    authenticate: () => {revision = readRevision();},
    lateWrite: (value: string) => runWebStorageExclusive(storage, OUTBOX_KEY, async () => write(value)),
    getAll: () => runWebStorageExclusive(storage, OUTBOX_KEY, async () => {
      const stored = storage.getItem(OUTBOX_KEY)!;
      const parsed = JSON.parse(stored);
      const sanitized = Object.keys(parsed).sort().join(',') === 'deviceId,entries,nextSequence,schemaVersion'
        ? parsed
        : {schemaVersion: 'learning-event-outbox.v2', deviceId: 'legacy_installation', nextSequence: 1, entries: []};
      if (stored !== JSON.stringify(sanitized) && readRevision() === revision) write(JSON.stringify(sanitized));
      return sanitized.entries;
    }),
  };
}

function completion(phone = PHONE) {
  return {
    accountPhoneNumber: phone, contentVersion: `sha256:${'12'.repeat(32)}`,
    phase: 'learning' as const,
    result: {
      cardId: '000001', completedAt: '2026-09-13T00:00:00.000Z',
      interactionId: 'flip' as const, isFavorited: false, outcome: 'confident' as const,
      usedHint: false, usedPeek: false,
    },
    selectionId: 'sel_1234567890abcdef', track: 'cet4' as const,
  };
}

async function legacyEnvelope() {
  const values: Record<string, string> = {};
  const outbox = new LearningEventOutbox({
    storage: createInMemoryLearningEventOutboxStorage(values),
    createDeviceId: () => 'shared_installation',
  });
  await outbox.enqueueCompletion(completion());
  await outbox.enqueueCompletion(completion(OTHER_PHONE));
  const envelope = JSON.parse(values[OUTBOX_KEY]);
  delete envelope.rejectedEntries;
  return JSON.stringify(envelope);
}

function newClient(storage: BrowserStorage) {
  const fence = createWebAccountWriteFence(storage);
  return {
    fence,
    outbox: new LearningEventOutbox({
      storage: createWebLearningEventStorage(storage, fence),
      createDeviceId: () => 'new_installation',
    }),
    store: createWebAccountDeletionStateStore(storage),
  };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {values.delete(key);},
    setItem: vi.fn((key: string, value: string) => {values.set(key, value);}),
  };
}

function failingFenceStorage(base: BrowserStorage, failure: 'write' | 'drop' | 'readback') {
  let fail = true;
  let wroteFence = false;
  return {
    recover() {fail = false;},
    storage: {
      getItem(key: string) {
        if (fail && failure === 'readback' && key === EPOCH_KEY && wroteFence) throw new Error('readback failed');
        return base.getItem(key);
      },
      removeItem: base.removeItem,
      setItem(key: string, value: string) {
        if (key === EPOCH_KEY && fail) {
          if (failure === 'write') throw new Error('write failed');
          if (failure === 'drop') return;
          wroteFence = true;
        }
        base.setItem(key, value);
      },
    },
  };
}

describe('Web outbox reader-version upgrade', () => {
  it('only recognizes the exact adopted null upgrade, never cleanup, rollback, malformed or stale notifications', () => {
    const storage = memoryStorage();
    const oldValue = JSON.stringify({schema_version: V2, revision: 7, state: null});
    const newValue = JSON.stringify({schema_version: V3, revision: 8, state: null});
    storage.setItem(EPOCH_KEY, newValue);
    expect(isCommittedWebLearningStorageUpgrade(storage, oldValue, newValue, 8)).toBe(true);
    expect(isCommittedWebLearningStorageUpgrade(storage, oldValue, newValue, 7)).toBe(false);
    for (const before of [
      {schema_version: V2, revision: 6, state: null},
      {schema_version: V3, revision: 7, state: null},
      {schema_version: V2, revision: 7, state: null, extra: true},
      ...['accepted', 'registration_ready', 'local_cleanup', 'requesting'].map(phase => ({
        schema_version: V2, revision: 7, state: {phase, owner_phone_number: PHONE},
      })),
    ]) {
      expect(isCommittedWebLearningStorageUpgrade(storage, JSON.stringify(before), newValue, 8)).toBe(false);
    }
    for (const after of [
      {schema_version: V2, revision: 8, state: null},
      {schema_version: V3, revision: 8, state: null, extra: true},
      {schema_version: V3, revision: 8, state: {phase: 'accepted', owner_phone_number: PHONE}},
    ]) {
      const candidate = JSON.stringify(after);
      storage.setItem(EPOCH_KEY, candidate);
      expect(isCommittedWebLearningStorageUpgrade(storage, oldValue, candidate, 8)).toBe(false);
    }
    expect(isCommittedWebLearningStorageUpgrade(storage, oldValue, newValue, 8)).toBe(false);
  });

  it('reproduces the old reader erasing a fifth-field envelope without a version fence', async () => {
    const storage = memoryStorage();
    const value = JSON.parse(await legacyEnvelope());
    storage.setItem(OUTBOX_KEY, JSON.stringify({...value, rejectedEntries: []}));
    await legacyClient(storage).getAll();
    expect(JSON.parse(storage.getItem(OUTBOX_KEY)!)).toMatchObject({entries: [], nextSequence: 1});
  });

  it('preserves pending, rejected and device cursor against old reads, late writes and reauthentication', async () => {
    const storage = memoryStorage();
    const original = await legacyEnvelope();
    storage.setItem(OUTBOX_KEY, original);
    const old = legacyClient(storage);
    expect(await old.getAll()).toHaveLength(2);
    const current = newClient(storage);
    await current.outbox.hydrate();
    expect(storage.getItem(OUTBOX_KEY)).toBe(original);
    current.fence.bindSessionRevision(await current.store.prepareLearningEventStorage!());
    const entries = await current.outbox.getAll();
    await current.outbox.rejectIfUnchanged(entries[0], 'learning_event_selection_conflict');
    const migrated = storage.getItem(OUTBOX_KEY);
    expect(JSON.parse(migrated!)).toMatchObject({
      deviceId: 'shared_installation', nextSequence: 3, entries: [entries[1]], rejectedEntries: [{entry: entries[0]}],
    });
    await expect(old.getAll()).rejects.toThrow('unreadable');
    await expect(old.lateWrite(original)).rejects.toThrow('unreadable');
    expect(() => old.authenticate()).toThrow('unreadable');
    expect(storage.getItem(OUTBOX_KEY)).toBe(migrated);
  });

  it('upgrades two new tabs once and keeps their later authenticated writes in the same epoch', async () => {
    const storage = memoryStorage();
    const first = newClient(storage);
    const second = newClient(storage);
    await Promise.all([first.outbox.hydrate(), second.outbox.hydrate()]);
    const revisions = await Promise.all([first.store.prepareLearningEventStorage!(), second.store.prepareLearningEventStorage!()]);
    expect(revisions).toEqual([1, 1]);
    first.fence.bindSessionRevision(revisions[0]);
    second.fence.bindSessionRevision(revisions[1]);
    await first.outbox.enqueueCompletion(completion());
    expect(await second.store.prepareLearningEventStorage!()).toBe(1);
    await second.outbox.enqueueCompletion(completion(OTHER_PHONE));
    expect(await first.outbox.getAll()).toHaveLength(2);
    expect(first.fence.captureAuthenticatedRevision()).toBe(1);
    expect(storage.setItem.mock.calls.filter(([key]) => key === EPOCH_KEY)).toHaveLength(1);
    expect(JSON.parse(storage.getItem(OUTBOX_KEY)!).nextSequence).toBe(3);
  });

  it.each(['write', 'drop', 'readback'] as const)('keeps the legacy outbox byte-exact on fence %s failure and retries after restart', async failure => {
    const base = memoryStorage();
    const original = await legacyEnvelope();
    base.setItem(OUTBOX_KEY, original);
    const injected = failingFenceStorage(base, failure);
    const store = createWebAccountDeletionStateStore(injected.storage);
    await expect(store.prepareLearningEventStorage!()).rejects.toThrow();
    expect(base.getItem(OUTBOX_KEY)).toBe(original);
    expect(base.setItem.mock.calls.filter(([key]) => key === OUTBOX_KEY)).toHaveLength(1);
    injected.recover();
    const restarted = newClient(injected.storage);
    await restarted.outbox.hydrate();
    restarted.fence.bindSessionRevision(await restarted.store.prepareLearningEventStorage!());
    expect(await restarted.outbox.getAll()).toHaveLength(2);
    expect(await restarted.store.getRevision()).toBe(1);
  });

  it('keeps a committed fence after the outbox migration write fails and retries without losing pending events', async () => {
    const base = memoryStorage();
    const original = await legacyEnvelope();
    base.setItem(OUTBOX_KEY, original);
    let fail = true;
    const storage: BrowserStorage = {...base, setItem(key, value) {
      if (fail && key === OUTBOX_KEY) throw new Error('outbox write failed');
      base.setItem(key, value);
    }};
    const current = newClient(storage);
    await current.outbox.hydrate();
    current.fence.bindSessionRevision(await current.store.prepareLearningEventStorage!());
    await expect(current.outbox.getAll()).rejects.toThrow('无法保存');
    expect(storage.getItem(OUTBOX_KEY)).toBe(original);
    expect(() => legacyClient(storage).authenticate()).toThrow('unreadable');
    fail = false;
    const restarted = newClient(storage);
    await restarted.outbox.hydrate();
    restarted.fence.bindSessionRevision(await restarted.store.prepareLearningEventStorage!());
    expect(await restarted.outbox.getAll()).toHaveLength(2);
    expect(await restarted.store.getRevision()).toBe(1);
  });

  it.each(['requesting', 'accepted', 'registration_ready', 'local_cleanup'] as const)('refuses ordinary upgrade during %s without changing the authority or outbox', async phase => {
    const storage = memoryStorage();
    const original = await legacyEnvelope();
    storage.setItem(OUTBOX_KEY, original);
    const marker = JSON.stringify({schema_version: V2, revision: 8, state: {owner_phone_number: PHONE, phase}});
    storage.setItem(EPOCH_KEY, marker);
    await expect(createWebAccountDeletionStateStore(storage).prepareLearningEventStorage!()).rejects.toThrow('恢复入口');
    expect(storage.getItem(EPOCH_KEY)).toBe(marker);
    expect(storage.getItem(OUTBOX_KEY)).toBe(original);
  });

  it.each(['accepted', 'registration_ready', 'local_cleanup'] as const)('fences old cleanup before writing a five-field outbox while preserving exact %s authority', async phase => {
    const storage = memoryStorage();
    storage.setItem(OUTBOX_KEY, await legacyEnvelope());
    storage.setItem(EPOCH_KEY, JSON.stringify({schema_version: V2, revision: 8, state: {owner_phone_number: PHONE, phase}}));
    const current = newClient(storage);
    await current.outbox.hydrate();
    const original = storage.getItem(OUTBOX_KEY);
    await current.fence.runAccountCleanup({ownerPhoneNumber: PHONE, revision: 8}, async () => {
      expect(JSON.parse(storage.getItem(EPOCH_KEY)!)).toEqual({schema_version: V3, revision: 8, state: {owner_phone_number: PHONE, phase}});
      expect(storage.getItem(OUTBOX_KEY)).toBe(original);
      await current.outbox.clearAccount(PHONE);
    });
    expect((await current.outbox.getAll()).map(entry => entry.accountPhoneNumber)).toEqual([OTHER_PHONE]);
    await current.store.clear({phoneNumber: PHONE, phase, revision: 8});
    expect(JSON.parse(storage.getItem(EPOCH_KEY)!)).toEqual({schema_version: V3, revision: 9, state: null});
    expect(() => legacyClient(storage).authenticate()).toThrow('unreadable');
  });

  it.each(['write', 'drop', 'readback'] as const)('never starts cleanup or changes queues after a cleanup fence %s failure', async failure => {
    const base = memoryStorage();
    const original = await legacyEnvelope();
    base.setItem(OUTBOX_KEY, original);
    base.setItem(EPOCH_KEY, JSON.stringify({schema_version: V2, revision: 8, state: {owner_phone_number: PHONE, phase: 'accepted'}}));
    const injected = failingFenceStorage(base, failure);
    const fence = createWebAccountWriteFence(injected.storage);
    const cleanup = vi.fn(async () => undefined);
    await expect(fence.runAccountCleanup({ownerPhoneNumber: PHONE, revision: 8}, cleanup)).rejects.toThrow();
    expect(cleanup).not.toHaveBeenCalled();
    expect(base.getItem(OUTBOX_KEY)).toBe(original);
  });
});
