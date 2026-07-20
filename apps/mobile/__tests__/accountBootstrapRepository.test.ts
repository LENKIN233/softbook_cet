import {
  createAccountBootstrapRepository,
  createSoftbookRemoteAccountBootstrapConfig,
  parseAccountBootstrapPayload,
} from '../src/bootstrap/accountBootstrapRepository';
import { RemoteHttpError } from '../src/runtime/remoteHttpError';

const DAY_KEY = '2026-07-20';
const CONTENT_VERSION = `sha256:${'a'.repeat(64)}`;

function createBootstrapPayload(): any {
  return {
    data: {
      schema_version: 'bootstrap.v2',
      generated_at: '2026-07-20T10:00:00.000Z',
      day_key: DAY_KEY,
      track: 'cet4',
      content: {
        card_count: 5,
        release_id: null,
        minimum_client_version: null,
        parent_release_id: null,
        published_at: null,
        source: {
          id: 'cloudbase-dev-card-source',
          label: 'CloudBase development card source',
        },
        version: CONTENT_VERSION,
      },
      learning: {
        acknowledged_at: '2026-07-20T09:00:00.000Z',
        card_states: [
          {
            card_id: '002001',
            completed_at: '2026-07-20T08:00:00.000Z',
            interaction_id: 'flip',
            is_favorited: true,
            outcome: 'confident',
            phase: 'learning',
            used_hint: false,
            used_peek: false,
          },
        ],
        cursor: {
          card_id: '002002',
          source_id: 'cloudbase-dev-card-source',
          track: 'cet4',
        },
        source: {
          id: 'cloudbase-dev-card-source',
          label: 'CloudBase development card source',
        },
      },
      membership: {
        acknowledged_at: '2026-07-20T09:30:00.000Z',
        stage: 'premium',
        counted_entry_count: 3,
        last_experience_ended_by: null,
        recovery_prompt_visible: false,
        trial_duration_days: 5,
        trial_started_at_entry_count: 1,
      },
      progress: {
        acknowledged_at: '2026-07-20T09:00:00.000Z',
        checked_in_today: true,
        day_key: DAY_KEY,
        favorite_count: 1,
        learning_completed_count: 1,
        pending_review_count: 0,
        review_completed_count: 0,
        sleeping_count: 0,
        total_completed_count: 1,
      },
      space: {
        acknowledged_at: '2026-07-20T09:10:00.000Z',
        day_key: DAY_KEY,
        states: [
          {
            card_id: '002001',
            is_favorited: true,
            is_sleeping: false,
            last_modified_at: '2026-07-20T08:30:00.000Z',
          },
        ],
      },
    },
  };
}

test('loads one scoped bootstrap without sending account identity', async () => {
  const fetchImpl = jest.fn(async (_input: string, _init?: unknown) => ({
    json: async () => createBootstrapPayload(),
    ok: true,
    status: 200,
  }));
  const repository = createAccountBootstrapRepository({
    fetchImpl,
    mode: 'remote',
    remoteConfig: createSoftbookRemoteAccountBootstrapConfig({
      apiKey: 'runtime-key',
      baseUrl: 'https://api.softbook.example/',
    }),
  });

  await expect(repository.load('cet4', DAY_KEY)).resolves.toMatchObject({
    content: {
      cardCount: 5,
      releaseId: null,
      version: CONTENT_VERSION,
    },
    learning: {
      cardStates: [{ cardId: '002001', phase: 'learning' }],
      cursor: { cardId: '002002', track: 'cet4' },
    },
    membership: { state: { stage: 'premium' } },
    progress: { snapshot: { checkedInToday: true, totalCompletedCount: 1 } },
    schemaVersion: 'bootstrap.v2',
    track: 'cet4',
  });
  expect(fetchImpl).toHaveBeenCalledWith(
    `https://api.softbook.example/v2/bootstrap?track=cet4&day_key=${DAY_KEY}`,
    {
      headers: {
        Accept: 'application/json',
        'x-api-key': 'runtime-key',
        'x-softbook-client': 'mobile',
      },
      method: 'GET',
    },
  );
  expect(fetchImpl.mock.calls[0]?.[0]).not.toContain('phone');
});

test('keeps local bootstrap side-effect free', async () => {
  const fetchImpl = jest.fn();
  const repository = createAccountBootstrapRepository({
    fetchImpl,
    mode: 'local',
  });

  await expect(repository.load('cet6', DAY_KEY)).resolves.toBeNull();
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('accepts a complete published content descriptor', () => {
  const payload = createBootstrapPayload();
  payload.data.content = {
    ...payload.data.content,
    minimum_client_version: '1.4.0',
    parent_release_id: 'content-release-2026-07-01',
    published_at: '2026-07-20T10:00:00.000Z',
    release_id: 'content-release-2026-07-20',
  };

  expect(
    parseAccountBootstrapPayload(payload, 'cet4', DAY_KEY).content,
  ).toMatchObject({
    minimumClientVersion: '1.4.0',
    parentReleaseId: 'content-release-2026-07-01',
    publishedAt: '2026-07-20T10:00:00.000Z',
    releaseId: 'content-release-2026-07-20',
  });
});

test('reports remote status failures without parsing an error body', async () => {
  const repository = createAccountBootstrapRepository({
    fetchImpl: jest.fn(async (_input: string, _init?: unknown) => ({
      json: async () => ({ error: { code: 'content_release_unavailable' } }),
      ok: false,
      status: 503,
    })),
    mode: 'remote',
    remoteConfig: { endpoint: 'https://api.softbook.example/v2/bootstrap' },
  });

  await expect(repository.load('cet4', DAY_KEY)).rejects.toEqual(
    expect.objectContaining<Partial<RemoteHttpError>>({ status: 503 }),
  );
});

test.each([
  {
    label: 'schema mismatch',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.schema_version = 'bootstrap.v1';
    },
  },
  {
    label: 'request scope mismatch',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.day_key = '2026-07-19';
    },
  },
  {
    label: 'impossible day',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.day_key = '2026-02-31';
    },
  },
  {
    label: 'invalid content hash',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.content.version = 'sha256:not-a-digest';
    },
  },
  {
    label: 'non-timestamp generated_at',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.generated_at = '2026-07-20';
    },
  },
  {
    label: 'impossible timestamp date',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.generated_at = '2026-02-31T10:00:00.000Z';
    },
  },
  {
    label: 'out-of-range timestamp time',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.generated_at = '2026-07-20T24:00:00.000Z';
    },
  },
  {
    label: 'learning source drift',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.learning.source.id = 'another-source';
    },
  },
  {
    label: 'release metadata on development content',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.content.published_at = '2026-07-20T10:00:00.000Z';
    },
  },
  {
    label: 'invalid minimum client version',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.content.release_id = 'content-release-2026-07-20';
      payload.data.content.minimum_client_version = 'latest';
      payload.data.content.published_at = '2026-07-20T10:00:00.000Z';
    },
  },
  {
    label: 'duplicate learning card state',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.learning.card_states.push({
        ...payload.data.learning.card_states[0],
      });
    },
  },
  {
    label: 'inconsistent progress total',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.progress.total_completed_count = 2;
    },
  },
  {
    label: 'duplicate space card state',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.space.states.push({ ...payload.data.space.states[0] });
    },
  },
  {
    label: 'impossible space action timestamp',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.space.states[0].last_modified_at =
        '2026-02-31T08:30:00.000Z';
    },
  },
])('rejects $label', ({ mutate }) => {
  const payload = createBootstrapPayload();
  mutate(payload);

  expect(() =>
    parseAccountBootstrapPayload(payload, 'cet4', DAY_KEY),
  ).toThrow();
});

test('rejects invalid request scope before network access', async () => {
  const fetchImpl = jest.fn();
  const repository = createAccountBootstrapRepository({
    fetchImpl,
    mode: 'remote',
    remoteConfig: { endpoint: 'https://api.softbook.example/v2/bootstrap' },
  });

  await expect(repository.load('cet4', '2026-02-31')).rejects.toThrow(
    'requested day_key must be a real calendar date.',
  );
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('rejects a blank direct remote base URL', () => {
  expect(() =>
    createSoftbookRemoteAccountBootstrapConfig({ baseUrl: '   ' }),
  ).toThrow('Remote account bootstrap requires a non-empty baseUrl.');
});
