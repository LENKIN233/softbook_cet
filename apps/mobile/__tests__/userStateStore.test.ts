import {
  createEmptyPersistedUserState,
  createUserStateStore,
  LEGACY_SPACE_STATE_TIMESTAMP,
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
  it('keeps check-in when only the optional local round is damaged', async () => {
    const {storage, values} = createStorage();
    const store = createUserStateStore(storage);
    await store.save('13800138000', {...createEmptyPersistedUserState(), checkedInDayKey: '2026-09-21'});
    const payload = JSON.parse(values[USER_STATE_STORAGE_KEY]);
    payload.local_learning_progress = {learningResults: 'damaged'};
    values[USER_STATE_STORAGE_KEY] = JSON.stringify(payload);
    const restored = await store.load('13800138000');
    expect(restored.checkedInDayKey).toBe('2026-09-21');
    expect(restored.localLearningProgress).toBeNull();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it('round-trips local results without exposing them to another account', async () => {
    const {storage} = createStorage();
    const store = createUserStateStore(storage);
    const state = {...createEmptyPersistedUserState(), localLearningProgress: {
      dayKey: '2026-09-21', sourceId: 'test-round', track: 'cet4' as const,
      phase: 'review' as const, cursorCardId: null, reviewCardIds: ['test-card'],
      learningResults: [{cardId: 'test-card', interactionId: 'flip' as const,
        outcome: 'review' as const, completedAt: '2026-09-21T01:00:00Z',
        usedHint: false, usedPeek: false, isFavorited: false}], reviewResults: [],
    }};
    await store.save('13800138000', state);
    await expect(createUserStateStore(storage).load('13800138000')).resolves.toEqual(state);
    await expect(store.load('13900139000')).resolves.toEqual(createEmptyPersistedUserState());
    expect(() => store.save('13800138000', {...state, localLearningProgress: {
      ...state.localLearningProgress,
      learningResults: [...state.localLearningProgress.learningResults, ...state.localLearningProgress.learningResults],
    }})).toThrow();
    await store.clear();
    await expect(store.load('13800138000')).resolves.toEqual(createEmptyPersistedUserState());
  });
  it('keeps real-library state separate from example records with reused card IDs', async () => {
    const {storage, values} = createStorage();
    const oldStore = createUserStateStore(storage);
    await oldStore.save('13800138000', {...createEmptyPersistedUserState(),
      learningCursor: {cardId: '002001', sourceId: 'local-structured-card-source', track: 'cet4'},
      spaceCardStateById: {'002001': {isFavorited: true, isSleeping: true, lastModifiedAt: '2026-07-10T10:00:00.000Z'}},
    });
    const before = values[USER_STATE_STORAGE_KEY];
    const realStore = createUserStateStore(storage, 'softbook-cet/user-state/bundled-card-make-v1');
    await expect(realStore.load('13800138000')).resolves.toEqual(createEmptyPersistedUserState());
    await realStore.save('13800138000', createEmptyPersistedUserState());
    await realStore.clear();
    expect(values[USER_STATE_STORAGE_KEY]).toBe(before);
  });
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
        '110001': {
          isFavorited: true,
          isSleeping: false,
          lastModifiedAt: '2026-07-10T10:00:00.000Z',
        },
        '110003': {
          isFavorited: false,
          isSleeping: true,
          lastModifiedAt: '2026-07-10T11:00:00.000Z',
        },
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

  it('migrates v1 space state with a timestamp that cannot outrank server state', async () => {
    const {storage} = createStorage({
      [USER_STATE_STORAGE_KEY]: JSON.stringify({
        checked_in_day_key: null,
        learning_cursor: null,
        owner_phone_number: '13800138000',
        schema_version: 'user-state.v1',
        space_card_state_by_id: {
          '110001': {is_favorited: true, is_sleeping: false},
        },
      }),
    });
    const store = createUserStateStore(storage);

    await expect(store.load('13800138000')).resolves.toMatchObject({
      spaceCardStateById: {
        '110001': {
          isFavorited: true,
          isSleeping: false,
          lastModifiedAt: LEGACY_SPACE_STATE_TIMESTAMP,
        },
      },
    });
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
