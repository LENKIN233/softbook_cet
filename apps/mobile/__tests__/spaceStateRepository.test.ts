import {
  createSpaceStateRepository,
  createSpaceStateSnapshot,
  mergeSpaceStateMaps,
} from '../src/space/spaceStateRepository';

const context = {
  authToken: 'remote-token',
  phoneNumber: '13800138000',
};

describe('spaceStateRepository', () => {
  it('preserves the explicit action timestamp for every touched card', () => {
    const snapshot = createSpaceStateSnapshot({
      dayKey: '2026-04-27',
      spaceCardStateById: {
        'card-2': {
          isFavorited: false,
          isSleeping: true,
          lastModifiedAt: '2026-04-27T11:00:00.000Z',
        },
        'card-1': {
          isFavorited: true,
          isSleeping: false,
          lastModifiedAt: '2026-04-27T10:00:00.000Z',
        },
      },
    });

    expect(snapshot).toEqual({
      dayKey: '2026-04-27',
      states: [
        {
          cardId: 'card-1',
          isFavorited: true,
          isSleeping: false,
          lastModifiedAt: '2026-04-27T10:00:00.000Z',
        },
        {
          cardId: 'card-2',
          isFavorited: false,
          isSleeping: true,
          lastModifiedAt: '2026-04-27T11:00:00.000Z',
        },
      ],
    });
  });

  it('lets newer server state win while preserving newer offline actions', () => {
    const merged = mergeSpaceStateMaps(
      {
        stale: {
          isFavorited: false,
          isSleeping: false,
          lastModifiedAt: '2026-04-27T09:00:00.000Z',
        },
        offline: {
          isFavorited: true,
          isSleeping: true,
          lastModifiedAt: '2026-04-27T12:00:00.000Z',
        },
      },
      {
        dayKey: '2026-04-27',
        states: [
          {
            cardId: 'stale',
            isFavorited: true,
            isSleeping: false,
            lastModifiedAt: '2026-04-27T11:00:00.000Z',
          },
          {
            cardId: 'offline',
            isFavorited: false,
            isSleeping: false,
            lastModifiedAt: '2026-04-27T10:00:00.000Z',
          },
        ],
      },
    );

    expect(merged.stale.isFavorited).toBe(true);
    expect(merged.offline.isFavorited).toBe(true);
    expect(merged.offline.lastModifiedAt).toBe('2026-04-27T12:00:00.000Z');
  });

  it('loads canonical remote state before syncing and accepts canonical response', async () => {
    const canonicalPayload = {
      data: {
        space_state: {
          day_key: '2026-04-27',
          states: [
            {
              card_id: 'card-1',
              is_favorited: true,
              is_sleeping: false,
              last_modified_at: '2026-04-27T11:00:00.000Z',
            },
          ],
        },
      },
    };
    const fetchMock = jest.fn(async () => ({
      json: async () => canonicalPayload,
      ok: true,
      status: 200,
    }));
    const repository = createSpaceStateRepository({
      fetchImpl: fetchMock,
      mode: 'remote',
      remoteConfig: {endpoint: 'https://api.example/v1/space/state-sync'},
    });

    const loaded = await repository.loadSpaceState(context, '2026-04-27');
    const synced = await repository.syncSpaceState(context, loaded);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example/v1/space/state-sync?day_key=2026-04-27',
      expect.objectContaining({method: 'GET'}),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example/v1/space/state-sync',
      expect.objectContaining({method: 'POST'}),
    );
    expect(synced.snapshot).toEqual(loaded);
  });
});
