import {
  createLearningStateRepository,
  createLearningStateSnapshot,
} from '../src/sync/learningStateRepository';

describe('learningStateRepository', () => {
  it('builds a learning state snapshot across learning and review phases', () => {
    const snapshot = createLearningStateSnapshot({
      dayKey: '2026-04-27',
      learningResults: [
        {
          cardId: '100101',
          completedAt: '2026-04-27T00:00:00.000Z',
          interactionId: 'flip',
          outcome: 'confident',
          usedHint: false,
          usedPeek: false,
          isFavorited: true,
        },
      ],
      learningSession: {
        sourceId: 'remote-source',
        sourceLabel: '远端卡源',
        track: 'cet4',
      },
      reviewResults: [
        {
          cardId: '100102',
          completedAt: '2026-04-27T00:05:00.000Z',
          interactionId: 'multiple_choice',
          outcome: 'correct',
          usedHint: true,
          usedPeek: false,
          isFavorited: false,
        },
      ],
    });

    expect(snapshot).toEqual({
      dayKey: '2026-04-27',
      events: [
        {
          cardId: '100101',
          completedAt: '2026-04-27T00:00:00.000Z',
          interactionId: 'flip',
          outcome: 'confident',
          usedHint: false,
          usedPeek: false,
          isFavorited: true,
          phase: 'learning',
        },
        {
          cardId: '100102',
          completedAt: '2026-04-27T00:05:00.000Z',
          interactionId: 'multiple_choice',
          outcome: 'correct',
          usedHint: true,
          usedPeek: false,
          isFavorited: false,
          phase: 'review',
        },
      ],
      sourceId: 'remote-source',
      sourceLabel: '远端卡源',
      track: 'cet4',
    });
  });

  it('posts learning state snapshots to the remote endpoint', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
    }));
    const repository = createLearningStateRepository({
      fetchImpl: fetchImpl as never,
      mode: 'remote',
      remoteConfig: {
        endpoint: 'https://api.softbook.example/v1/learning/state-sync',
        headers: {
          'x-softbook-client': 'mobile',
        },
      },
    });
    const snapshot = createLearningStateSnapshot({
      dayKey: '2026-04-27',
      learningResults: [
        {
          cardId: '100101',
          completedAt: '2026-04-27T00:00:00.000Z',
          interactionId: 'flip',
          outcome: 'review',
          usedHint: false,
          usedPeek: true,
          isFavorited: true,
        },
      ],
      learningSession: {
        sourceId: 'remote-source',
        sourceLabel: '远端卡源',
        track: 'cet4',
      },
      reviewResults: [],
    });

    await repository.syncLearningState(
      {
        authToken: 'remote-token',
        phoneNumber: '13800138000',
      },
      snapshot,
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.softbook.example/v1/learning/state-sync',
      expect.objectContaining({
        body: expect.stringContaining('"phase":"learning"'),
        headers: expect.objectContaining({
          Authorization: 'Bearer remote-token',
          'content-type': 'application/json',
          'x-softbook-client': 'mobile',
        }),
        method: 'POST',
      }),
    );
  });
});
