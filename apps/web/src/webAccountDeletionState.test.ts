import {
  createWebAccountDeletionStateStore,
  WEB_ACCOUNT_DELETION_STORAGE_KEY,
} from './webAccountDeletionState';

describe('Web account deletion durable state', () => {
  it('persists requesting and accepted phases without credentials', async () => {
    localStorage.clear();
    const store = createWebAccountDeletionStateStore(localStorage);

    await store.mark('13800138000', 'requesting');
    await expect(store.load()).resolves.toEqual({
      phase: 'requesting',
      phoneNumber: '13800138000',
    });
    await expect(store.clear()).rejects.toThrow('requires accepted state');
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

  it('fails closed on malformed state and failed write verification', async () => {
    localStorage.setItem(WEB_ACCOUNT_DELETION_STORAGE_KEY, '{}');
    const store = createWebAccountDeletionStateStore(localStorage);
    await expect(store.load()).rejects.toThrow('marker is invalid');

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
    localStorage.clear();
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
});
