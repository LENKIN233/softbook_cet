import { localLearningCardRecords } from '../src/learning/localCardRecords';
import { createLearningSessionRepository } from '../src/learning/learningRepository';

test('local learning session repository loads a usable session', async () => {
  const repository = createLearningSessionRepository({
    mode: 'local',
  });

  const session = await repository.loadSession('cet4');

  expect(session.track).toBe('cet4');
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

  await expect(repository.loadSession('cet4')).rejects.toThrow(
    'Learning session repository returned an empty session.',
  );
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

  const session = await repository.loadSession('cet4');

  expect(session.sourceId).toBe('remote-learning-cards');
  expect(session.cards).toHaveLength(5);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
