import {
  ACCOUNT_DELETION_RECOVERY_STORAGE_KEY,
  createAccountDeletionRecoveryStore,
} from '../src/account/accountDeletionRecoveryStore';

const PHONE = '13800138000';
function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      values.delete(key);
    }),
  };
}

test('same-phone replacement lifecycle rejects every earlier transition and cleanup receipt', async () => {
  const storage = memoryStorage();
  const store = createAccountDeletionRecoveryStore(storage);
  const oldRequest = await store.begin(PHONE, 0);
  const accepted = await store.transition(oldRequest, 'accepted');
  const ready = await store.transition(accepted, 'registration_ready');
  const cleared = await store.runCleanup(
    ready,
    async () => undefined,
    () => true,
  );
  const replacement = await createAccountDeletionRecoveryStore(storage).begin(
    PHONE,
    cleared.revision,
  );
  const erase = jest.fn(async () => undefined);
  await expect(store.transition(oldRequest, 'accepted')).rejects.toThrow();
  await expect(
    store.transition(accepted, 'registration_ready'),
  ).rejects.toThrow();
  await expect(store.runCleanup(ready, erase, () => true)).rejects.toThrow();
  expect(erase).not.toHaveBeenCalled();
  expect(await store.load()).toEqual(replacement);
});

test('remount reads wait until in-flight exact cleanup has ended and a revoked cleanup keeps its recovery marker', async () => {
  const storage = memoryStorage();
  const store = createAccountDeletionRecoveryStore(storage);
  const request = await store.begin(PHONE, 0);
  const ready = await store.transition(request, 'registration_ready');
  let release!: () => void;
  const wait = new Promise<void>(resolve => {
    release = resolve;
  });
  let active = true;
  const cleanup = store.runCleanup(
    ready,
    () => wait,
    () => active,
  );
  let readCompleted = false;
  const remountRead = createAccountDeletionRecoveryStore(storage)
    .load()
    .then(value => {
      readCompleted = true;
      return value;
    });
  for (let tick = 0; tick < 10; tick += 1) await Promise.resolve();
  expect(readCompleted).toBe(false);
  active = false;
  release();
  await expect(cleanup).rejects.toThrow();
  expect(await remountRead).toEqual(ready);
});

test('silently dropped writes fail closed, exact reread enables retry, and requesting never authorizes destructive cleanup', async () => {
  const storage = memoryStorage();
  const store = createAccountDeletionRecoveryStore(storage);
  storage.setItem.mockResolvedValueOnce(undefined);
  await expect(store.begin(PHONE, 0)).rejects.toThrow('write verification');
  const receipt = await store.begin(PHONE, 0);
  const erase = jest.fn(async () => undefined);
  await expect(store.runCleanup(receipt, erase, () => true)).rejects.toThrow();
  expect(erase).not.toHaveBeenCalled();
  expect(
    JSON.parse((await storage.getItem(ACCOUNT_DELETION_RECOVERY_STORAGE_KEY))!),
  ).toEqual({
    schema_version: 'account-deletion-recovery-state.v1',
    revision: 1,
    state: { phase: 'requesting', owner_phone_number: PHONE },
  });
});

test.each([
  {
    schema_version: 'account-deletion-recovery-state.v1',
    revision: 0.5,
    state: null,
  },
  {
    schema_version: 'account-deletion-recovery-state.v1',
    revision: -1,
    state: null,
  },
  {
    schema_version: 'account-deletion-recovery-state.v1',
    revision: 1,
    state: {
      phase: 'requesting',
      owner_phone_number: PHONE,
      access_token: 'secret',
    },
  },
  {
    schema_version: 'account-deletion-recovery-state.v1',
    revision: 1,
    state: { phase: 'unknown', owner_phone_number: PHONE },
  },
])(
  'invalid persisted authority blocks recovery without overwriting data %#',
  async record => {
    const storage = memoryStorage();
    const raw = JSON.stringify(record);
    await storage.setItem(ACCOUNT_DELETION_RECOVERY_STORAGE_KEY, raw);
    const store = createAccountDeletionRecoveryStore(storage);
    await expect(store.load()).rejects.toThrow();
    await expect(store.begin(PHONE, 0)).rejects.toThrow();
    expect(await storage.getItem(ACCOUNT_DELETION_RECOVERY_STORAGE_KEY)).toBe(
      raw,
    );
  },
);
