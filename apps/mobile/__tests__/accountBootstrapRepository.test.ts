import {
  createAccountBootstrapRepository,
  createSoftbookRemoteAccountBootstrapConfig,
  parseAccountBootstrapPayload,
} from '../src/bootstrap/accountBootstrapRepository';
import {assertAccountBootstrapRevisionTransition} from '../src/bootstrap/accountBootstrapRevision';
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
      component_revisions: {
        schema_version: 'bootstrap-component-revisions.v1',
        membership: {
          base_membership_revision: 3,
          beta_entitlement_revision: 2,
        },
        learning: {
          event_server_sequence: 7,
          session_revision: 4,
          space_revision: 5,
        },
        progress: {
          learning_server_sequence: 7,
          check_in_revision: 1,
          space_revision: 5,
        },
        space: {
          state_revision: 5,
        },
      },
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
            server_sequence: 7,
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
        learning_authority: 'account_events_v2',
        pending_review_count: 0,
        review_completed_count: 0,
        sleeping_count: 0,
        total_completed_count: 1,
      },
      space: {
        acknowledged_at: '2026-07-20T09:10:00.000Z',
        content_version: CONTENT_VERSION,
        schema_version: 'space-state.v2',
        states: [
          {
            card_id: '002001',
            is_favorited: true,
            is_sleeping: false,
            last_modified_at: '2026-07-20T08:30:00.000Z',
          },
        ],
        track: 'cet4',
      },
    },
  };
}

function moveBootstrapPayloadToDay(payload: any, dayKey: string) {
  payload.data.day_key = dayKey;
  payload.data.progress.day_key = dayKey;
  payload.data.progress.checked_in_today = false;
  payload.data.progress.learning_completed_count = 0;
  payload.data.progress.review_completed_count = 0;
  payload.data.progress.total_completed_count = 0;
  payload.data.component_revisions.progress.check_in_revision = 0;
  return payload;
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
    componentRevisions: {
      learning: {
        eventServerSequence: 7,
        sessionRevision: 4,
        spaceRevision: 5,
      },
      membership: {
        baseMembershipRevision: 3,
        betaEntitlementRevision: 2,
      },
      progress: {
        checkInRevision: 1,
        learningServerSequence: 7,
        spaceRevision: 5,
      },
      schemaVersion: 'bootstrap-component-revisions.v1',
      space: { stateRevision: 5 },
    },
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

test('binds a force-fresh bootstrap to the caller cancellation signal', async () => {
  const fetchImpl = jest.fn(async (_input: string, _init?: unknown) => ({
    json: async () => createBootstrapPayload(),
    ok: true,
    status: 200,
  }));
  const repository = createAccountBootstrapRepository({
    fetchImpl,
    mode: 'remote',
    remoteConfig: {endpoint: 'https://api.softbook.example/v2/bootstrap'},
  });
  const abortController = new AbortController();

  await repository.load('cet4', DAY_KEY, {
    forceFresh: true,
    signal: abortController.signal,
  });

  expect(fetchImpl).toHaveBeenCalledWith(expect.any(String), {
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
    },
    method: 'GET',
    signal: abortController.signal,
  });
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

test('accepts retained account projections larger than the current catalog', () => {
  const payload = createBootstrapPayload();
  payload.data.content.card_count = 1;
  payload.data.learning.card_states.push({
    ...payload.data.learning.card_states[0],
    card_id: 'retained-card',
    is_favorited: false,
    server_sequence: 8,
  });
  payload.data.component_revisions.learning.event_server_sequence = 8;
  payload.data.component_revisions.progress.learning_server_sequence = 8;
  payload.data.space.states.push({
    card_id: 'retained-card',
    is_favorited: false,
    is_sleeping: true,
    last_modified_at: '2026-07-19T08:30:00.000Z',
  });
  payload.data.progress.sleeping_count = 1;

  expect(
    parseAccountBootstrapPayload(payload, 'cet4', DAY_KEY),
  ).toMatchObject({
    content: {cardCount: 1},
    learning: {cardStates: expect.arrayContaining([
      expect.objectContaining({cardId: 'retained-card'}),
    ])},
  });
});

test('accepts retained learning source metadata after the active source changes', () => {
  const payload = createBootstrapPayload();
  payload.data.content.source = {
    id: 'current-source-b',
    label: 'Current source B',
  };

  expect(
    parseAccountBootstrapPayload(payload, 'cet4', DAY_KEY),
  ).toMatchObject({
    content: {source: {id: 'current-source-b'}},
    learning: {
      cursor: {sourceId: 'cloudbase-dev-card-source'},
      source: {id: 'cloudbase-dev-card-source'},
    },
  });
});

test('accepts same-millisecond canonical changes when owner revisions advance', () => {
  const previous = parseAccountBootstrapPayload(
    createBootstrapPayload(),
    'cet4',
    DAY_KEY,
  );
  const nextPayload = createBootstrapPayload();
  nextPayload.data.membership.stage = 'free';
  nextPayload.data.component_revisions.membership.base_membership_revision = 4;
  const next = parseAccountBootstrapPayload(nextPayload, 'cet4', DAY_KEY);

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).not.toThrow();
});

test('rejects equal-revision owner drift even when observation time advances', () => {
  const previous = parseAccountBootstrapPayload(
    createBootstrapPayload(),
    'cet4',
    DAY_KEY,
  );
  const nextPayload = createBootstrapPayload();
  nextPayload.data.generated_at = '2026-07-20T10:00:01.000Z';
  nextPayload.data.membership.stage = 'free';
  const next = parseAccountBootstrapPayload(nextPayload, 'cet4', DAY_KEY);

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).toThrow(/membership changed without a new revision/);
});

test('rejects a newer Learning vector that rolls back an existing card sequence', () => {
  const previous = parseAccountBootstrapPayload(
    createBootstrapPayload(),
    'cet4',
    DAY_KEY,
  );
  const nextPayload = createBootstrapPayload();
  nextPayload.data.generated_at = '2026-07-20T10:00:01.000Z';
  nextPayload.data.learning.card_states[0].server_sequence = 3;
  nextPayload.data.learning.card_states.push({
    ...nextPayload.data.learning.card_states[0],
    card_id: '002003',
    is_favorited: false,
    server_sequence: 8,
  });
  nextPayload.data.component_revisions.learning.event_server_sequence = 8;
  nextPayload.data.component_revisions.learning.session_revision = 5;
  nextPayload.data.component_revisions.progress.learning_server_sequence = 8;
  const next = parseAccountBootstrapPayload(nextPayload, 'cet4', DAY_KEY);

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).toThrow(/card sequence regressed or disappeared/);
});

test('rejects a newer Progress vector that lowers same-day completion facts', () => {
  const previous = parseAccountBootstrapPayload(
    createBootstrapPayload(),
    'cet4',
    DAY_KEY,
  );
  const nextPayload = createBootstrapPayload();
  nextPayload.data.generated_at = '2026-07-20T10:00:01.000Z';
  nextPayload.data.progress.learning_completed_count = 0;
  nextPayload.data.progress.total_completed_count = 0;
  nextPayload.data.component_revisions.progress.learning_server_sequence = 8;
  const next = parseAccountBootstrapPayload(nextPayload, 'cet4', DAY_KEY);

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).toThrow(/daily progress regressed/);
});

test('rejects Learning event drift hidden behind an unrelated Space revision', () => {
  const previous = parseAccountBootstrapPayload(
    createBootstrapPayload(),
    'cet4',
    DAY_KEY,
  );
  const nextPayload = createBootstrapPayload();
  nextPayload.data.learning.card_states[0].outcome = 'review';
  nextPayload.data.component_revisions.learning.space_revision = 6;
  nextPayload.data.component_revisions.progress.space_revision = 6;
  nextPayload.data.component_revisions.space.state_revision = 6;
  const next = parseAccountBootstrapPayload(nextPayload, 'cet4', DAY_KEY);

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).toThrow(/changed without a new per-card sequence/);
});

test('allows Space-derived learning favorites to change with content scope', () => {
  const previous = parseAccountBootstrapPayload(
    createBootstrapPayload(),
    'cet4',
    DAY_KEY,
  );
  const nextPayload = createBootstrapPayload();
  const nextVersion = `sha256:${'b'.repeat(64)}`;
  nextPayload.data.content.version = nextVersion;
  nextPayload.data.learning.card_states[0].is_favorited = false;
  nextPayload.data.progress.favorite_count = 0;
  nextPayload.data.space.content_version = nextVersion;
  nextPayload.data.space.states = [];
  const next = parseAccountBootstrapPayload(nextPayload, 'cet4', DAY_KEY);

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).not.toThrow();
});

test('rejects same-card drift hidden behind another card event advance', () => {
  const previous = parseAccountBootstrapPayload(
    createBootstrapPayload(),
    'cet4',
    DAY_KEY,
  );
  const nextPayload = createBootstrapPayload();
  nextPayload.data.learning.card_states[0].outcome = 'review';
  nextPayload.data.learning.card_states.push({
    ...nextPayload.data.learning.card_states[0],
    card_id: '002003',
    is_favorited: false,
    outcome: 'confident',
    server_sequence: 8,
  });
  nextPayload.data.component_revisions.learning.event_server_sequence = 8;
  nextPayload.data.component_revisions.progress.learning_server_sequence = 8;
  const next = parseAccountBootstrapPayload(nextPayload, 'cet4', DAY_KEY);

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).toThrow(/changed without a new per-card sequence/);
});

test('rejects cursor drift hidden behind a newer Learning event revision', () => {
  const previous = parseAccountBootstrapPayload(
    createBootstrapPayload(),
    'cet4',
    DAY_KEY,
  );
  const nextPayload = createBootstrapPayload();
  nextPayload.data.learning.card_states.push({
    ...nextPayload.data.learning.card_states[0],
    card_id: '002003',
    is_favorited: false,
    server_sequence: 8,
  });
  nextPayload.data.learning.cursor.card_id = '002003';
  nextPayload.data.component_revisions.learning.event_server_sequence = 8;
  nextPayload.data.component_revisions.progress.learning_server_sequence = 8;
  nextPayload.data.progress.learning_completed_count = 2;
  nextPayload.data.progress.total_completed_count = 2;
  const next = parseAccountBootstrapPayload(nextPayload, 'cet4', DAY_KEY);

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).toThrow(/cursor changed without a new session revision/);
});

test('rejects Progress event drift hidden behind an unrelated Space revision', () => {
  const previous = parseAccountBootstrapPayload(
    createBootstrapPayload(),
    'cet4',
    DAY_KEY,
  );
  const nextPayload = createBootstrapPayload();
  nextPayload.data.progress.learning_completed_count = 2;
  nextPayload.data.progress.total_completed_count = 2;
  nextPayload.data.component_revisions.learning.space_revision = 6;
  nextPayload.data.component_revisions.progress.space_revision = 6;
  nextPayload.data.component_revisions.space.state_revision = 6;
  const next = parseAccountBootstrapPayload(nextPayload, 'cet4', DAY_KEY);

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).toThrow(/progress learning facts changed without a new event revision/);
});

test('allows content identity A-B-A without fabricating a content revision', () => {
  const firstA = parseAccountBootstrapPayload(
    createBootstrapPayload(),
    'cet4',
    DAY_KEY,
  );
  const payloadB = createBootstrapPayload();
  payloadB.data.content.version = `sha256:${'b'.repeat(64)}`;
  payloadB.data.space.content_version = payloadB.data.content.version;
  const stateB = parseAccountBootstrapPayload(payloadB, 'cet4', DAY_KEY);
  const secondA = parseAccountBootstrapPayload(
    createBootstrapPayload(),
    'cet4',
    DAY_KEY,
  );

  expect(() =>
    assertAccountBootstrapRevisionTransition(firstA, stateB),
  ).not.toThrow();
  expect(() =>
    assertAccountBootstrapRevisionTransition(stateB, secondA),
  ).not.toThrow();
});

test('allows exact-day check-in and completion presentation to reset on rollover', () => {
  const previous = parseAccountBootstrapPayload(
    createBootstrapPayload(),
    'cet4',
    DAY_KEY,
  );
  const nextDayKey = '2026-07-21';
  const next = parseAccountBootstrapPayload(
    moveBootstrapPayloadToDay(createBootstrapPayload(), nextDayKey),
    'cet4',
    nextDayKey,
  );

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).not.toThrow();
});

test('allows an explicit sequence-zero legacy day baseline to expire on rollover', () => {
  const previousPayload = createBootstrapPayload();
  previousPayload.data.learning.card_states[0].server_sequence = 0;
  previousPayload.data.learning.cursor = null;
  previousPayload.data.component_revisions.learning.event_server_sequence = 0;
  previousPayload.data.component_revisions.learning.session_revision = 0;
  previousPayload.data.component_revisions.progress.learning_server_sequence = 0;
  previousPayload.data.progress.learning_authority = 'empty';
  const previous = parseAccountBootstrapPayload(
    previousPayload,
    'cet4',
    DAY_KEY,
  );
  const nextDayKey = '2026-07-21';
  const nextPayload = moveBootstrapPayloadToDay(
    createBootstrapPayload(),
    nextDayKey,
  );
  nextPayload.data.learning.card_states = [];
  nextPayload.data.learning.acknowledged_at = null;
  nextPayload.data.learning.cursor = null;
  nextPayload.data.learning.source = null;
  nextPayload.data.component_revisions.learning.event_server_sequence = 0;
  nextPayload.data.component_revisions.learning.session_revision = 0;
  nextPayload.data.component_revisions.progress.learning_server_sequence = 0;
  nextPayload.data.progress.learning_authority = 'empty';
  const next = parseAccountBootstrapPayload(nextPayload, 'cet4', nextDayKey);

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).not.toThrow();
});

test('keeps a legacy account pending-review baseline stable on rollover', () => {
  const previousPayload = createBootstrapPayload();
  previousPayload.data.component_revisions.learning.event_server_sequence = 0;
  previousPayload.data.component_revisions.progress.learning_server_sequence = 0;
  previousPayload.data.learning.card_states = [];
  previousPayload.data.learning.cursor = null;
  previousPayload.data.component_revisions.learning.session_revision = 0;
  previousPayload.data.progress.learning_authority = 'legacy_account_baseline';
  previousPayload.data.progress.pending_review_count = 1;

  const nextDayKey = '2026-07-21';
  const nextPayload = moveBootstrapPayloadToDay(
    createBootstrapPayload(),
    nextDayKey,
  );
  nextPayload.data.component_revisions.learning.event_server_sequence = 0;
  nextPayload.data.component_revisions.progress.learning_server_sequence = 0;
  nextPayload.data.learning.card_states = [];
  nextPayload.data.learning.cursor = null;
  nextPayload.data.component_revisions.learning.session_revision = 0;
  nextPayload.data.progress.learning_authority = 'legacy_account_baseline';
  nextPayload.data.progress.pending_review_count = 1;

  const previous = parseAccountBootstrapPayload(
    previousPayload,
    'cet4',
    DAY_KEY,
  );
  const next = parseAccountBootstrapPayload(nextPayload, 'cet4', nextDayKey);

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).not.toThrow();
});

test('rejects inconsistent Progress learning authority markers', () => {
  const v2WithoutSequence = createBootstrapPayload();
  v2WithoutSequence.data.learning.card_states[0].server_sequence = 0;
  v2WithoutSequence.data.component_revisions.learning.event_server_sequence = 0;
  v2WithoutSequence.data.component_revisions.progress.learning_server_sequence =
    0;

  expect(() =>
    parseAccountBootstrapPayload(v2WithoutSequence, 'cet4', DAY_KEY),
  ).toThrow(/Progress learning authority is inconsistent/);

  const emptyWithPendingReview = createBootstrapPayload();
  emptyWithPendingReview.data.learning.card_states[0].server_sequence = 0;
  emptyWithPendingReview.data.component_revisions.learning.event_server_sequence =
    0;
  emptyWithPendingReview.data.component_revisions.progress.learning_server_sequence =
    0;
  emptyWithPendingReview.data.progress.learning_authority = 'empty';
  emptyWithPendingReview.data.progress.pending_review_count = 1;

  expect(() =>
    parseAccountBootstrapPayload(emptyWithPendingReview, 'cet4', DAY_KEY),
  ).toThrow(/Progress learning authority is inconsistent/);
});

test('rejects a Progress learning authority change at the same sequence', () => {
  const previousPayload = createBootstrapPayload();
  previousPayload.data.learning.card_states[0].server_sequence = 0;
  previousPayload.data.component_revisions.learning.event_server_sequence = 0;
  previousPayload.data.component_revisions.progress.learning_server_sequence = 0;
  previousPayload.data.progress.learning_authority = 'empty';
  const nextPayload = createBootstrapPayload();
  nextPayload.data.learning.card_states[0].server_sequence = 0;
  nextPayload.data.component_revisions.learning.event_server_sequence = 0;
  nextPayload.data.component_revisions.progress.learning_server_sequence = 0;
  nextPayload.data.progress.learning_authority = 'legacy_account_baseline';
  const previous = parseAccountBootstrapPayload(
    previousPayload,
    'cet4',
    DAY_KEY,
  );
  const next = parseAccountBootstrapPayload(nextPayload, 'cet4', DAY_KEY);

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).toThrow(/learning authority changed without a new event revision/);
});

test('rejects account-wide pending review drift across product-day rollover', () => {
  const previousPayload = createBootstrapPayload();
  previousPayload.data.progress.learning_authority = 'account_events_v2';
  previousPayload.data.progress.pending_review_count = 2;
  const nextDayKey = '2026-07-21';
  const nextPayload = moveBootstrapPayloadToDay(
    createBootstrapPayload(),
    nextDayKey,
  );
  nextPayload.data.progress.pending_review_count = 1;
  nextPayload.data.progress.learning_authority = 'account_events_v2';
  const previous = parseAccountBootstrapPayload(
    previousPayload,
    'cet4',
    DAY_KEY,
  );
  const next = parseAccountBootstrapPayload(nextPayload, 'cet4', nextDayKey);

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).toThrow(/pending review count changed without a new event revision/);
});

test('rejects scoped Space count drift across product-day rollover', () => {
  const previous = parseAccountBootstrapPayload(
    createBootstrapPayload(),
    'cet4',
    DAY_KEY,
  );
  const nextDayKey = '2026-07-21';
  const nextPayload = moveBootstrapPayloadToDay(
    createBootstrapPayload(),
    nextDayKey,
  );
  nextPayload.data.progress.favorite_count = 2;
  nextPayload.data.space.states.push({
    card_id: '002003',
    is_favorited: true,
    is_sleeping: false,
    last_modified_at: '2026-07-20T08:31:00.000Z',
  });
  const next = parseAccountBootstrapPayload(nextPayload, 'cet4', nextDayKey);

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).toThrow(/progress Space facts changed without a new Space revision/);
});

test.each([
  {
    label: 'membership',
    mutate(previousPayload: any, nextPayload: any) {
      previousPayload.data.component_revisions.membership.base_membership_revision =
        4;
      nextPayload.data.component_revisions.membership.base_membership_revision =
        3;
    },
    pattern: /membership revision baseMembershipRevision regressed/,
  },
  {
    label: 'Learning event',
    mutate(_previousPayload: any, nextPayload: any) {
      nextPayload.data.learning.card_states[0].server_sequence = 6;
      nextPayload.data.component_revisions.learning.event_server_sequence = 6;
    },
    pattern: /learning revision eventServerSequence regressed/,
  },
  {
    label: 'Learning session',
    mutate(_previousPayload: any, nextPayload: any) {
      nextPayload.data.component_revisions.learning.session_revision = 3;
    },
    pattern: /learning revision sessionRevision regressed/,
  },
  {
    label: 'account-wide Progress',
    mutate(previousPayload: any, nextPayload: any) {
      previousPayload.data.component_revisions.progress.learning_server_sequence =
        9;
      nextPayload.data.component_revisions.progress.learning_server_sequence =
        8;
    },
    pattern: /progress revision learningServerSequence regressed/,
  },
  {
    label: 'Space',
    mutate(_previousPayload: any, nextPayload: any) {
      nextPayload.data.component_revisions.learning.space_revision = 4;
      nextPayload.data.component_revisions.progress.space_revision = 4;
      nextPayload.data.component_revisions.space.state_revision = 4;
    },
    pattern: /revision (?:spaceRevision|stateRevision) regressed/,
  },
])('rejects $label rollback across product-day rollover', ({mutate, pattern}) => {
  const previousPayload = createBootstrapPayload();
  const nextDayKey = '2026-07-21';
  const nextPayload = moveBootstrapPayloadToDay(
    createBootstrapPayload(),
    nextDayKey,
  );
  mutate(previousPayload, nextPayload);
  const previous = parseAccountBootstrapPayload(
    previousPayload,
    'cet4',
    DAY_KEY,
  );
  const next = parseAccountBootstrapPayload(nextPayload, 'cet4', nextDayKey);

  expect(() =>
    assertAccountBootstrapRevisionTransition(previous, next),
  ).toThrow(pattern);
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
    label: 'missing component revisions',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      delete payload.data.component_revisions;
    },
  },
  {
    label: 'component revisions unknown field',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.component_revisions.space.generated_at = 1;
    },
  },
  {
    label: 'component revisions unsafe integer',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.component_revisions.learning.session_revision =
        Number.MAX_SAFE_INTEGER + 1;
    },
  },
  {
    label: 'component revision dependency mismatch',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.component_revisions.progress.space_revision = 4;
    },
  },
  {
    label: 'Space revision zero with canonical state',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.component_revisions.learning.space_revision = 0;
      payload.data.component_revisions.progress.space_revision = 0;
      payload.data.component_revisions.space.state_revision = 0;
    },
  },
  {
    label: 'Learning session revision zero with cursor',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.component_revisions.learning.session_revision = 0;
    },
  },
  {
    label: 'Progress Space count drift',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.progress.favorite_count = 0;
    },
  },
  {
    label: 'Learning favorite overlay drift',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.learning.card_states[0].is_favorited = false;
    },
  },
  {
    label: 'check-in revision mismatch',
    mutate: (payload: ReturnType<typeof createBootstrapPayload>) => {
      payload.data.component_revisions.progress.check_in_revision = 0;
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
