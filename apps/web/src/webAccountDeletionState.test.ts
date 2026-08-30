import {
  createWebAccountDeletionStateStore,
  WEB_ACCOUNT_DELETION_STORAGE_KEY,
} from './webAccountDeletionState';

describe('Web account deletion durable state', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists requesting and accepted phases without credentials', async () => {
    const store = createWebAccountDeletionStateStore(localStorage);

    await store.mark('13800138000', 'requesting');
    await expect(store.load()).resolves.toEqual({
      phase: 'requesting',
      phoneNumber: '13800138000',
    });
    await expect(store.clear()).rejects.toThrow('requires resolved state');
    await store.mark('13800138000', 'accepted');
    await expect(store.load()).resolves.toEqual({
      phase: 'accepted',
      phoneNumber: '13800138000',
    });
    expect(localStorage.getItem(WEB_ACCOUNT_DELETION_STORAGE_KEY)).not.toMatch(
      /token|secret/i,
    );
    await store.clear();
    await expect(store.load()).resolves.toBeNull();
  });

  it('writes each marker and revision transition through one envelope setItem', async () => {
    const values = new Map<string, string>();
    const setItem = vi.fn((key: string, value: string) => {
      values.set(key, value);
    });
    const store = createWebAccountDeletionStateStore({
      getItem: key => values.get(key) ?? null,
      removeItem: key => {
        values.delete(key);
      },
      setItem,
    });

    await store.mark('13800138000', 'requesting');
    await store.mark('13800138000', 'accepted');
    await store.clear();

    expect(setItem).toHaveBeenCalledTimes(3);
    expect(setItem.mock.calls.map(([key]) => key)).toEqual([
      WEB_ACCOUNT_DELETION_STORAGE_KEY,
      WEB_ACCOUNT_DELETION_STORAGE_KEY,
      WEB_ACCOUNT_DELETION_STORAGE_KEY,
    ]);
    await expect(store.getRevision()).resolves.toBe(3);
    await expect(store.load()).resolves.toBeNull();
  });

  it('fails closed on malformed state and failed write verification', async () => {
    localStorage.setItem(WEB_ACCOUNT_DELETION_STORAGE_KEY, '{}');
    expect(() => createWebAccountDeletionStateStore(localStorage)).toThrow(
      /fields|legacy marker/,
    );

    const broken = createWebAccountDeletionStateStore({
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    });
    await expect(broken.mark('13800138000', 'requesting')).rejects.toThrow(
      'verification failed',
    );
  });

  it('prevents a stale tab from recreating a marker after accepted cleanup', async () => {
    const staleStore = createWebAccountDeletionStateStore(localStorage);
    const completingStore = createWebAccountDeletionStateStore(localStorage);

    await completingStore.mark('13800138000', 'requesting');
    await completingStore.mark('13800138000', 'accepted');
    await completingStore.clear();

    await expect(
      staleStore.mark('13800138000', 'requesting'),
    ).rejects.toThrow('changed in another tab');
    await expect(completingStore.load()).resolves.toBeNull();
  });

  it('atomically migrates a torn legacy marker and fences concurrent tabs', async () => {
    localStorage.setItem(
      WEB_ACCOUNT_DELETION_STORAGE_KEY,
      JSON.stringify({
        owner_phone_number: '13800138000',
        phase: 'requesting',
        schema_version: 'web-account-deletion.v1',
      }),
    );
    localStorage.setItem(
      'softbook-cet/web-account-deletion-revision/v1',
      '4',
    );
    const migratingStore = createWebAccountDeletionStateStore(localStorage);
    const staleStore = createWebAccountDeletionStateStore(localStorage);

    await expect(migratingStore.load()).resolves.toEqual({
      phase: 'requesting',
      phoneNumber: '13800138000',
    });
    await expect(migratingStore.getRevision()).resolves.toBe(5);
    expect(
      JSON.parse(
        localStorage.getItem(WEB_ACCOUNT_DELETION_STORAGE_KEY) ?? '',
      ),
    ).toEqual({
      revision: 5,
      schema_version: 'web-account-deletion-envelope.v2',
      state: {
        owner_phone_number: '13800138000',
        phase: 'requesting',
      },
    });
    expect(
      localStorage.getItem(
        'softbook-cet/web-account-deletion-revision/v1',
      ),
    ).toBeNull();

    await migratingStore.mark('13800138000', 'accepted');
    await expect(
      staleStore.mark('13800138000', 'requesting'),
    ).rejects.toThrow('changed in another tab');
  });

  it('migrates a legacy cleared revision into a null-state envelope', async () => {
    localStorage.setItem(
      'softbook-cet/web-account-deletion-revision/v1',
      '7',
    );
    const store = createWebAccountDeletionStateStore(localStorage);

    await expect(store.load()).resolves.toBeNull();
    await expect(store.getRevision()).resolves.toBe(7);
    expect(
      JSON.parse(
        localStorage.getItem(WEB_ACCOUNT_DELETION_STORAGE_KEY) ?? '',
      ),
    ).toEqual({
      revision: 7,
      schema_version: 'web-account-deletion-envelope.v2',
      state: null,
    });
  });
});
