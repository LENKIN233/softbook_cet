import { localLearningCardRecords } from '../src/learning/localCardRecords';
import { createLearningSessionRepository } from '../src/learning/learningRepository';
import { parseSoftbookRemoteLearningCardSourcePayload } from '../src/learning/remoteCardSource';

const CONTENT_VERSION = `sha256:${'a'.repeat(64)}`;
const SELECTION_ID = 'sel_1234567890abcdef';

const authenticatedContext = {
  authToken: 'user-token',
  phoneNumber: '13800138000',
};

function createSourcePayload() {
  return {
    data: {
      source: {
        id: 'remote-learning-cards',
        label: '远端卡源',
      },
      track: 'cet4',
      card_records: localLearningCardRecords,
      content_version: CONTENT_VERSION,
    },
  };
}

function createSessionPayload(
  overrides: {
    contentVersion?: string;
    selection?: {
      selection_id: string;
      card_id: string;
      phase: 'learning' | 'review';
      reason: 'catalog_new' | 'due_review' | 'persisted_cursor';
      due_at: string | null;
    } | null;
    sourceId?: string;
    totalCardCount?: number;
  } = {},
) {
  const totalCardCount =
    overrides.totalCardCount ?? localLearningCardRecords.length;

  return {
    data: {
      schema_version: 'learning-session.v1',
      generated_at: '2026-07-24T08:00:00.000Z',
      track: 'cet4',
      content_version: overrides.contentVersion ?? CONTENT_VERSION,
      source_id: overrides.sourceId ?? 'remote-learning-cards',
      membership_stage: 'trial',
      algorithm: {
        id: 'FSRS-6',
        library: 'ts-fsrs',
        library_version: '5.4.1',
        policy_version: 'softbook-fsrs.v1',
      },
      access: {
        mode: 'full',
        accessible_card_count: totalCardCount,
        total_card_count: totalCardCount,
      },
      selection:
        overrides.selection === undefined
          ? {
              selection_id: SELECTION_ID,
              card_id: localLearningCardRecords[2].card_id,
              phase: 'learning',
              reason: 'catalog_new',
              due_at: null,
            }
          : overrides.selection,
      next_due_at: null,
    },
  };
}

function createRemoteRepository(fetchImpl: jest.Mock) {
  return createLearningSessionRepository({
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://example.com/v1/learning/card-source',
      parsePayload: parseSoftbookRemoteLearningCardSourcePayload,
    },
    remoteSessionConfig: {
      endpoint: 'https://example.com/v2/learning/session',
    },
    fetchImpl,
  });
}

test('local learning session repository loads a usable session', async () => {
  const repository = createLearningSessionRepository({
    mode: 'local',
  });

  const session = await repository.loadSession(authenticatedContext, 'cet4');

  expect(session.track).toBe('cet4');
  expect(session.contentVersion).toBeNull();
  expect(session.membershipStage).toBeNull();
  expect(session.schedulingMode).toBe('local');
  expect(session.serverSelection).toBeNull();
  expect(session.cards).toHaveLength(5);
  expect(session.cards.map(card => card.interaction_id)).toEqual([
    'flip',
    'multiple_choice',
    'lock',
    'elimination',
    'swipe',
  ]);
});

test('local learning session repository rejects empty sessions', async () => {
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

test('remote repository renders only the server-selected canonical card', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => createSourcePayload(),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => createSessionPayload(),
    });
  const repository = createRemoteRepository(fetchMock);

  const session = await repository.loadSession(authenticatedContext, 'cet4');

  expect(session).toMatchObject({
    contentVersion: CONTENT_VERSION,
    membershipStage: 'trial',
    nextDueAt: null,
    schedulingMode: 'server',
    serverSelection: {
      cardId: localLearningCardRecords[2].card_id,
      phase: 'learning',
      selectionId: SELECTION_ID,
    },
    sourceId: 'remote-learning-cards',
    track: 'cet4',
  });
  expect(session.catalogCards).toHaveLength(localLearningCardRecords.length);
  expect(session.cards.map(card => card.card_id)).toEqual([
    localLearningCardRecords[2].card_id,
  ]);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    'https://example.com/v1/learning/card-source?track=cet4',
    'https://example.com/v2/learning/session?track=cet4',
  ]);
});

test('remote selection null is valid and never falls back to local ordering', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => createSourcePayload(),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => createSessionPayload({ selection: null }),
    });
  const repository = createRemoteRepository(fetchMock);

  const session = await repository.loadSession(authenticatedContext, 'cet4');

  expect(session.schedulingMode).toBe('server');
  expect(session.serverSelection).toBeNull();
  expect(session.cards).toEqual([]);
  expect(session.catalogCards).toHaveLength(localLearningCardRecords.length);
});

test.each([
  {
    label: 'source',
    payload: createSessionPayload({ sourceId: 'other-source' }),
  },
  {
    label: 'content version',
    payload: createSessionPayload({
      contentVersion: `sha256:${'b'.repeat(64)}`,
    }),
  },
  {
    label: 'card count',
    payload: createSessionPayload({
      totalCardCount: localLearningCardRecords.length + 1,
    }),
  },
  {
    label: 'selected card',
    payload: createSessionPayload({
      selection: {
        selection_id: SELECTION_ID,
        card_id: '999999',
        phase: 'learning',
        reason: 'catalog_new',
        due_at: null,
      },
    }),
  },
])('remote repository rejects $label drift', async ({ payload }) => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => createSourcePayload(),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => payload,
    });
  const repository = createRemoteRepository(fetchMock);

  await expect(
    repository.loadSession(authenticatedContext, 'cet4'),
  ).rejects.toThrow();
});

test('remote repository surfaces failure without bundled-card fallback', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: false,
    status: 503,
    json: async () => ({}),
  });
  const repository = createRemoteRepository(fetchMock);

  await expect(
    repository.loadSession(authenticatedContext, 'cet4'),
  ).rejects.toThrow(
    'Remote learning card source request failed with status 503.',
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('remote repository requires both canonical endpoint configs', async () => {
  const repository = createLearningSessionRepository({
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://example.com/v1/learning/card-source',
    },
  });

  await expect(
    repository.loadSession(authenticatedContext, 'cet4'),
  ).rejects.toThrow(
    'Remote learning repository requires card-source and session configs.',
  );
});
