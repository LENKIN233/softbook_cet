const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const test = require('node:test');

const boxCatalog = require('../../../../../spec/box-catalog.json');
const {
  createCloudBaseStore,
  createMemoryStore,
  createSoftbookApi,
  validateCardSourceForImport,
} = require('../index');

const fixedNow = new Date('2026-04-30T12:00:00.000Z');
const CORE_INTERACTIONS = [
  'elimination',
  'flip',
  'lock',
  'multiple_choice',
  'swipe',
];

function catalogEntriesByRef(track) {
  const entries = new Map();

  for (const library of boxCatalog.libraries) {
    for (const group of library.groups) {
      for (const box of group.boxes) {
        const ref = box.resolved_box_prefixes?.[track];

        if (!ref) {
          continue;
        }

        entries.set(ref, {
          box: box.name,
          group: group.name,
          library: library.name,
        });
      }
    }
  }

  return entries;
}

function createTestApi(options = {}) {
  return createSoftbookApi({
    now: () => fixedNow,
    smsCode: '2468',
    tokenSecret: 'test-secret',
    ...options,
  });
}

test('installed CloudBase SDK preserves the required database surface', () => {
  const cloudbase = require('@cloudbase/node-sdk');
  const packageVersion = require('@cloudbase/node-sdk/package.json').version;

  assert.match(packageVersion, /^4\./);
  assert.equal(typeof cloudbase.init, 'function');
  assert.equal(typeof cloudbase.SYMBOL_CURRENT_ENV, 'symbol');

  const app = cloudbase.init({env: 'softbook-contract-test'});
  const database = app.database();

  assert.equal(typeof app.database, 'function');
  assert.equal(typeof database.collection, 'function');
  assert.equal(typeof database.runTransaction, 'function');
});

test('accountless legacy learning reads do not apply a v2 session overlay', () => {
  const store = createMemoryStore();
  const legacyCursor = {card_id: '002001', source: 'legacy'};

  store.snapshot().learningStates.set('13800138000:2026-04-30:cet4', {
    acknowledged_at: fixedNow.toISOString(),
    cursor: legacyCursor,
    day_key: '2026-04-30',
    events_by_card_id: {},
    source_id: 'legacy-source',
    source_label: 'Legacy source',
    track: 'cet4',
  });

  const state = store.getLearningState(
    '13800138000',
    '2026-04-30',
    'cet4',
  );

  assert.deepEqual(state.cursor, legacyCursor);
});

async function request(api, requestOptions) {
  const response = await api.handleHttpRequest({
    body: requestOptions.body,
    clientIp: requestOptions.clientIp,
    headers: requestOptions.headers ?? {},
    method: requestOptions.method,
    path: requestOptions.path,
    query: requestOptions.query ?? {},
  });

  return response;
}

async function authenticatedToken(api, phoneNumber = '13800138000') {
  await request(api, {
    body: {
      phone_number: phoneNumber,
    },
    method: 'POST',
    path: '/v1/auth/request-code',
  });
  const response = await request(api, {
    body: {
      phone_number: phoneNumber,
      sms_code: '2468',
    },
    method: 'POST',
    path: '/v1/auth/verify-code',
  });

  assert.equal(response.statusCode, 200);
  return response.body.data.auth_token;
}

async function authenticatedV2Session(
  api,
  phoneNumber = '13800138000',
  clientIp = '127.0.0.1',
) {
  const challenge = await request(api, {
    body: {phone_number: phoneNumber},
    clientIp,
    method: 'POST',
    path: '/v2/auth/request-code',
  });

  assert.equal(challenge.statusCode, 200);
  const verified = await request(api, {
    body: {
      challenge_id: challenge.body.data.challenge_id,
      phone_number: phoneNumber,
      sms_code: '2468',
    },
    clientIp,
    method: 'POST',
    path: '/v2/auth/verify-code',
  });

  assert.equal(verified.statusCode, 200);
  return verified.body.data;
}

test('auth endpoints issue a bearer token for the development fixed SMS code', async () => {
  const api = createTestApi();
  const response = await request(api, {
    body: {
      phone_number: '13800138000',
      sms_code: '2468',
    },
    method: 'POST',
    path: '/v1/auth/verify-code',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.phone_number, '13800138000');
  assert.match(response.body.data.auth_token, /^softbook\./);
});

test('learning card source requires auth and covers each core interaction', async () => {
  const api = createTestApi();
  const token = await authenticatedToken(api);
  const headers = {
    authorization: `Bearer ${token}`,
  };

  for (const track of ['cet4', 'cet6']) {
    const catalogEntries = catalogEntriesByRef(track);
    const response = await request(api, {
      headers,
      method: 'GET',
      path: '/softbook-api/v1/learning/card-source',
      query: {
        track,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.source.id, 'cloudbase-dev-card-source');
    assert.equal(response.body.data.track, track);
    assert.match(response.body.data.content_version, /^sha256:[a-f0-9]{64}$/);
    assert.ok(
      response.body.data.card_records.length >= CORE_INTERACTIONS.length,
    );
    assert.ok(
      response.body.data.card_records.every(card => card.track === track),
    );
    assert.deepEqual(
      [
        ...new Set(
          response.body.data.card_records.map(card => card.interaction_id),
        ),
      ].sort(),
      CORE_INTERACTIONS,
    );
    assert.deepEqual(
      response.body.data.card_records.flatMap(card => {
        const catalogEntry = catalogEntries.get(card.knowledge_ref);

        if (!catalogEntry) {
          return [`${card.card_id} uses unmapped ${card.knowledge_ref}`];
        }

        const expectedPath = [
          catalogEntry.library,
          catalogEntry.group,
          catalogEntry.box,
        ].join('/');
        const actualPath = [
          card.space_metadata.library,
          card.space_metadata.group,
          card.space_metadata.box,
        ].join('/');

        return actualPath === expectedPath
          ? []
          : [`${card.card_id} maps to ${actualPath}, expected ${expectedPath}`];
      }),
      [],
    );
  }
});

test('protected endpoints reject missing bearer token', async () => {
  const api = createTestApi();
  const response = await request(api, {
    method: 'GET',
    path: '/v1/learning/card-source',
    query: {
      track: 'cet4',
    },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error.code, 'missing_auth_token');
});

test('v2 bootstrap requires an active v2 session and explicit scope', async () => {
  const api = createTestApi();
  const legacyToken = await authenticatedToken(api);
  const v2Session = await authenticatedV2Session(api);
  const validQuery = {day_key: '2026-04-30', track: 'cet4'};

  const missingAuth = await request(api, {
    method: 'GET',
    path: '/v2/bootstrap',
    query: validQuery,
  });
  const legacyAuth = await request(api, {
    headers: {authorization: `Bearer ${legacyToken}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: validQuery,
  });
  const missingTrack = await request(api, {
    headers: {authorization: `Bearer ${v2Session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-04-30'},
  });
  const invalidDay = await request(api, {
    headers: {authorization: `Bearer ${v2Session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '04-30-2026', track: 'cet4'},
  });
  const impossibleDay = await request(api, {
    headers: {authorization: `Bearer ${v2Session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-02-30', track: 'cet4'},
  });
  const injectedPhone = await request(api, {
    headers: {authorization: `Bearer ${v2Session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {...validQuery, phone_number: '13900139000'},
  });
  const injectedBody = await request(api, {
    body: {phone_number: '13900139000'},
    headers: {authorization: `Bearer ${v2Session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: validQuery,
  });

  assert.equal(missingAuth.statusCode, 401);
  assert.equal(missingAuth.body.error.code, 'missing_auth_token');
  assert.equal(legacyAuth.statusCode, 401);
  assert.equal(legacyAuth.body.error.code, 'invalid_auth_token');
  assert.equal(missingTrack.statusCode, 400);
  assert.equal(invalidDay.statusCode, 400);
  assert.equal(impossibleDay.statusCode, 400);
  assert.equal(injectedPhone.statusCode, 400);
  assert.equal(injectedBody.statusCode, 400);
  assert.equal(
    injectedPhone.body.error.code,
    'bootstrap_identity_input_forbidden',
  );
  assert.equal(
    injectedBody.body.error.code,
    'bootstrap_identity_input_forbidden',
  );
});

test('v2 bootstrap returns explicit empty canonical state without identity leakage', async () => {
  const api = createTestApi();
  const session = await authenticatedV2Session(api);
  const response = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-04-30', track: 'cet4'},
  });
  const cardSourceResponse = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v1/learning/card-source',
    query: {track: 'cet4'},
  });

  assert.equal(response.statusCode, 200);
  assert.equal(cardSourceResponse.statusCode, 200);
  assert.equal(response.body.data.schema_version, 'bootstrap.v2');
  assert.equal(response.body.data.generated_at, fixedNow.toISOString());
  assert.equal(response.body.data.day_key, '2026-04-30');
  assert.equal(response.body.data.track, 'cet4');
  assert.match(response.body.data.content.version, /^sha256:[a-f0-9]{64}$/);
  assert.equal(
    cardSourceResponse.body.data.content_version,
    response.body.data.content.version,
  );
  assert.equal(response.body.data.content.release_id, null);
  assert.equal(response.body.data.content.card_count, 5);
  assert.equal(response.body.data.membership.acknowledged_at, null);
  assert.equal(response.body.data.membership.stage, 'trial_available');
  assert.deepEqual(response.body.data.learning, {
    acknowledged_at: null,
    card_states: [],
    cursor: null,
    source: null,
  });
  assert.deepEqual(response.body.data.progress, {
    acknowledged_at: null,
    checked_in_today: false,
    day_key: '2026-04-30',
    favorite_count: 0,
    learning_completed_count: 0,
    pending_review_count: 0,
    review_completed_count: 0,
    sleeping_count: 0,
    total_completed_count: 0,
  });
  assert.deepEqual(response.body.data.space, {
    acknowledged_at: null,
    day_key: '2026-04-30',
    states: [],
  });
  assert.equal(JSON.stringify(response.body).includes('13800138000'), false);
});

test('v2 bootstrap restores persisted canonical state and isolates accounts', async () => {
  const stores = [
    createMemoryStore(),
    createCloudBaseStore({db: createFakeCloudBaseDb()}),
  ];

  for (const store of stores) {
    const api = createTestApi({store});
    const first = await authenticatedV2Session(api, '13800138000');
    const firstHeaders = {authorization: `Bearer ${first.access_token}`};
    const second = await authenticatedV2Session(api, '13900139000');
    const secondHeaders = {authorization: `Bearer ${second.access_token}`};
    const progress = {
      checked_in_today: true,
      day_key: '2026-04-30',
      favorite_count: 1,
      learning_completed_count: 1,
      pending_review_count: 0,
      phone_number: '13800138000',
      review_completed_count: 0,
      sleeping_count: 0,
      total_completed_count: 1,
    };
    const event = {
      card_id: '002001',
      completed_at: fixedNow.toISOString(),
      interaction_id: 'flip',
      is_favorited: true,
      outcome: 'confident',
      phase: 'learning',
      used_hint: false,
      used_peek: false,
    };
    const spaceState = {
      card_id: '002001',
      is_favorited: true,
      is_sleeping: false,
      last_modified_at: fixedNow.toISOString(),
    };

    await request(api, {
      body: {phone_number: '13800138000'},
      headers: firstHeaders,
      method: 'POST',
      path: '/v1/membership/start-trial',
    });
    await request(api, {
      body: progress,
      headers: firstHeaders,
      method: 'POST',
      path: '/v1/progress/daily-sync',
    });
    await request(api, {
      body: {
        day_key: '2026-04-30',
        events: [event],
        phone_number: '13800138000',
        source_id: 'cloudbase-dev-card-source',
        source_label: 'CloudBase 开发卡源',
        track: 'cet4',
      },
      headers: firstHeaders,
      method: 'POST',
      path: '/v1/learning/state-sync',
    });
    await request(api, {
      body: {
        day_key: '2026-04-30',
        phone_number: '13800138000',
        states: [spaceState],
      },
      headers: firstHeaders,
      method: 'POST',
      path: '/v1/space/state-sync',
    });

    const firstBootstrap = await request(api, {
      headers: firstHeaders,
      method: 'GET',
      path: '/v2/bootstrap',
      query: {day_key: '2026-04-30', track: 'cet4'},
    });
    const secondBootstrap = await request(api, {
      headers: secondHeaders,
      method: 'GET',
      path: '/v2/bootstrap',
      query: {day_key: '2026-04-30', track: 'cet4'},
    });

    assert.equal(firstBootstrap.statusCode, 200);
    assert.equal(
      firstBootstrap.body.data.membership.acknowledged_at,
      fixedNow.toISOString(),
    );
    assert.equal(firstBootstrap.body.data.membership.stage, 'trial');
    assert.deepEqual(firstBootstrap.body.data.progress, {
      acknowledged_at: fixedNow.toISOString(),
      ...Object.fromEntries(
        Object.entries(progress).filter(([key]) => key !== 'phone_number'),
      ),
    });
    assert.deepEqual(firstBootstrap.body.data.learning.card_states, [event]);
    assert.deepEqual(firstBootstrap.body.data.learning.source, {
      id: 'cloudbase-dev-card-source',
      label: 'CloudBase 开发卡源',
    });
    assert.deepEqual(firstBootstrap.body.data.space.states, [spaceState]);
    assert.equal(secondBootstrap.statusCode, 200);
    assert.equal(secondBootstrap.body.data.membership.acknowledged_at, null);
    assert.equal(secondBootstrap.body.data.membership.stage, 'trial_available');
    assert.equal(secondBootstrap.body.data.progress.total_completed_count, 0);
    assert.deepEqual(secondBootstrap.body.data.learning.card_states, []);
    assert.deepEqual(secondBootstrap.body.data.space.states, []);
  }
});

test('content version is canonical and published releases must match it', () => {
  const source = createPersistedCardSource('cet4');
  const reorderedKeys = {
    track: source.track,
    source: {
      label: source.source.label,
      id: source.source.id,
    },
    card_records: source.card_records.map(card => ({
      ...card,
      front: {
        context: card.front.context,
        support: card.front.support,
        prompt: card.front.prompt,
        eyebrow: card.front.eyebrow,
      },
    })),
  };
  const first = validateCardSourceForImport(source, 'cet4');
  const second = validateCardSourceForImport(reorderedKeys, 'cet4');

  assert.equal(first.content_version, second.content_version);
  assert.match(first.content_version, /^sha256:[a-f0-9]{64}$/);

  const secondCard = cloneJson(source.card_records[0]);
  secondCard.card_id = '052198';
  const ordered = validateCardSourceForImport(
    {...source, card_records: [...source.card_records, secondCard]},
    'cet4',
  );
  const reversed = validateCardSourceForImport(
    {...source, card_records: [secondCard, ...source.card_records]},
    'cet4',
  );
  assert.notEqual(ordered.content_version, reversed.content_version);

  assert.throws(
    () => validateCardSourceForImport({...source, card_records: []}, 'cet4'),
    /card source.card_records must not be empty/,
  );
  assert.throws(
    () =>
      validateCardSourceForImport(
        {
          ...source,
          card_records: [source.card_records[0], source.card_records[0]],
        },
        'cet4',
      ),
    /contains duplicate card_id/,
  );

  assert.throws(
    () =>
      validateCardSourceForImport(
        {...source, content_version: `sha256:${'0'.repeat(64)}`},
        'cet4',
      ),
    /card source.content_version must match normalized content/,
  );

  const released = createReleasedCardSource('cet4');
  const normalizedRelease = validateCardSourceForImport(released, 'cet4');
  assert.equal(normalizedRelease.release.release_id, 'cet4-test-release');

  released.release.content_version = `sha256:${'0'.repeat(64)}`;
  assert.throws(
    () => validateCardSourceForImport(released, 'cet4'),
    /content_version must match normalized content/,
  );
});

test('production bootstrap fails closed without a matching published release', async () => {
  const db = createFakeCloudBaseDb();
  await db
    .collection('softbook_card_sources')
    .doc('cet4')
    .set(createPersistedCardSource('cet4'));
  const api = createTestApi({
    authV2CodeGenerator: () => '2468',
    authV2IndexSecret: 'production-index-secret-0000000000',
    runtimeMode: 'production',
    smsProvider: {
      delivery: 'test_sms',
      kind: 'test_sms',
      sendCode: async () => undefined,
    },
    store: createCloudBaseStore({db}),
    tokenSecret: 'production-token-secret-0000000000',
  });
  const session = await authenticatedV2Session(api);
  const requestBootstrap = () =>
    request(api, {
      headers: {authorization: `Bearer ${session.access_token}`},
      method: 'GET',
      path: '/v2/bootstrap',
      query: {day_key: '2026-04-30', track: 'cet4'},
    });
  const unavailable = await requestBootstrap();

  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.body.error.code, 'content_release_unavailable');
  assert.equal(db.snapshot().get('softbook_memberships').size, 0);
  assert.equal(db.snapshot().get('softbook_daily_progress').size, 0);
  assert.equal(db.snapshot().get('softbook_learning_states').size, 0);
  assert.equal(db.snapshot().get('softbook_space_states').size, 0);

  await db
    .collection('softbook_card_sources')
    .doc('cet4')
    .set(createReleasedCardSource('cet4'));
  const available = await requestBootstrap();

  assert.equal(available.statusCode, 200);
  assert.equal(available.body.data.content.release_id, 'cet4-test-release');
  assert.equal(available.body.data.content.minimum_client_version, '1.0.0');
});

test('production learning session fails closed before trial without a published release', async () => {
  const db = createFakeCloudBaseDb();
  const api = createTestApi({
    authV2CodeGenerator: () => '2468',
    authV2IndexSecret: 'production-scheduler-index-secret-0000',
    runtimeMode: 'production',
    smsProvider: {
      delivery: 'test_sms',
      kind: 'test_sms',
      sendCode: async () => undefined,
    },
    store: createCloudBaseStore({db}),
    tokenSecret: 'production-scheduler-token-secret-0000',
  });
  const session = await authenticatedV2Session(api);
  const requestSession = () =>
    request(api, {
      headers: {authorization: `Bearer ${session.access_token}`},
      method: 'GET',
      path: '/v2/learning/session',
      query: {track: 'cet4'},
    });
  const missing = await requestSession();

  assert.equal(missing.statusCode, 503);
  assert.equal(missing.body.error.code, 'content_release_unavailable');
  assert.equal(db.snapshot().get('softbook_memberships')?.size ?? 0, 0);
  assert.equal(db.snapshot().get('softbook_learning_sessions')?.size ?? 0, 0);

  await db
    .collection('softbook_card_sources')
    .doc('cet4')
    .set(createPersistedCardSource('cet4'));
  const unpublished = await requestSession();

  assert.equal(unpublished.statusCode, 503);
  assert.equal(unpublished.body.error.code, 'content_release_unavailable');
  assert.equal(db.snapshot().get('softbook_memberships').size, 0);
  assert.equal(db.snapshot().get('softbook_learning_sessions').size, 0);

  await db
    .collection('softbook_card_sources')
    .doc('cet4')
    .set(createReleasedCardSource('cet4'));
  const available = await requestSession();

  assert.equal(available.statusCode, 200, JSON.stringify(available.body));
  assert.equal(available.body.data.membership_stage, 'trial');
  assert.equal(available.body.data.selection.reason, 'catalog_new');
  assert.equal(db.snapshot().get('softbook_memberships').size, 1);
  assert.equal(db.snapshot().get('softbook_learning_sessions').size, 1);
});

test('CloudBase bootstrap state survives separate function instances', async () => {
  const db = createFakeCloudBaseDb();
  const firstApi = createTestApi({store: createCloudBaseStore({db})});
  const secondApi = createTestApi({store: createCloudBaseStore({db})});
  const session = await authenticatedV2Session(firstApi);
  const headers = {authorization: `Bearer ${session.access_token}`};

  await request(firstApi, {
    body: {
      checked_in_today: true,
      day_key: '2026-04-30',
      favorite_count: 0,
      learning_completed_count: 2,
      pending_review_count: 1,
      phone_number: '13800138000',
      review_completed_count: 0,
      sleeping_count: 0,
      total_completed_count: 2,
    },
    headers,
    method: 'POST',
    path: '/v1/progress/daily-sync',
  });
  const restored = await request(secondApi, {
    headers,
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-04-30', track: 'cet4'},
  });

  assert.equal(restored.statusCode, 200);
  assert.equal(restored.body.data.progress.total_completed_count, 2);
  assert.equal(restored.body.data.progress.pending_review_count, 1);
});

test('CloudBase learning-session cursor survives separate function instances', async () => {
  const db = createFakeCloudBaseDb();
  const firstApi = createTestApi({store: createCloudBaseStore({db})});
  const secondApi = createTestApi({store: createCloudBaseStore({db})});
  const session = await authenticatedV2Session(
    firstApi,
    '13800138001',
    '127.0.0.20',
  );
  const headers = {authorization: `Bearer ${session.access_token}`};
  const selected = await request(firstApi, {
    headers,
    method: 'GET',
    path: '/v2/learning/session',
    query: {track: 'cet4'},
  });
  const resumed = await request(secondApi, {
    headers,
    method: 'GET',
    path: '/v2/learning/session',
    query: {track: 'cet4'},
  });
  const bootstrap = await request(secondApi, {
    headers,
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-04-30', track: 'cet4'},
  });

  assert.equal(selected.statusCode, 200, JSON.stringify(selected.body));
  assert.equal(resumed.statusCode, 200, JSON.stringify(resumed.body));
  assert.equal(resumed.body.data.selection.reason, 'persisted_cursor');
  assert.equal(
    resumed.body.data.selection.selection_id,
    selected.body.data.selection.selection_id,
  );
  assert.deepEqual(bootstrap.body.data.learning.cursor, {
    card_id: selected.body.data.selection.card_id,
    source_id: selected.body.data.source_id,
    track: 'cet4',
  });
});

test('transactional membership mutations cannot downgrade concurrent purchases', async () => {
  const db = createFakeCloudBaseDb();
  const store = createCloudBaseStore({db});
  const acknowledgedAt = fixedNow.toISOString();

  await Promise.all([
    store.purchase('13800138002', acknowledgedAt),
    store.startTrial('13800138002', acknowledgedAt),
  ]);

  const membership = await store.getMembership('13800138002');
  assert.equal(membership.stage, 'premium');

  await Promise.all([
    store.purchase('13800138003', acknowledgedAt),
    store.dismissRecovery('13800138003', acknowledgedAt),
  ]);

  const dismissed = await store.getMembership('13800138003');
  assert.equal(dismissed.stage, 'premium');
});

test('bootstrap rejects corrupted persisted canonical state', async () => {
  const store = createMemoryStore();
  const api = createTestApi({store});
  const session = await authenticatedV2Session(api);
  const headers = {authorization: `Bearer ${session.access_token}`};

  await store.saveDailyProgress(
    '13800138000',
    {
      checked_in_today: true,
      day_key: '2026-04-30',
      favorite_count: 0,
      learning_completed_count: 0,
      pending_review_count: 0,
      review_completed_count: 0,
      sleeping_count: 0,
      total_completed_count: 0,
    },
    'not-an-iso-timestamp',
    {
      accountKey: [...store.snapshot().authSessions.values()][0].account_key,
    },
  );
  const response = await request(api, {
    headers,
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-04-30', track: 'cet4'},
  });

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.error.code, 'invalid_canonical_state');
});

test('membership entitlement and mutations preserve server-side state by phone', async () => {
  const api = createTestApi();
  const token = await authenticatedToken(api);
  const headers = {
    authorization: `Bearer ${token}`,
  };
  const body = {
    phone_number: '13800138000',
  };

  const initial = await request(api, {
    headers,
    method: 'GET',
    path: '/v1/membership/entitlement',
  });
  const trial = await request(api, {
    body,
    headers,
    method: 'POST',
    path: '/v1/membership/start-trial',
  });
  const premium = await request(api, {
    body,
    headers,
    method: 'POST',
    path: '/v1/membership/purchase',
  });

  assert.equal(initial.body.data.entitlement.stage, 'trial_available');
  assert.equal(trial.body.data.entitlement.stage, 'trial');
  assert.equal(trial.body.data.entitlement.trial_started_at_entry_count, 1);
  assert.equal(premium.body.data.entitlement.stage, 'premium');
});

test('sync endpoints acknowledge daily progress, learning state, and space state', async () => {
  const api = createTestApi();
  const token = await authenticatedToken(api);
  const headers = {
    authorization: `Bearer ${token}`,
  };

  const daily = await request(api, {
    body: {
      checked_in_today: true,
      day_key: '2026-04-30',
      favorite_count: 1,
      learning_completed_count: 2,
      pending_review_count: 0,
      phone_number: '13800138000',
      review_completed_count: 1,
      sleeping_count: 0,
      total_completed_count: 3,
    },
    headers,
    method: 'POST',
    path: '/v1/progress/daily-sync',
  });
  const learning = await request(api, {
    body: {
      day_key: '2026-04-30',
      events: [
        {
          card_id: '002001',
          completed_at: '2026-04-30T12:00:00.000Z',
          interaction_id: 'flip',
          is_favorited: true,
          outcome: 'confident',
          phase: 'learning',
          used_hint: false,
          used_peek: false,
        },
      ],
      phone_number: '13800138000',
      source_id: 'cloudbase-dev-card-source',
      source_label: 'CloudBase 开发卡源',
      track: 'cet4',
    },
    headers,
    method: 'POST',
    path: '/v1/learning/state-sync',
  });
  const space = await request(api, {
    body: {
      day_key: '2026-04-30',
      phone_number: '13800138000',
      states: [
        {
          card_id: '002001',
          is_favorited: true,
          is_sleeping: false,
          last_modified_at: '2026-04-30T12:00:00.000Z',
        },
      ],
    },
    headers,
    method: 'POST',
    path: '/v1/space/state-sync',
  });

  assert.equal(daily.statusCode, 200);
  assert.equal(learning.statusCode, 200);
  assert.equal(space.statusCode, 200);
  assert.equal(space.body.data.acknowledged_at, fixedNow.toISOString());
});

test('space state keeps the latest explicit action and returns server canonical state', async () => {
  const stores = [
    createMemoryStore(),
    createCloudBaseStore({db: createFakeCloudBaseDb()}),
  ];

  for (const store of stores) {
    const api = createTestApi({store});
    const token = await authenticatedToken(api);
    const headers = {authorization: `Bearer ${token}`};
    const stateBody = (isFavorited, lastModifiedAt) => ({
      day_key: '2026-04-30',
      phone_number: '13800138000',
      states: [
        {
          card_id: '002001',
          is_favorited: isFavorited,
          is_sleeping: false,
          last_modified_at: lastModifiedAt,
        },
      ],
    });

    await request(api, {
      body: stateBody(true, '2026-04-30T12:00:00.000Z'),
      headers,
      method: 'POST',
      path: '/v1/space/state-sync',
    });
    const staleWrite = await request(api, {
      body: stateBody(false, '2026-04-30T11:00:00.000Z'),
      headers,
      method: 'POST',
      path: '/v1/space/state-sync',
    });
    const canonicalRead = await request(api, {
      headers,
      method: 'GET',
      path: '/v1/space/state-sync',
      query: {day_key: '2026-04-30'},
    });
    const nextDayRead = await request(api, {
      headers,
      method: 'GET',
      path: '/v1/space/state-sync',
      query: {day_key: '2026-05-01'},
    });

    assert.equal(staleWrite.statusCode, 200);
    assert.deepEqual(staleWrite.body.data.space_state.states, [
      {
        card_id: '002001',
        is_favorited: true,
        is_sleeping: false,
        last_modified_at: '2026-04-30T12:00:00.000Z',
      },
    ]);
    assert.deepEqual(
      canonicalRead.body.data.space_state,
      staleWrite.body.data.space_state,
    );
    assert.deepEqual(
      nextDayRead.body.data.space_state.states,
      staleWrite.body.data.space_state.states,
    );
    assert.equal(nextDayRead.body.data.space_state.day_key, '2026-05-01');
  }
});

test('CloudBase event adapter returns stringified HTTP response bodies', async () => {
  const api = createTestApi();
  const response = await api.handleCloudBaseEvent({
    body: JSON.stringify({
      phone_number: '13800138000',
      sms_code: '2468',
    }),
    headers: {
      'content-type': 'application/json',
    },
    httpMethod: 'POST',
    path: '/softbook-api/v1/auth/verify-code',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).data.phone_number, '13800138000');
});

test('CloudBase store keeps membership and sync state outside function memory', async () => {
  const db = createFakeCloudBaseDb();
  const firstApi = createTestApi({
    store: createCloudBaseStore({db}),
  });
  const secondApi = createTestApi({
    store: createCloudBaseStore({db}),
  });
  const token = await authenticatedToken(firstApi);
  const headers = {
    authorization: `Bearer ${token}`,
  };
  const body = {
    phone_number: '13800138000',
  };

  await request(firstApi, {
    body,
    headers,
    method: 'POST',
    path: '/v1/membership/start-trial',
  });
  await request(firstApi, {
    body,
    headers,
    method: 'POST',
    path: '/v1/membership/purchase',
  });
  const entitlement = await request(secondApi, {
    headers,
    method: 'GET',
    path: '/v1/membership/entitlement',
  });
  const daily = await request(secondApi, {
    body: {
      checked_in_today: true,
      day_key: '2026-04-30',
      favorite_count: 1,
      learning_completed_count: 1,
      pending_review_count: 0,
      phone_number: '13800138000',
      review_completed_count: 0,
      sleeping_count: 0,
      total_completed_count: 1,
    },
    headers,
    method: 'POST',
    path: '/v1/progress/daily-sync',
  });

  assert.equal(entitlement.body.data.entitlement.stage, 'premium');
  assert.equal(daily.statusCode, 200);
  assert.equal(
    db.snapshot().get('softbook_memberships').get('13800138000').entitlement
      .stage,
    'premium',
  );
  assert.equal(db.snapshot().get('softbook_daily_progress').size, 1);
});

test('CloudBase space state migrates legacy daily documents into account canonical state', async () => {
  const db = createFakeCloudBaseDb();
  await db
    .collection('softbook_space_states')
    .doc('legacy-daily-document')
    .set({
      day_key: '2026-04-29',
      phone_number: '13800138000',
      states_by_card_id: {
        '002001': {
          card_id: '002001',
          is_favorited: true,
          is_sleeping: false,
          last_modified_at: '2026-04-29T12:00:00.000Z',
        },
      },
    });
  const api = createTestApi({store: createCloudBaseStore({db})});
  const token = await authenticatedToken(api);
  const response = await request(api, {
    headers: {authorization: `Bearer ${token}`},
    method: 'GET',
    path: '/v1/space/state-sync',
    query: {day_key: '2026-04-30'},
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.space_state.day_key, '2026-04-30');
  assert.equal(
    response.body.data.space_state.states[0].last_modified_at,
    '2026-04-29T12:00:00.000Z',
  );
  assert.equal(db.snapshot().get('softbook_space_states').size, 2);
});

test('CloudBase space transactions preserve simultaneous writes from separate function instances', async () => {
  const db = createFakeCloudBaseDb();
  const firstStore = createCloudBaseStore({db});
  const secondStore = createCloudBaseStore({db});
  const write = (store, cardId, lastModifiedAt) =>
    store.saveSpaceState(
      '13800138000',
      {
        day_key: '2026-04-30',
        states: [
          {
            card_id: cardId,
            is_favorited: true,
            is_sleeping: false,
            last_modified_at: lastModifiedAt,
          },
        ],
      },
      fixedNow.toISOString(),
    );

  await Promise.all([
    write(firstStore, '002001', '2026-04-30T12:00:00.000Z'),
    write(secondStore, '002002', '2026-04-30T12:00:01.000Z'),
  ]);

  const canonical = await firstStore.getSpaceState('13800138000', '2026-04-30');

  assert.deepEqual(Object.keys(canonical.states_by_card_id).sort(), [
    '002001',
    '002002',
  ]);
  assert.equal(db.transactionCount(), 2);
});

test('CloudBase store reads and seeds card source documents', async () => {
  const db = createFakeCloudBaseDb();
  await db
    .collection('softbook_card_sources')
    .doc('cet4')
    .set(createPersistedCardSource('cet4'));
  const firstApi = createTestApi({
    store: createCloudBaseStore({db}),
  });
  const secondApi = createTestApi({
    store: createCloudBaseStore({db}),
  });
  const token = await authenticatedToken(firstApi);
  const headers = {
    authorization: `Bearer ${token}`,
  };

  const persistedSource = await request(firstApi, {
    headers,
    method: 'GET',
    path: '/v1/learning/card-source',
    query: {
      track: 'cet4',
    },
  });
  const seededSource = await request(secondApi, {
    headers,
    method: 'GET',
    path: '/v1/learning/card-source',
    query: {
      track: 'cet6',
    },
  });

  assert.equal(persistedSource.statusCode, 200);
  assert.equal(persistedSource.body.data.source.id, 'persisted-cet4-source');
  assert.equal(persistedSource.body.data.card_records[0].card_id, '052199');
  assert.equal(seededSource.statusCode, 200);
  assert.equal(seededSource.body.data.source.id, 'cloudbase-dev-card-source');
  assert.equal(
    db.snapshot().get('softbook_card_sources').get('cet6').track,
    'cet6',
  );
  assert.ok(
    db
      .snapshot()
      .get('softbook_card_sources')
      .get('cet6')
      .card_records.every(card => card.track === 'cet6'),
  );
});

test('CloudBase store rejects invalid persisted card source documents', async () => {
  const db = createFakeCloudBaseDb();
  const invalidSource = createPersistedCardSource('cet4');
  invalidSource.card_records[0].space_metadata.box_ref = '9999';
  await db.collection('softbook_card_sources').doc('cet4').set(invalidSource);
  const api = createTestApi({
    store: createCloudBaseStore({db}),
  });
  const token = await authenticatedToken(api);
  const response = await request(api, {
    headers: {
      authorization: `Bearer ${token}`,
    },
    method: 'GET',
    path: '/v1/learning/card-source',
    query: {
      track: 'cet4',
    },
  });

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.error.code, 'invalid_card_source');
});

test('card source import validator shares runtime card-source contract', () => {
  const cardSource = createPersistedCardSource('cet4');
  const normalized = validateCardSourceForImport(cardSource, 'cet4');
  const mismatched = createPersistedCardSource('cet6');

  assert.equal(normalized.track, 'cet4');
  assert.equal(normalized.source.id, 'persisted-cet4-source');
  assert.equal(normalized.card_records[0].card_id, '052199');
  assert.throws(
    () => validateCardSourceForImport(mismatched, 'cet4'),
    /card source.track must match requested track cet4/,
  );
});

test('card source validator import does not initialize the default store', () => {
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      "const {validateCardSourceForImport}=require('./index'); console.log(typeof validateCardSourceForImport);",
    ],
    {
      cwd: __dirname + '/..',
      encoding: 'utf8',
      env: {
        ...process.env,
        SOFTBOOK_STORE_MODE: 'invalid',
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'function');
});

function createFakeCloudBaseDb() {
  const collections = new Map();
  let transactionCount = 0;
  let transactionTail = Promise.resolve();

  const collection = (name, transactional = false) => {
    if (!collections.has(name)) {
      collections.set(name, new Map());
    }

    const documents = collections.get(name);

    return {
      doc: documentId => ({
        get: async () => {
          const document = documents.has(documentId)
            ? {
                _id: documentId,
                ...cloneJson(documents.get(documentId)),
              }
            : null;
          return {
            data: transactional ? document : document ? [document] : [],
          };
        },
        set: async data => {
          documents.set(documentId, cloneJson(data));

          return {
            id: documentId,
          };
        },
      }),
      where: query => {
        if (transactional) {
          throw new Error('CloudBase transactions do not support where().');
        }

        const options = {limit: 100, offset: 0, order: null};
        const builder = {
          get: async () => {
            let entries = [...documents.entries()].filter(([, document]) =>
              Object.entries(query).every(
                ([key, value]) => document[key] === value,
              ),
            );

            if (options.order) {
              entries.sort(([leftId], [rightId]) =>
                options.order === 'desc'
                  ? rightId.localeCompare(leftId)
                  : leftId.localeCompare(rightId),
              );
            }

            return {
              data: entries
                .slice(options.offset, options.offset + options.limit)
                .map(([documentId, document]) => ({
                  _id: documentId,
                  ...cloneJson(document),
                })),
            };
          },
          limit: value => {
            options.limit = value;
            return builder;
          },
          orderBy: (_field, direction) => {
            options.order = direction;
            return builder;
          },
          skip: value => {
            options.offset = value;
            return builder;
          },
        };
        return builder;
      },
    };
  };

  return {
    collection,
    runTransaction: callback => {
      const run = transactionTail.then(async () => {
        transactionCount += 1;
        return callback({collection: name => collection(name, true)});
      });
      transactionTail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    snapshot: () => collections,
    transactionCount: () => transactionCount,
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createPersistedCardSource(track) {
  return {
    source: {
      id: `persisted-${track}-source`,
      label: `Persisted ${track.toUpperCase()} Source`,
    },
    track,
    card_records: [
      {
        card_id: track === 'cet6' ? '152199' : '052199',
        track,
        knowledge_ref: track === 'cet6' ? '1521' : '0521',
        interaction_id: 'multiple_choice',
        front: {
          eyebrow: '词汇 | 阅读高频词',
          prompt:
            'The committee postponed the vote because details were still ____.',
          support: '选出最符合句意的词。',
          context: '投票被推迟，说明关键信息还没有清楚。',
        },
        options: [
          {id: 'urgent', label: 'A', text: 'urgent'},
          {id: 'unclear', label: 'B', text: 'unclear'},
          {id: 'formal', label: 'C', text: 'formal'},
          {id: 'similar', label: 'D', text: 'similar'},
        ],
        answer_key: {
          correct_option: 'unclear',
        },
        auto_scoring: true,
        analysis: {
          title: '先顺着因果看语义',
          summary: '因为细节还不清楚才会推迟投票。',
          exam_tip: '四选一先把词放回原句，看前后逻辑是否闭合。',
        },
        space_metadata: {
          box_ref: track === 'cet6' ? '1521' : '0521',
          library: '词汇',
          group: '高频词',
          box: '阅读高频词',
        },
      },
    ],
  };
}

function createReleasedCardSource(track) {
  const source = createPersistedCardSource(track);
  const normalized = validateCardSourceForImport(source, track);

  return {
    ...source,
    release: {
      schema_version: 'content-release.v1',
      release_id: `${track}-test-release`,
      track,
      content_version: normalized.content_version,
      minimum_client_version: '1.0.0',
      parent_release_id: null,
      published_at: fixedNow.toISOString(),
    },
  };
}
