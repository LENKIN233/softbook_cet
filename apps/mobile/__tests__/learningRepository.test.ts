import { localLearningCardRecords } from '../src/learning/localCardRecords';
import { createLearningSessionRepository } from '../src/learning/learningRepository';

const authenticatedContext = {
  authToken: 'user-token',
  phoneNumber: '13800138000',
};

test('local learning session repository loads a usable session', async () => {
  const repository = createLearningSessionRepository({
    mode: 'local',
  });

  const session = await repository.loadSession(authenticatedContext, 'cet4');

  expect(session.track).toBe('cet4');
  expect(session.contentVersion).toBeNull();
  expect(session.cards).toHaveLength(5);
  expect(session.cards.map(card => card.interaction_id)).toEqual([
    'flip',
    'multiple_choice',
    'lock',
    'elimination',
    'swipe',
  ]);
});

test('learning session repository rejects empty sessions', async () => {
  const repository = createLearningSessionRepository({
    mode: 'local',
    localSource: {
      sourceId: 'empty-source',
      sourceLabel: '空卡源',
      loadCards: () => [],
    },
  });

  await expect(
    repository.loadSession(authenticatedContext, 'cet4'),
  ).rejects.toThrow('Learning session repository returned an empty session.');
});

test('remote learning session repository delegates to remote source loading', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      source_id: 'remote-learning-cards',
      source_label: '远端卡源',
      track: 'cet4',
      cards: localLearningCardRecords,
    }),
  });

  const repository = createLearningSessionRepository({
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://example.com/api/learning/cards',
    },
    fetchImpl: fetchMock,
  });

  const session = await repository.loadSession(authenticatedContext, 'cet4');

  expect(session.sourceId).toBe('remote-learning-cards');
  expect(session.contentVersion).toBeNull();
  expect(session.catalogCards).toHaveLength(localLearningCardRecords.length);
  expect(session.cards).toHaveLength(5);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('remote learning session repository falls back to local cards when remote source fails', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: false,
    status: 503,
    json: async () => ({}),
  });

  const repository = createLearningSessionRepository({
    fallbackToLocalOnRemoteError: true,
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://example.com/api/learning/cards',
    },
    fetchImpl: fetchMock,
  });

  const session = await repository.loadSession(authenticatedContext, 'cet4');

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(session.sourceId).toBe('local-structured-card-source');
  expect(session.sourceLabel).toBe('系统顺序学习');
  expect(session.cards).toHaveLength(5);
});

test('remote learning session repository never hides authorization failure behind local fallback', async () => {
  const repository = createLearningSessionRepository({
    fallbackToLocalOnRemoteError: true,
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://example.com/api/learning/cards',
    },
    fetchImpl: jest.fn().mockResolvedValue({
      json: async () => ({}),
      ok: false,
      status: 401,
    }),
  });

  await expect(
    repository.loadSession(authenticatedContext, 'cet4'),
  ).rejects.toMatchObject({ status: 401 });
});

test('remote learning session repository still surfaces remote failures when fallback is disabled', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: false,
    status: 503,
    json: async () => ({}),
  });

  const repository = createLearningSessionRepository({
    fallbackToLocalOnRemoteError: false,
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://example.com/api/learning/cards',
    },
    fetchImpl: fetchMock,
  });

  await expect(
    repository.loadSession(authenticatedContext, 'cet4'),
  ).rejects.toThrow(
    'Remote learning card source request failed with status 503.',
  );
});
