import { localLearningCardRecords } from '../src/learning/localCardRecords';
import { createLearningSessionRepository } from '../src/learning/learningRepository';
import { parseSoftbookRemoteLearningCardSourcePayload } from '../src/learning/remoteCardSource';

const CONTENT_VERSION = `sha256:${'a'.repeat(64)}`;
const AUDIO_SHA256 = `sha256:${'b'.repeat(64)}`;
const SELECTION_ID = 'sel_1234567890abcdef';

const authenticatedContext = {
  authToken: 'user-token',
  phoneNumber: '13800138000',
};

function createSourcePayload(cardRecords = localLearningCardRecords) {
  return {
    data: {
      source: {
        id: 'remote-learning-cards',
        label: '远端卡源',
      },
      track: 'cet4',
      card_records: cardRecords,
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
    roundCompletion?: Record<string, unknown> | null;
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
      trial_started_at: '2026-07-24T08:00:00.000Z',
      trial_expires_at: '2026-07-29T08:00:00.000Z',
      trial_remaining_seconds: 432000,
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
      round_completion: overrides.roundCompletion ?? null,
    },
  };
}

function createRemoteRepository(
  fetchImpl: jest.Mock,
  contentManifestConfig: Parameters<typeof createLearningSessionRepository>[0]['contentManifestConfig'] = {
    mode: 'disabled',
  },
) {
  return createLearningSessionRepository({
    contentManifestConfig,
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://example.com/v1/learning/card-source',
      parsePayload: parseSoftbookRemoteLearningCardSourcePayload,
    },
    remoteSessionConfig: {
      continueEndpoint: 'https://example.com/v2/learning/round/continue',
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
  expect(session.contentManifest).toBeNull();
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
  expect(session.contentManifest).toBeNull();
  expect(session.cards.map(card => card.card_id)).toEqual([
    localLearningCardRecords[2].card_id,
  ]);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    'https://example.com/v1/learning/card-source?track=cet4',
    'https://example.com/v2/learning/session?track=cet4',
  ]);
});

test('remote repository binds a verified manifest to the canonical card source and session access', async () => {
  const audioCards = localLearningCardRecords.map((card, index) =>
    index === 0
      ? {
          ...card,
          audio: {
            asset_id: 'cet4.002001.prompt',
            duration_ms: 2100,
            sha256: AUDIO_SHA256,
          },
        }
      : card,
  );
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => createSourcePayload(audioCards),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => createSessionPayload(),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          access: {
            accessible_card_count: audioCards.length,
            mode: 'full',
            total_card_count: audioCards.length,
          },
          downloads: [
            {
              asset_id: 'cet4.002001.prompt',
              expires_at: '2099-01-01T00:00:00.000Z',
              url: 'https://private-content.example/cet4.mp3?token=opaque',
            },
          ],
          manifest: {
            assets: [
              {
                asset_id: 'cet4.002001.prompt',
                duration_ms: 2100,
                media_type: 'audio/mpeg',
                sha256: AUDIO_SHA256,
                size_bytes: 4096,
              },
            ],
            content_version: CONTENT_VERSION,
            minimum_client_version: '1.0.0',
            parent_release_id: null,
            release_id: 'cet4-release-1',
            schema_version: 'content-manifest.v1',
            track: 'cet4',
          },
          signature: {
            algorithm: 'ed25519',
            key_id: 'content-key-1',
            value: 'c'.repeat(128),
          },
        },
      }),
    });
  const repository = createRemoteRepository(fetchMock, {
    apiKey: 'runtime-key',
    baseUrl: 'https://example.com',
    mode: 'remote',
    verifySignature: () => true,
  });

  const session = await repository.loadSession(authenticatedContext, 'cet4');

  expect(session.contentManifest?.manifest.release_id).toBe('cet4-release-1');
  expect(session.contentManifest?.downloads).toHaveLength(1);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    'https://example.com/v1/learning/card-source?track=cet4',
    'https://example.com/v2/learning/session?track=cet4',
    `https://example.com/v2/content/manifest?track=cet4&content_version=${encodeURIComponent(CONTENT_VERSION)}`,
  ]);
});

test('remote repository rejects content-manifest access that drifts from the canonical session', async () => {
  const audioCards = localLearningCardRecords.map((card, index) =>
    index === 0
      ? {
          ...card,
          audio: {
            asset_id: 'cet4.002001.prompt',
            duration_ms: 2100,
            sha256: AUDIO_SHA256,
          },
        }
      : card,
  );
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => createSourcePayload(audioCards),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => createSessionPayload(),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          access: {
            accessible_card_count: 0,
            mode: 'trial_not_started',
            total_card_count: audioCards.length,
          },
          downloads: [],
          manifest: {
            assets: [
              {
                asset_id: 'cet4.002001.prompt',
                duration_ms: 2100,
                media_type: 'audio/mpeg',
                sha256: AUDIO_SHA256,
                size_bytes: 4096,
              },
            ],
            content_version: CONTENT_VERSION,
            minimum_client_version: '1.0.0',
            parent_release_id: null,
            release_id: 'cet4-release-1',
            schema_version: 'content-manifest.v1',
            track: 'cet4',
          },
          signature: {
            algorithm: 'ed25519',
            key_id: 'content-key-1',
            value: 'c'.repeat(128),
          },
        },
      }),
    });
  const repository = createRemoteRepository(fetchMock, {
    baseUrl: 'https://example.com',
    mode: 'remote',
    verifySignature: () => true,
  });

  await expect(
    repository.loadSession(authenticatedContext, 'cet4'),
  ).rejects.toThrow('Content manifest access does not match the canonical learning session');
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

test('remote repository preserves canonical round review order and continues the exact receipt', async () => {
  const receiptId = `prc_${'b'.repeat(43)}`;
  const reviewCardIds = [
    localLearningCardRecords[0].card_id,
    localLearningCardRecords[2].card_id,
  ];
  const roundCompletion = {
    schema_version: 'pilot-round-completion.v1',
    pilot_id: 'cet4-pilot-2026',
    content_version: CONTENT_VERSION,
    receipt_id: receiptId,
    completed_count: 5,
    space_card_id: localLearningCardRecords[4].card_id,
    review_card_ids: reviewCardIds,
  };
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
      json: async () =>
        createSessionPayload({ selection: null, roundCompletion }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          schema_version: 'pilot-round-continue-ack.v1',
          pilot_id: 'cet4-pilot-2026',
          track: 'cet4',
          content_version: CONTENT_VERSION,
          receipt_id: receiptId,
          completed_count: 5,
          acknowledged_at: '2026-07-24T08:01:00.000Z',
        },
      }),
    });
  const repository = createRemoteRepository(fetchMock);
  const session = await repository.loadSession(authenticatedContext, 'cet4');
  expect(session.roundCompletion?.reviewCardIds).toEqual(reviewCardIds);
  expect(session.cards).toEqual([]);
  await expect(
    repository.continueRound(authenticatedContext, session),
  ).resolves.toBeUndefined();
  expect(fetchMock.mock.calls[2][0]).toBe(
    'https://example.com/v2/learning/round/continue',
  );
});

test('remote repository rejects reordered or inaccessible round review cards', async () => {
  const invalidRound = {
    schema_version: 'pilot-round-completion.v1',
    pilot_id: 'cet4-pilot-2026',
    content_version: CONTENT_VERSION,
    receipt_id: `prc_${'c'.repeat(43)}`,
    completed_count: 5,
    space_card_id: localLearningCardRecords[0].card_id,
    review_card_ids: [
      localLearningCardRecords[2].card_id,
      localLearningCardRecords[0].card_id,
    ],
  };
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
      json: async () =>
        createSessionPayload({
          selection: null,
          roundCompletion: invalidRound,
        }),
    });
  await expect(
    createRemoteRepository(fetchMock).loadSession(authenticatedContext, 'cet4'),
  ).rejects.toThrow('not in canonical source order');
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

test('remote repository surfaces manifest failure without bundled-card fallback', async () => {
  const audioCards = localLearningCardRecords.map((card, index) =>
    index === 0
      ? {
          ...card,
          audio: {
            asset_id: 'cet4.002001.prompt',
            duration_ms: 2100,
            sha256: AUDIO_SHA256,
          },
        }
      : card,
  );
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => createSourcePayload(audioCards),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => createSessionPayload(),
    })
    .mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    });
  const repository = createRemoteRepository(fetchMock, {
    baseUrl: 'https://example.com',
    mode: 'remote',
    verifySignature: () => true,
  });

  await expect(
    repository.loadSession(authenticatedContext, 'cet4'),
  ).rejects.toThrow('Remote content manifest request failed with status 503');
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test('remote repository requires an explicit content-manifest mode', async () => {
  const repository = createLearningSessionRepository({
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://example.com/v1/learning/card-source',
    },
    remoteSessionConfig: {
      endpoint: 'https://example.com/v2/learning/session',
    },
  });

  await expect(
    repository.loadSession(authenticatedContext, 'cet4'),
  ).rejects.toThrow(
    'Remote learning repository requires card-source, session, and content-manifest configs.',
  );
});

test('remote repository requires card-source, session, and manifest configs', async () => {
  const repository = createLearningSessionRepository({
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://example.com/v1/learning/card-source',
    },
  });

  await expect(
    repository.loadSession(authenticatedContext, 'cet4'),
  ).rejects.toThrow(
    'Remote learning repository requires card-source, session, and content-manifest configs.',
  );
});
