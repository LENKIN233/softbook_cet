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

    const requestingAuthority = await store.beginRequesting?.(
      '13800138000',
      0,
    );
    await expect(store.load()).resolves.toEqual({
      phase: 'requesting',
      phoneNumber: '13800138000',
    });
    await expect(
      store.clear({
        phase: 'accepted',
        phoneNumber: '13800138000',
        revision: 1,
      }),
    ).rejects.toThrow('cleanup authority changed');
    await store.resolveRequesting?.(requestingAuthority!, 'accepted');
    await expect(store.load()).resolves.toEqual({
      phase: 'accepted',
      phoneNumber: '13800138000',
    });
    expect(localStorage.getItem(WEB_ACCOUNT_DELETION_STORAGE_KEY)).not.toMatch(
      /token|secret/i,
    );
    await clearCurrent(store, 'accepted');
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

    const requestingAuthority = await store.beginRequesting?.(
      '13800138000',
      0,
    );
    await store.resolveRequesting?.(requestingAuthority!, 'accepted');
    await clearCurrent(store, 'accepted');

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
    await expect(
      broken.beginRequesting?.('13800138000', 0),
    ).rejects.toThrow('verification failed');
  });

  it('prevents a stale tab from recreating a marker after accepted cleanup', async () => {
    const staleStore = createWebAccountDeletionStateStore(localStorage);
    const completingStore = createWebAccountDeletionStateStore(localStorage);

    const requestingAuthority = await completingStore.beginRequesting?.(
      '13800138000',
      0,
    );
    await completingStore.resolveRequesting?.(
      requestingAuthority!,
      'accepted',
    );
    await clearCurrent(completingStore, 'accepted');

    await expect(
      staleStore.beginRequesting?.('13800138000', 0),
    ).rejects.toThrow('null authority changed');
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

    await migratingStore.resolveRequesting?.(
      {phoneNumber: '13800138000', revision: 5},
      'accepted',
    );
    await expect(
      staleStore.beginRequesting?.('13800138000', 5),
    ).rejects.toThrow('null authority changed');
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

  it('persists local cleanup before returning to a newer null epoch', async () => {
    const staleStore = createWebAccountDeletionStateStore(localStorage);
    const terminalStore = createWebAccountDeletionStateStore(localStorage);

    await expect(
      terminalStore.ensureCleanupAuthority?.('13800138000', 0),
    ).resolves.toEqual({
      phase: 'local_cleanup',
      phoneNumber: '13800138000',
      revision: 1,
    });
    await expect(
      terminalStore.ensureCleanupAuthority?.('13800138000', 0),
    ).resolves.toEqual({
      phase: 'local_cleanup',
      phoneNumber: '13800138000',
      revision: 1,
    });
    await expect(terminalStore.load()).resolves.toEqual({
      phase: 'local_cleanup',
      phoneNumber: '13800138000',
    });
    await expect(
      staleStore.beginRequesting?.('13800138000', 0),
    ).rejects.toThrow('null authority changed');
    await clearCurrent(terminalStore, 'local_cleanup');
    await expect(terminalStore.load()).resolves.toBeNull();
    await expect(terminalStore.getRevision()).resolves.toBe(2);
  });

  it('holds the Web Lock across final null-epoch authority commit', async () => {
    const authorityStore = createWebAccountDeletionStateStore(localStorage);
    const competingStore = createWebAccountDeletionStateStore(localStorage);
    let releaseAuthority: (() => void) | undefined;
    let markAuthorityStarted: (() => void) | undefined;
    const authorityGate = new Promise<void>(resolve => {
      releaseAuthority = resolve;
    });
    const authorityStarted = new Promise<void>(resolve => {
      markAuthorityStarted = resolve;
    });
    let competingMarkSettled = false;

    const authority = authorityStore.runAtNullRevision?.(0, async () => {
      markAuthorityStarted?.();
      await authorityGate;
    });
    await authorityStarted;
    const competingMark = competingStore
      .beginRequesting!('13800138000', 0)
      .then(() => {
        competingMarkSettled = true;
      });
    await Promise.resolve();
    expect(competingMarkSettled).toBe(false);

    releaseAuthority?.();
    await authority;
    await competingMark;
    expect(competingMarkSettled).toBe(true);
  });

  it('rejects old same-phone requesting proofs after cleanup and re-registration', async () => {
    const store = createWebAccountDeletionStateStore(localStorage);
    const oldAuthority = await store.beginRequesting?.('13800138000', 0);
    expect(oldAuthority).toEqual({
      phoneNumber: '13800138000',
      revision: 1,
    });
    await expect(
      store.resolveRequesting?.(oldAuthority!, 'accepted'),
    ).resolves.toEqual({
      phase: 'accepted',
      phoneNumber: '13800138000',
      revision: 2,
    });
    await clearCurrent(store, 'accepted');
    const currentAuthority = await store.beginRequesting?.(
      '13800138000',
      3,
    );

    await expect(
      store.resolveRequesting?.(oldAuthority!, 'accepted'),
    ).rejects.toThrow('requesting authority changed');
    await expect(
      store.resolveRequesting?.(oldAuthority!, 'registration_ready'),
    ).rejects.toThrow('requesting authority changed');
    await expect(store.load()).resolves.toEqual({
      phase: 'requesting',
      phoneNumber: '13800138000',
    });
    await expect(store.getRevision()).resolves.toBe(4);
    expect(currentAuthority).toEqual({
      phoneNumber: '13800138000',
      revision: 4,
    });
  });

  it('lets only one tab resolve an exact requesting revision', async () => {
    const creatingStore = createWebAccountDeletionStateStore(localStorage);
    const authority = await creatingStore.beginRequesting?.(
      '13800138000',
      0,
    );
    const acceptingStore = createWebAccountDeletionStateStore(localStorage);
    const registrationStore = createWebAccountDeletionStateStore(localStorage);

    const outcomes = await Promise.allSettled([
      acceptingStore.resolveRequesting?.(authority!, 'accepted'),
      registrationStore.resolveRequesting?.(
        authority!,
        'registration_ready',
      ),
    ]);

    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(outcome => outcome.status === 'rejected')).toHaveLength(1);
    await expect(creatingStore.getRevision()).resolves.toBe(2);
    await expect(creatingStore.load()).resolves.toMatchObject({
      phoneNumber: '13800138000',
    });
  });

  it('does not let a later load retarget an old exact cleanup authority', async () => {
    const oldStore = createWebAccountDeletionStateStore(localStorage);
    const lifecycleStore = createWebAccountDeletionStateStore(localStorage);
    const oldRequesting = await oldStore.beginRequesting?.(
      '13800138000',
      0,
    );
    await oldStore.resolveRequesting?.(oldRequesting!, 'accepted');
    const oldCleanupAuthority = {
      phase: 'accepted' as const,
      phoneNumber: '13800138000',
      revision: 2,
    };
    await lifecycleStore.load();
    await lifecycleStore.clear(oldCleanupAuthority);
    const currentRequesting = await lifecycleStore.beginRequesting?.(
      '13800138000',
      3,
    );
    await lifecycleStore.resolveRequesting?.(
      currentRequesting!,
      'accepted',
    );

    await oldStore.load();
    await expect(oldStore.clear(oldCleanupAuthority)).rejects.toThrow(
      'cleanup authority changed',
    );
    await expect(oldStore.load()).resolves.toEqual({
      phase: 'accepted',
      phoneNumber: '13800138000',
    });
    await expect(oldStore.getRevision()).resolves.toBe(5);
  });
});

async function clearCurrent(
  store: ReturnType<typeof createWebAccountDeletionStateStore>,
  phase: 'accepted' | 'local_cleanup' | 'registration_ready',
) {
  await store.clear({
    phase,
    phoneNumber: '13800138000',
    revision: await store.getRevision(),
  });
}
