import {
  ACCOUNT_DELETION_CLEANUP_STORAGE_KEY,
  createAccountDeletionCleanupStore,
  type AccountDeletionCleanupStorage,
} from '../src/account/accountDeletionCleanupStore';

function createStorage() {
  const values: Record<string, string> = {};
  const storage: AccountDeletionCleanupStorage = {
    getItem: jest.fn(async key => values[key] ?? null),
    removeItem: jest.fn(async key => {
      delete values[key];
    }),
    setItem: jest.fn(async (key, value) => {
      values[key] = value;
    }),
  };
  return {storage, values};
}

test('round-trips and exactly removes pending local deletion cleanup', async () => {
  const {storage, values} = createStorage();
  const store = createAccountDeletionCleanupStore(storage);

  await store.markPending('13800138000');
  await expect(store.load()).resolves.toEqual({phoneNumber: '13800138000'});
  expect(values[ACCOUNT_DELETION_CLEANUP_STORAGE_KEY]).toContain(
    'account-deletion-local-cleanup.v1',
  );

  await store.clear();
  await expect(store.load()).resolves.toBeNull();
});

test('rejects a marker write that storage silently drops', async () => {
  const {storage} = createStorage();
  jest.mocked(storage.setItem).mockResolvedValue(undefined);
  const store = createAccountDeletionCleanupStore(storage);

  await expect(store.markPending('13800138000')).rejects.toThrow(
    'marker verification failed',
  );
});

test('rejects unknown marker fields instead of guessing cleanup scope', async () => {
  const {storage, values} = createStorage();
  values[ACCOUNT_DELETION_CLEANUP_STORAGE_KEY] = JSON.stringify({
    owner_phone_number: '13800138000',
    schema_version: 'account-deletion-local-cleanup.v1',
    status: 'accepted',
  });
  const store = createAccountDeletionCleanupStore(storage);

  await expect(store.load()).rejects.toThrow('marker is invalid');
});
