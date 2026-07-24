import {
  applySpaceActionToMap,
  createSpaceAction,
  createSpaceStateRepository,
  createSpaceStateSnapshot,
  parseRemoteSpaceActionAck,
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

  it('treats prototype-like card ids as data keys', () => {
    expect(
      applySpaceActionToMap(
        {},
        {
          actionId: 'space-prototype-card',
          cardId: 'toString',
          clientOccurredAt: '2026-04-27T10:00:00.000Z',
          dimension: 'favorite',
          value: true,
        },
      ),
    ).toEqual({
      toString: {
        isFavorited: true,
        isSleeping: false,
        lastModifiedAt: '2026-04-27T10:00:00.000Z',
      },
    });
  });

  it('posts only immutable v2 actions and accepts a strict canonical ack', async () => {
    const action = createSpaceAction({
      cardId: 'card-1',
      dimension: 'favorite',
      now: () => new Date('2026-04-27T10:00:00.000Z'),
      random: () => 0.5,
      value: true,
    });
    const canonicalPayload = {
      data: {
        acknowledged_at: '2026-04-27T10:00:01.000Z',
        content_version: `sha256:${'a'.repeat(64)}`,
        results: [{ action_id: action.actionId, status: 'applied' }],
        schema_version: 'space-actions-ack.v2',
        space_state: {
          acknowledged_at: '2026-04-27T10:00:01.000Z',
          content_version: `sha256:${'a'.repeat(64)}`,
          schema_version: 'space-state.v2',
          states: [
            {
              card_id: 'card-1',
              is_favorited: true,
              is_sleeping: false,
              last_modified_at: '2026-04-27T11:00:00.000Z',
            },
          ],
          track: 'cet4',
        },
        track: 'cet4',
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
      remoteConfig: { endpoint: 'https://api.example/v2/space/actions' },
    });

    const result = await repository.applyActions(
      context,
      {
        actions: [action],
        contentVersion: `sha256:${'a'.repeat(64)}`,
        track: 'cet4',
      },
      '2026-04-27',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/v2/space/actions',
      expect.objectContaining({
        body: JSON.stringify({
          schema_version: 'space-actions.v2',
          track: 'cet4',
          content_version: `sha256:${'a'.repeat(64)}`,
          actions: [
            {
              action_id: action.actionId,
              card_id: 'card-1',
              dimension: 'favorite',
              value: true,
              client_occurred_at: '2026-04-27T10:00:00.000Z',
            },
          ],
        }),
        method: 'POST',
      }),
    );
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toContain(
      '13800138000',
    );
    expect(result.results).toEqual([
      { actionId: action.actionId, status: 'applied' },
    ]);
    expect(result.snapshot.states[0]).toMatchObject({
      cardId: 'card-1',
      isFavorited: true,
      isSleeping: false,
    });
  });

  it('rejects an acknowledgement whose result order is not exact', async () => {
    const action = createSpaceAction({
      cardId: 'card-1',
      dimension: 'sleep',
      now: () => new Date('2026-04-27T10:00:00.000Z'),
      random: () => 0.25,
      value: true,
    });
    const repository = createSpaceStateRepository({
      fetchImpl: async () => ({
        json: async () => ({
          data: {
            acknowledged_at: '2026-04-27T10:00:01.000Z',
            content_version: `sha256:${'a'.repeat(64)}`,
            results: [{ action_id: 'another-action', status: 'applied' }],
            schema_version: 'space-actions-ack.v2',
            space_state: {
              acknowledged_at: '2026-04-27T10:00:01.000Z',
              content_version: `sha256:${'a'.repeat(64)}`,
              schema_version: 'space-state.v2',
              states: [],
              track: 'cet4',
            },
            track: 'cet4',
          },
        }),
        ok: true,
        status: 200,
      }),
      mode: 'remote',
      remoteConfig: { endpoint: 'https://api.example/v2/space/actions' },
    });

    await expect(
      repository.applyActions(
        context,
        {
          actions: [action],
          contentVersion: `sha256:${'a'.repeat(64)}`,
          track: 'cet4',
        },
        '2026-04-27',
      ),
    ).rejects.toThrow('does not match its command');
  });

  it('rejects an impossible canonical acknowledgement calendar timestamp', () => {
    const action = createSpaceAction({
      cardId: 'card-1',
      dimension: 'favorite',
      now: () => new Date('2026-04-27T10:00:00.000Z'),
      random: () => 0.5,
      value: true,
    });

    expect(() =>
      parseRemoteSpaceActionAck(
        {
          data: {
            acknowledged_at: '2026-04-27T10:00:01.000Z',
            content_version: `sha256:${'a'.repeat(64)}`,
            results: [{ action_id: action.actionId, status: 'applied' }],
            schema_version: 'space-actions-ack.v2',
            space_state: {
              acknowledged_at: '2026-02-30T10:00:01.000Z',
              content_version: `sha256:${'a'.repeat(64)}`,
              schema_version: 'space-state.v2',
              states: [],
              track: 'cet4',
            },
            track: 'cet4',
          },
        },
        {
          command: {
            actions: [action],
            contentVersion: `sha256:${'a'.repeat(64)}`,
            track: 'cet4',
          },
          dayKey: '2026-04-27',
        },
      ),
    ).toThrow(
      'response.data.space_state.acknowledged_at must be an RFC3339 timestamp',
    );
  });

  it('rejects an unsorted canonical projection instead of normalizing it', () => {
    expect(() =>
      parseRemoteSpaceActionAck(
        {
          data: {
            acknowledged_at: '2026-04-27T10:00:01.000Z',
            content_version: `sha256:${'a'.repeat(64)}`,
            results: [{ action_id: 'space_sorted_ack', status: 'applied' }],
            schema_version: 'space-actions-ack.v2',
            space_state: {
              acknowledged_at: '2026-04-27T10:00:01.000Z',
              content_version: `sha256:${'a'.repeat(64)}`,
              schema_version: 'space-state.v2',
              states: [
                {
                  card_id: 'card-2',
                  is_favorited: true,
                  is_sleeping: false,
                  last_modified_at: '2026-04-27T10:00:00.000Z',
                },
                {
                  card_id: 'card-1',
                  is_favorited: false,
                  is_sleeping: true,
                  last_modified_at: '2026-04-27T10:00:00.000Z',
                },
              ],
              track: 'cet4',
            },
            track: 'cet4',
          },
        },
        {
          command: {
            actions: [
              {
                actionId: 'space_sorted_ack',
                cardId: 'card-1',
                clientOccurredAt: '2026-04-27T10:00:00.000Z',
                dimension: 'favorite',
                value: true,
              },
            ],
            contentVersion: `sha256:${'a'.repeat(64)}`,
            track: 'cet4',
          },
          dayKey: '2026-04-27',
        },
      ),
    ).toThrow('must be sorted by card_id');
  });
});
