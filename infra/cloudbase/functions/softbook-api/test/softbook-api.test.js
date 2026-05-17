const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  createCloudBaseStore,
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

function createTestApi(options = {}) {
  return createSoftbookApi({
    now: () => fixedNow,
    smsCode: '2468',
    tokenSecret: 'test-secret',
    ...options,
  });
}

async function request(api, requestOptions) {
  const response = await api.handleHttpRequest({
    body: requestOptions.body,
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
}
);

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

  return {
    collection: name => {
      if (!collections.has(name)) {
        collections.set(name, new Map());
      }

      const documents = collections.get(name);

      return {
        doc: documentId => ({
          get: async () => ({
            data: documents.has(documentId)
              ? [
                  {
                    _id: documentId,
                    ...cloneJson(documents.get(documentId)),
                  },
                ]
              : [],
          }),
          set: async data => {
            documents.set(documentId, cloneJson(data));

            return {
              id: documentId,
            };
          },
        }),
      };
    },
    snapshot: () => collections,
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
          prompt: 'The committee postponed the vote because details were still ____.',
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
