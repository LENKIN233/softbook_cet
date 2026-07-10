import {
  createEmptyPersistedUserState,
  createUserStateStore,
  USER_STATE_STORAGE_KEY,
  type UserStateStorage,
} from '../src/persistence/userStateStore';

function createStorage(seed: Record<string, string> = {}) {
  const values = { ...seed };
  const storage: UserStateStorage = {
    getItem: jest.fn(async key => values[key] ?? null),
    removeItem: jest.fn(async key => {
      delete values[key];
    }),
    setItem: jest.fn(async (key, value) => {
      values[key] = value;
    }),
  };

  return { storage, values };
}

describe('UserStateStore', () => {
  it('round-trips check-in, learning cursor, favorite, and sleep state', async () => {
    const { storage } = createStorage();
    const store = createUserStateStore(storage);
    const state = {
      checkedInDayKey: '2026-07-10',
      learningCursor: {
        cardId: '110002',
        sourceId: 'local-cet4-v1',
        track: 'cet4' as const,
      },
      spaceCardStateById: {
        '110001': { isFavorited: true, isSleeping: false },
        '110003': { isFavorited: false, isSleeping: true },
      },
    };

    await store.save('13800138000', state);

    await expect(store.load('13800138000')).resolves.toEqual(state);
  });

  it('does not expose one phone number state to another account', async () => {
    const { storage } = createStorage();
    const store = createUserStateStore(storage);

    await store.save('13800138000', {
      ...createEmptyPersistedUserState(),
      checkedInDayKey: '2026-07-10',
    });

    await expect(store.load('13900139000')).resolves.toEqual(
      createEmptyPersistedUserState(),
    );
  });

  it('removes malformed data and degrades to an empty state', async () => {
    const { storage, values } = createStorage({
      [USER_STATE_STORAGE_KEY]: JSON.stringify({ schema_version: 'unknown' }),
    });
    const store = createUserStateStore(storage);
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await expect(store.load('13800138000')).resolves.toEqual(
      createEmptyPersistedUserState(),
    );
    expect(values[USER_STATE_STORAGE_KEY]).toBeUndefined();

    warn.mockRestore();
  });

  it('does not overwrite unknown state after a transient storage read error', async () => {
    const { storage } = createStorage();
    jest
      .mocked(storage.getItem)
      .mockRejectedValueOnce(new Error('AsyncStorage temporarily unavailable'));
    const store = createUserStateStore(storage);
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await expect(store.load('13800138000')).resolves.toEqual(
      createEmptyPersistedUserState(),
    );
    await store.save('13800138000', createEmptyPersistedUserState());
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it('clears only user state and leaves the mutation queue independent', async () => {
    const mutationQueueKey = '__softbook_mutation_queue';
    const { storage, values } = createStorage({
      [mutationQueueKey]: '[{"id":"queued"}]',
    });
    const store = createUserStateStore(storage);

    await store.save('13800138000', createEmptyPersistedUserState());
    await store.clear();

    expect(values[USER_STATE_STORAGE_KEY]).toBeUndefined();
    expect(values[mutationQueueKey]).toBe('[{"id":"queued"}]');
  });
});
