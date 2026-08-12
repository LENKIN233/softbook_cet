const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const crypto = require('node:crypto');
const test = require('node:test');

const boxCatalog = require('../../../../../spec/box-catalog.json');
const {
  createCloudBaseStore,
  createMemoryStore,
  createSoftbookApi,
  validateCardSourceForImport,
} = require('../index');
const {
  createSpaceActionLineageId,
  createSpaceActionLedgerId,
  createSpaceStateId,
  createSpaceStateRevisionId,
  normalizeStoredSpaceState,
  prepareSpaceActionCommit,
} = require('../space-actions-v2');
const {stableJsonStringify} = require('../content-manifest-v1');

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

async function submitSpaceActions(
  api,
  session,
  actions,
  track = 'cet4',
  overrides = {},
) {
  const headers = {authorization: `Bearer ${session.access_token}`};
  const source = await request(api, {
    headers,
    method: 'GET',
    path: '/v1/learning/card-source',
    query: {track},
  });
  assert.equal(source.statusCode, 200);

  return request(api, {
    body: {
      schema_version: 'space-actions.v2',
      track,
      content_version: source.body.data.content_version,
      actions,
      ...overrides,
    },
    headers,
    method: 'POST',
    path: '/v2/space/actions',
  });
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
  assert.deepEqual(response.body.data.component_revisions, {
    schema_version: 'bootstrap-component-revisions.v1',
    learning: {
      event_server_sequence: 0,
      session_revision: 0,
      space_revision: 0,
    },
    membership: {
      base_membership_revision: 0,
      beta_entitlement_revision: 0,
    },
    progress: {
      check_in_revision: 0,
      learning_server_sequence: 0,
      space_revision: 0,
    },
    space: {state_revision: 0},
  });
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
    learning_authority: 'empty',
    pending_review_count: 0,
    review_completed_count: 0,
    sleeping_count: 0,
    total_completed_count: 0,
  });
  assert.deepEqual(response.body.data.space, {
    acknowledged_at: null,
    content_version: response.body.data.content.version,
    schema_version: 'space-state.v2',
    states: [],
    track: 'cet4',
  });
  assert.equal(JSON.stringify(response.body).includes('13800138000'), false);
});

test('v2 bootstrap reads account-wide Progress after requested-track Learning', async () => {
  const store = createMemoryStore();
  const calls = [];
  const getLearningState = store.getLearningState.bind(store);
  const getDailyProgress = store.getDailyProgress.bind(store);
  store.getLearningState = (...args) => {
    calls.push('learning');
    return getLearningState(...args);
  };
  store.getDailyProgress = (...args) => {
    calls.push('progress');
    return getDailyProgress(...args);
  };
  const api = createTestApi({store});
  const session = await authenticatedV2Session(api);
  calls.length = 0;

  const response = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-04-30', track: 'cet4'},
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, ['learning', 'progress']);
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
      learning_authority: 'legacy_account_baseline',
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
          server_sequence: 0,
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
    await store.seedLegacyDailyProgressForMigrationTest(
      '13800138000',
      Object.fromEntries(
        Object.entries(progress).filter(([key]) => key !== 'phone_number'),
      ),
      fixedNow.toISOString(),
    );
    await store.seedLegacyLearningStateForMigrationTest(
      '13800138000',
      {
        day_key: '2026-04-30',
        events: [event],
        source_id: 'cloudbase-dev-card-source',
        source_label: 'CloudBase 开发卡源',
        track: 'cet4',
      },
      fixedNow.toISOString(),
    );
    const appliedSpaceAction = await submitSpaceActions(api, first, [
      {
        action_id: 'space_bootstrap_favorite',
        card_id: spaceState.card_id,
        client_occurred_at: spaceState.last_modified_at,
        dimension: 'favorite',
        value: true,
      },
    ]);
    assert.equal(appliedSpaceAction.statusCode, 200);

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
    assert.deepEqual(firstBootstrap.body.data.component_revisions, {
      schema_version: 'bootstrap-component-revisions.v1',
      learning: {
        event_server_sequence: 0,
        session_revision: 0,
        space_revision: 1,
      },
      membership: {
        base_membership_revision: 1,
        beta_entitlement_revision: 0,
      },
      progress: {
        check_in_revision: 0,
        learning_server_sequence: 0,
        space_revision: 1,
      },
      space: {state_revision: 1},
    });
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

test('audio card assets are canonical, exact, and fully referenced', () => {
  const source = createAudioReleasedCardSource('cet4');
  const normalized = validateCardSourceForImport(source, 'cet4');

  assert.equal(normalized.assets.length, 1);
  assert.equal(
    normalized.card_records[0].audio.asset_id,
    'cet4.052199.prompt',
  );
  assert.equal(normalized.release.content_version, normalized.content_version);

  const missingAsset = cloneJson(source);
  missingAsset.assets = [];
  delete missingAsset.release;
  assert.throws(
    () => validateCardSourceForImport(missingAsset, 'cet4'),
    /references missing asset/,
  );

  const unreferencedAsset = cloneJson(source);
  delete unreferencedAsset.card_records[0].audio;
  delete unreferencedAsset.release;
  assert.throws(
    () => validateCardSourceForImport(unreferencedAsset, 'cet4'),
    /is not referenced by any card/,
  );

  const hashDrift = cloneJson(source);
  hashDrift.card_records[0].audio.sha256 = `sha256:${'b'.repeat(64)}`;
  delete hashDrift.release;
  assert.throws(
    () => validateCardSourceForImport(hashDrift, 'cet4'),
    /must match its asset hash and duration/,
  );

  const publicUrlInsteadOfPrivateFile = cloneJson(source);
  publicUrlInsteadOfPrivateFile.assets[0].storage_file_id =
    'https://example.com/audio.mp3';
  delete publicUrlInsteadOfPrivateFile.release;
  assert.throws(
    () => validateCardSourceForImport(publicUrlInsteadOfPrivateFile, 'cet4'),
    /must be a CloudBase file ID/,
  );

  const cardUrlLeak = cloneJson(source);
  cardUrlLeak.card_records[0].audio.download_url =
    'https://example.com/audio.mp3';
  delete cardUrlLeak.release;
  assert.throws(
    () => validateCardSourceForImport(cardUrlLeak, 'cet4'),
    /audio has unsupported or missing fields/,
  );
});

test('content manifest is authenticated, release-bound, signed, and storage-private', async () => {
  const store = createMemoryStore();
  const source = validateCardSourceForImport(
    createAudioReleasedCardSource('cet4'),
    'cet4',
  );
  store.snapshot().cardSources.set('cet4', source);
  const {privateKey, publicKey} = crypto.generateKeyPairSync('ed25519');
  const api = createTestApi({
    contentAssetUrlResolver: async ({asset}) =>
      `https://private-content.example/${asset.asset_id}.mp3?token=opaque`,
    contentManifestDownloadTtlSeconds: 600,
    contentManifestSigner: {
      keyId: 'content-key-2026-01',
      privateKey,
    },
    store,
  });
  await store.startTrial('13800138000', fixedNow.toISOString());
  const session = await authenticatedV2Session(api);
  const headers = {authorization: `Bearer ${session.access_token}`};
  const response = await request(api, {
    headers,
    method: 'GET',
    path: '/v2/content/manifest',
    query: {
      content_version: source.content_version,
      track: 'cet4',
    },
  });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.manifest.schema_version, 'content-manifest.v1');
  assert.equal(response.body.data.manifest.release_id, 'cet4-audio-release');
  assert.deepEqual(response.body.data.access, {
    accessible_card_count: 1,
    mode: 'full',
    total_card_count: 1,
  });
  assert.deepEqual(response.body.data.manifest.assets, [
    {
      asset_id: 'cet4.052199.prompt',
      duration_ms: 2100,
      media_type: 'audio/mpeg',
      sha256: `sha256:${'a'.repeat(64)}`,
      size_bytes: 4096,
    },
  ]);
  assert.equal(response.body.data.signature.algorithm, 'ed25519');
  assert.equal(response.body.data.signature.key_id, 'content-key-2026-01');
  assert.equal(
    crypto.verify(
      null,
      Buffer.from(
        stableJsonStringify({
          access: response.body.data.access,
          manifest: response.body.data.manifest,
        }),
      ),
      publicKey,
      Buffer.from(response.body.data.signature.value, 'hex'),
    ),
    true,
  );
  assert.deepEqual(response.body.data.downloads, [
    {
      asset_id: 'cet4.052199.prompt',
      expires_at: '2026-04-30T12:10:00.000Z',
      url: 'https://private-content.example/cet4.052199.prompt.mp3?token=opaque',
    },
  ]);
  assert.equal(JSON.stringify(response.body).includes('storage_file_id'), false);
  assert.equal(JSON.stringify(response.body).includes('cloud://'), false);

  const wrongVersion = await request(api, {
    headers,
    method: 'GET',
    path: '/v2/content/manifest',
    query: {
      content_version: `sha256:${'0'.repeat(64)}`,
      track: 'cet4',
    },
  });
  assert.equal(wrongVersion.statusCode, 409);
  assert.equal(
    wrongVersion.body.error.code,
    'content_manifest_version_mismatch',
  );

  const forbiddenIdentity = await request(api, {
    headers,
    method: 'GET',
    path: '/v2/content/manifest',
    query: {
      content_version: source.content_version,
      phone_number: '13800138000',
      track: 'cet4',
    },
  });
  assert.equal(forbiddenIdentity.statusCode, 400);
  assert.equal(
    forbiddenIdentity.body.error.code,
    'content_manifest_input_forbidden',
  );

  const unauthenticated = await request(api, {
    method: 'GET',
    path: '/v2/content/manifest',
    query: {
      content_version: source.content_version,
      track: 'cet4',
    },
  });
  assert.equal(unauthenticated.statusCode, 401);
});

test('content manifest grants download URLs only for the canonical membership prefix', async () => {
  const store = createMemoryStore();
  const source = validateCardSourceForImport(
    createMultiAudioReleasedCardSource('cet4'),
    'cet4',
  );
  store.snapshot().cardSources.set('cet4', source);
  store.snapshot().memberships.set('13800138000', {
    entitlement: {
      counted_entry_count: 1,
      last_experience_ended_by: 'trial',
      recovery_prompt_visible: true,
      stage: 'free',
      trial_duration_days: 5,
      trial_started_at_entry_count: 1,
    },
    updated_at: fixedNow.toISOString(),
  });
  const {privateKey} = crypto.generateKeyPairSync('ed25519');
  const requestedAssets = [];
  const api = createTestApi({
    contentAssetUrlResolver: async ({asset}) => {
      requestedAssets.push(asset.asset_id);
      return `https://private-content.example/${asset.asset_id}.mp3?token=opaque`;
    },
    contentManifestSigner: {keyId: 'content-key-2026-01', privateKey},
    store,
  });
  const session = await authenticatedV2Session(api);
  const response = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/content/manifest',
    query: {content_version: source.content_version, track: 'cet4'},
  });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body.data.access, {
    accessible_card_count: 1,
    mode: 'free_subset',
    total_card_count: 2,
  });
  assert.equal(response.body.data.manifest.assets.length, 2);
  assert.deepEqual(
    response.body.data.downloads.map(download => download.asset_id),
    ['cet4.052199.prompt'],
  );
  assert.deepEqual(requestedAssets, ['cet4.052199.prompt']);

  store.snapshot().memberships.delete('13800138000');
  store.snapshot().membershipRevisions.delete('13800138000');
  const trialNotStarted = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/content/manifest',
    query: {content_version: source.content_version, track: 'cet4'},
  });
  assert.equal(trialNotStarted.statusCode, 200);
  assert.deepEqual(trialNotStarted.body.data.access, {
    accessible_card_count: 0,
    mode: 'trial_not_started',
    total_card_count: 2,
  });
  assert.deepEqual(trialNotStarted.body.data.downloads, []);
});

test('content manifest fails closed without delivery or signing configuration', async () => {
  const store = createMemoryStore();
  const source = validateCardSourceForImport(
    createAudioReleasedCardSource('cet4'),
    'cet4',
  );
  store.snapshot().cardSources.set('cet4', source);
  const api = createTestApi({store});
  const session = await authenticatedV2Session(api);
  const response = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/content/manifest',
    query: {
      content_version: source.content_version,
      track: 'cet4',
    },
  });

  assert.equal(response.statusCode, 503);
  assert.equal(
    response.body.error.code,
    'content_manifest_signing_unavailable',
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
  assert.equal(db.snapshot().get('softbook_daily_check_ins').size, 0);
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
  assert.equal(
    db.snapshot().get('softbook_card_sources').get('cet4').release.release_id,
    'cet4-test-release',
  );
  const available = await requestSession();

  assert.equal(available.statusCode, 200, JSON.stringify(available.body));
  assert.equal(available.body.data.membership_stage, 'trial');
  assert.equal(available.body.data.selection.reason, 'catalog_new');
  assert.equal(db.snapshot().get('softbook_memberships').size, 1);
  assert.equal(db.snapshot().get('softbook_learning_sessions').size, 1);
});

test('CloudBase canonical check-in survives separate function instances', async () => {
  const db = createFakeCloudBaseDb();
  const firstApi = createTestApi({store: createCloudBaseStore({db})});
  const secondApi = createTestApi({store: createCloudBaseStore({db})});
  const session = await authenticatedV2Session(firstApi);
  const headers = {authorization: `Bearer ${session.access_token}`};

  const checkedIn = await request(firstApi, {
    body: {
      day_key: '2026-04-30',
    },
    headers,
    method: 'POST',
    path: '/v2/progress/check-in',
  });
  const restored = await request(secondApi, {
    headers,
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-04-30', track: 'cet4'},
  });

  assert.equal(checkedIn.statusCode, 200);
  assert.equal(checkedIn.body.data.schema_version, 'daily-check-in.v2');
  assert.equal(restored.statusCode, 200);
  assert.equal(restored.body.data.progress.checked_in_today, true);
  assert.equal(restored.body.data.progress.total_completed_count, 0);
  assert.equal(restored.body.data.progress.pending_review_count, 0);
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

test('CloudBase pilot round acknowledgement survives separate function instances', async () => {
  const db = createFakeCloudBaseDb();
  const firstStore = createCloudBaseStore({db});
  const secondStore = createCloudBaseStore({db});
  const input = {
    accountKey: 'account-key-round-persistence',
    acknowledgedAt: '2026-04-30T12:00:00.000Z',
    completedCount: 5,
    contentVersion: `sha256:${'a'.repeat(64)}`,
    pilotId: 'cet4-controlled-pilot-round-persistence',
    receiptId: `prc_${'b'.repeat(43)}`,
    track: 'cet4',
  };

  const saved = await firstStore.savePilotRoundContinuation(input);
  const restored = await secondStore.getPilotRoundContinuation(input);
  const replayed = await secondStore.savePilotRoundContinuation(input);

  assert.equal(Object.hasOwn(restored, '_id'), false);
  assert.deepEqual(replayed, saved);
  assert.deepEqual(restored, {
    account_key: input.accountKey,
    acknowledged_at: input.acknowledgedAt,
    completed_count: input.completedCount,
    content_version: input.contentVersion,
    pilot_id: input.pilotId,
    receipt_id: input.receiptId,
    schema_version: 'pilot-round-continue-ack.v1',
    track: input.track,
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

test('trial clock lasts exactly 120 hours and expires atomically at the boundary', async () => {
  const stores = [
    createMemoryStore(),
    createCloudBaseStore({db: createFakeCloudBaseDb()}),
  ];
  const startedAt = '2026-04-30T12:00:00.000Z';
  const justBeforeExpiry = '2026-05-05T11:59:59.001Z';
  const expiresAt = '2026-05-05T12:00:00.000Z';

  for (const store of stores) {
    const started = await store.startTrial('13800138000', startedAt);
    assert.equal(started.stage, 'trial');
    assert.equal(started.trial_started_at, startedAt);
    assert.equal(started.trial_expires_at, expiresAt);
    assert.equal(started.trial_remaining_seconds, 432000);

    const before = await store.getMembership(
      '13800138000',
      justBeforeExpiry,
    );
    assert.equal(before.stage, 'trial');
    assert.equal(before.trial_remaining_seconds, 1);

    const expired = await store.getMembership('13800138000', expiresAt);
    assert.equal(expired.stage, 'free');
    assert.equal(expired.last_experience_ended_by, 'trial');
    assert.equal(expired.recovery_prompt_visible, true);
    assert.equal(expired.trial_remaining_seconds, 0);
    assert.equal(
      expired.component_revision.base_membership_revision,
      before.component_revision.base_membership_revision + 1,
    );

    const replay = await store.getMembership('13800138000', expiresAt);
    assert.equal(replay.stage, 'free');
    assert.equal(
      replay.component_revision.base_membership_revision,
      expired.component_revision.base_membership_revision,
    );
  }
});

test('bootstrap rejects corrupted persisted canonical state', async () => {
  const store = createMemoryStore();
  const api = createTestApi({store});
  const session = await authenticatedV2Session(api);
  const headers = {authorization: `Bearer ${session.access_token}`};

  await store.seedLegacyDailyProgressForMigrationTest(
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

test('memory bootstrap preserves a legacy account pending-review baseline across days', async () => {
  const store = createMemoryStore();
  const api = createTestApi({store});
  const session = await authenticatedV2Session(api);
  const headers = {authorization: `Bearer ${session.access_token}`};

  await store.seedLegacyDailyProgressForMigrationTest(
    '13800138000',
    {
      checked_in_today: false,
      day_key: '2026-04-30',
      favorite_count: 0,
      learning_completed_count: 1,
      pending_review_count: 1,
      review_completed_count: 0,
      sleeping_count: 0,
      total_completed_count: 1,
    },
    '2026-04-30T12:00:00.000Z',
  );

  const firstDay = await request(api, {
    headers,
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-04-30', track: 'cet4'},
  });
  const nextDay = await request(api, {
    headers,
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-05-01', track: 'cet4'},
  });

  for (const response of [firstDay, nextDay]) {
    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.progress.pending_review_count, 1);
    assert.equal(
      response.body.data.progress.learning_authority,
      'legacy_account_baseline',
    );
    assert.equal(
      response.body.data.component_revisions.progress
        .learning_server_sequence,
      0,
    );
  }
});

test('CloudBase bootstrap preserves a legacy account pending-review baseline across days', async () => {
  const db = createFakeCloudBaseDb();
  const store = createCloudBaseStore({db});
  const api = createTestApi({store});
  const session = await authenticatedV2Session(
    api,
    '13800138004',
    '127.0.0.24',
  );
  const headers = {authorization: `Bearer ${session.access_token}`};

  await store.seedLegacyDailyProgressForMigrationTest(
    '13800138004',
    {
      checked_in_today: false,
      day_key: '2026-04-30',
      favorite_count: 0,
      learning_completed_count: 1,
      pending_review_count: 1,
      review_completed_count: 0,
      sleeping_count: 0,
      total_completed_count: 1,
    },
    '2026-04-30T12:00:00.000Z',
  );

  const firstDay = await request(api, {
    headers,
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-04-30', track: 'cet4'},
  });
  const nextDay = await request(api, {
    headers,
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-05-01', track: 'cet4'},
  });

  for (const response of [firstDay, nextDay]) {
    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.progress.pending_review_count, 1);
    assert.equal(
      response.body.data.progress.learning_authority,
      'legacy_account_baseline',
    );
    assert.equal(
      response.body.data.component_revisions.progress
        .learning_server_sequence,
      0,
    );
  }
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

test('base membership revisions disambiguate same-millisecond writes and migrate legacy documents', async () => {
  const stores = [
    createMemoryStore(),
    createCloudBaseStore({db: createFakeCloudBaseDb()}),
  ];

  for (const store of stores) {
    assert.deepEqual((await store.getMembership('13800138000')).component_revision, {
      base_membership_revision: 0,
      beta_entitlement_revision: 0,
    });

    await store.startTrial('13800138000', fixedNow.toISOString());
    assert.equal(
      (await store.getMembership('13800138000')).component_revision
        .base_membership_revision,
      1,
    );

    await store.purchase('13800138000', fixedNow.toISOString());
    assert.equal(
      (await store.getMembership('13800138000')).component_revision
        .base_membership_revision,
      2,
    );

    await store.dismissRecovery('13800138000', fixedNow.toISOString());
    assert.equal(
      (await store.getMembership('13800138000')).component_revision
        .base_membership_revision,
      3,
    );
  }

  const legacyStore = createMemoryStore();
  legacyStore.snapshot().memberships.set('13800138000', {
    entitlement: {
      counted_entry_count: 0,
      last_experience_ended_by: null,
      recovery_prompt_visible: false,
      stage: 'trial_available',
      trial_duration_days: 5,
      trial_started_at_entry_count: null,
    },
    updated_at: fixedNow.toISOString(),
  });
  assert.equal(
    legacyStore.getMembership('13800138000').component_revision
      .base_membership_revision,
    1,
  );
  legacyStore.purchase('13800138000', fixedNow.toISOString());
  assert.equal(
    legacyStore.getMembership('13800138000').component_revision
      .base_membership_revision,
    2,
  );
});

test('membership revision sidecar survives previous-package writes without regressing', async () => {
  const db = createFakeCloudBaseDb();
  const store = createCloudBaseStore({db});
  const phoneNumber = '13800138000';

  await store.startTrial(phoneNumber, fixedNow.toISOString());
  await store.purchase(phoneNumber, fixedNow.toISOString());
  await store.dismissRecovery(phoneNumber, fixedNow.toISOString());
  assert.equal(
    (await store.getMembership(phoneNumber)).component_revision
      .base_membership_revision,
    3,
  );

  const businessDocument = db
    .snapshot()
    .get('softbook_memberships')
    .get(phoneNumber);
  assert.deepEqual(Object.keys(businessDocument).sort(), [
    'entitlement',
    'phone_number',
    'updated_at',
  ]);

  await db.collection('softbook_memberships').doc(phoneNumber).set({
    entitlement: {
      ...businessDocument.entitlement,
      stage: 'free',
    },
    phone_number: phoneNumber,
    updated_at: '2026-04-30T12:00:01.000Z',
  });

  const reconciled = await store.getMembership(phoneNumber);
  assert.equal(reconciled.stage, 'free');
  assert.equal(
    reconciled.component_revision.base_membership_revision,
    4,
  );
  assert.equal(
    (await store.getMembership(phoneNumber)).component_revision
      .base_membership_revision,
    4,
  );
  assert.equal(
    db.snapshot()
      .get('softbook_membership_revisions')
      .get(phoneNumber).revision,
    4,
  );
});

test('membership business state cannot be relabeled to another document owner', async () => {
  const db = createFakeCloudBaseDb();
  const store = createCloudBaseStore({db});
  const phoneNumber = '13800138000';

  await db.collection('softbook_memberships').doc(phoneNumber).set({
    entitlement: {
      counted_entry_count: 0,
      last_experience_ended_by: null,
      recovery_prompt_visible: false,
      stage: 'premium',
      trial_duration_days: 5,
      trial_started_at_entry_count: null,
    },
    phone_number: '13900139000',
    updated_at: fixedNow.toISOString(),
  });

  await assert.rejects(
    () => store.getMembership(phoneNumber),
    error => error.code === 'invalid_membership_revision',
  );
  assert.equal(
    db.snapshot().get('softbook_membership_revisions')?.has(phoneNumber) ?? false,
    false,
  );
});

test('membership business state and sidecar roll back atomically', async () => {
  const db = createFakeCloudBaseDb();
  const store = createCloudBaseStore({db});
  const phoneNumber = '13800138000';
  db.failNextTransactionSet('softbook_membership_revisions');

  await assert.rejects(
    () => store.purchase(phoneNumber, fixedNow.toISOString()),
    /injected transaction set failure/,
  );
  assert.equal(db.snapshot().get('softbook_memberships').size, 0);
  assert.equal(db.snapshot().get('softbook_membership_revisions').size, 0);

  await store.purchase(phoneNumber, fixedNow.toISOString());
  assert.equal(
    (await store.getMembership(phoneNumber)).component_revision
      .base_membership_revision,
    1,
  );
});

test('v2 check-in is strict while legacy snapshot writes stay disabled', async () => {
  const api = createTestApi();
  const session = await authenticatedV2Session(api);
  const headers = {
    authorization: `Bearer ${session.access_token}`,
  };

  const daily = await request(api, {
    body: {
      day_key: '2026-04-30',
    },
    headers,
    method: 'POST',
    path: '/v2/progress/check-in',
  });
  const invalidDaily = await request(api, {
    body: {
      day_key: '2026-04-30',
      favorite_count: 1,
      phone_number: '13800138000',
    },
    headers,
    method: 'POST',
    path: '/v2/progress/check-in',
  });
  const invalidDay = await request(api, {
    body: {
      day_key: '2026-02-30',
    },
    headers,
    method: 'POST',
    path: '/v2/progress/check-in',
  });
  const invalidShapes = await Promise.all(
    [undefined, null, [], '2026-04-30', {}, {day_key: 20260430}].map(body =>
      request(api, {
        body,
        headers,
        method: 'POST',
        path: '/v2/progress/check-in',
      }),
    ),
  );
  const missingSession = await request(api, {
    body: {
      day_key: '2026-04-30',
    },
    method: 'POST',
    path: '/v2/progress/check-in',
  });
  const legacyLearning = await request(api, {
    body: {
      day_key: '2026-04-30',
      events: [],
      phone_number: '13800138000',
      source_id: 'cloudbase-dev-card-source',
      source_label: 'CloudBase 开发卡源',
      track: 'cet4',
    },
    headers,
    method: 'POST',
    path: '/v1/learning/state-sync',
  });
  const legacyDaily = await request(api, {
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
  assert.deepEqual(daily.body.data, {
    acknowledged_at: fixedNow.toISOString(),
    checked_in_today: true,
    day_key: '2026-04-30',
    schema_version: 'daily-check-in.v2',
  });
  assert.equal(invalidDaily.statusCode, 400);
  assert.equal(invalidDaily.body.error.code, 'invalid_daily_check_in');
  assert.equal(invalidDay.statusCode, 400);
  assert.equal(invalidDay.body.error.code, 'invalid_daily_check_in');
  invalidShapes.forEach(response => {
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error.code, 'invalid_daily_check_in');
  });
  assert.equal(missingSession.statusCode, 401);
  assert.equal(missingSession.body.error.code, 'missing_auth_token');
  assert.equal(legacyDaily.statusCode, 410);
  assert.equal(legacyDaily.body.error.code, 'legacy_snapshot_write_disabled');
  assert.equal(legacyLearning.statusCode, 410);
  assert.equal(
    legacyLearning.body.error.code,
    'legacy_snapshot_write_disabled',
  );
  assert.equal(space.statusCode, 410);
  assert.equal(space.body.error.code, 'legacy_space_snapshot_disabled');
});

test('v2 check-in is monotonic and idempotent in memory and CloudBase', async () => {
  const variants = [
    ['memory', createMemoryStore()],
    ['cloudbase', createCloudBaseStore({db: createFakeCloudBaseDb()})],
  ];

  for (const [name, store] of variants) {
    let now = new Date('2026-04-30T12:00:00.000Z');
    const api = createSoftbookApi({
      now: () => new Date(now),
      smsCode: '2468',
      store,
      tokenSecret: `check-in-idempotence-${name}`,
    });
    const session = await authenticatedV2Session(
      api,
      '13800138000',
      name === 'memory' ? '127.0.0.61' : '127.0.0.62',
    );
    const requestCheckIn = () =>
      request(api, {
        body: {day_key: '2026-04-30'},
        headers: {authorization: `Bearer ${session.access_token}`},
        method: 'POST',
        path: '/v2/progress/check-in',
      });

    const first = await requestCheckIn();
    now = new Date('2026-04-30T12:05:00.000Z');
    const replay = await requestCheckIn();
    const bootstrap = await request(api, {
      headers: {authorization: `Bearer ${session.access_token}`},
      method: 'GET',
      path: '/v2/bootstrap',
      query: {day_key: '2026-04-30', track: 'cet4'},
    });

    assert.equal(first.statusCode, 200, name);
    assert.equal(replay.statusCode, 200, name);
    assert.equal(
      replay.body.data.acknowledged_at,
      first.body.data.acknowledged_at,
      name,
    );
    assert.equal(replay.body.data.checked_in_today, true, name);
    assert.equal(
      bootstrap.body.data.component_revisions.progress.check_in_revision,
      1,
      name,
    );
  }
});

test('corrupted canonical check-in fails closed on write and bootstrap read', async () => {
  const store = createMemoryStore();
  const api = createTestApi({store});
  const session = await authenticatedV2Session(api);
  const headers = {authorization: `Bearer ${session.access_token}`};
  const requestCheckIn = () =>
    request(api, {
      body: {day_key: '2026-04-30'},
      headers,
      method: 'POST',
      path: '/v2/progress/check-in',
    });
  const first = await requestCheckIn();

  assert.equal(first.statusCode, 200);
  const persisted = [...store.snapshot().dailyCheckIns.values()][0];
  persisted.schema_version = 'daily-check-in.corrupt';

  const repeated = await requestCheckIn();
  assert.equal(repeated.statusCode, 500);
  assert.equal(
    repeated.body.error.code,
    'daily_check_in_projection_invalid',
  );

  persisted.schema_version = 'daily-check-in.v2';
  persisted.total_completed_count = 0;
  const bootstrap = await request(api, {
    headers,
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-04-30', track: 'cet4'},
  });
  assert.equal(bootstrap.statusCode, 500);
  assert.equal(
    bootstrap.body.error.code,
    'daily_check_in_projection_invalid',
  );
});

test('CloudBase check-in accepts only its system id beyond the business schema', async () => {
  const db = createFakeCloudBaseDb();
  const api = createTestApi({store: createCloudBaseStore({db})});
  const session = await authenticatedV2Session(
    api,
    '13800138000',
    '127.0.0.65',
  );
  const requestCheckIn = () =>
    request(api, {
      body: {day_key: '2026-04-30'},
      headers: {authorization: `Bearer ${session.access_token}`},
      method: 'POST',
      path: '/v2/progress/check-in',
    });

  const first = await requestCheckIn();
  const replayWithSystemId = await requestCheckIn();
  assert.equal(first.statusCode, 200);
  assert.equal(replayWithSystemId.statusCode, 200);

  const persisted = [
    ...db.snapshot().get('softbook_daily_check_ins').values(),
  ][0];
  persisted.total_completed_count = 0;

  const replayWithUnknownField = await requestCheckIn();
  assert.equal(replayWithUnknownField.statusCode, 500);
  assert.equal(
    replayWithUnknownField.body.error.code,
    'daily_check_in_projection_invalid',
  );
});

test('space actions merge dimensions independently and keep immutable idempotency', async () => {
  const stores = [
    createMemoryStore(),
    createCloudBaseStore({db: createFakeCloudBaseDb()}),
  ];

  for (const store of stores) {
    const api = createTestApi({store});
    const session = await authenticatedV2Session(api);
    const favorite = {
      action_id: 'space_favorite_first',
      card_id: '002001',
      client_occurred_at: '2026-04-30T12:00:00.000Z',
      dimension: 'favorite',
      value: true,
    };
    const first = await submitSpaceActions(api, session, [favorite]);
    const readBootstrap = () =>
      request(api, {
        headers: {authorization: `Bearer ${session.access_token}`},
        method: 'GET',
        path: '/v2/bootstrap',
        query: {day_key: '2026-04-30', track: 'cet4'},
      });
    const afterFirst = await readBootstrap();
    const independentSleep = await submitSpaceActions(api, session, [
      {
        action_id: 'space_sleep_independent',
        card_id: '002001',
        client_occurred_at: '2026-04-30T12:01:00.000Z',
        dimension: 'sleep',
        value: true,
      },
    ]);
    const afterSleep = await readBootstrap();
    const staleFavorite = await submitSpaceActions(api, session, [
      {
        action_id: 'space_favorite_stale',
        card_id: '002001',
        client_occurred_at: '2026-04-30T11:00:00.000Z',
        dimension: 'favorite',
        value: false,
      },
    ]);
    const afterStale = await readBootstrap();
    const duplicate = await submitSpaceActions(api, session, [favorite]);
    const afterDuplicate = await readBootstrap();
    const conflict = await submitSpaceActions(api, session, [
      {...favorite, value: false},
    ]);

    assert.equal(first.statusCode, 200);
    assert.equal(independentSleep.statusCode, 200);
    assert.equal(staleFavorite.statusCode, 200);
    assert.deepEqual(staleFavorite.body.data.results, [
      {action_id: 'space_favorite_stale', status: 'stale'},
    ]);
    assert.equal(duplicate.statusCode, 200, JSON.stringify(duplicate.body));
    assert.deepEqual(duplicate.body.data.results, [
      {action_id: 'space_favorite_first', status: 'duplicate'},
    ]);
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.body.error.code, 'space_action_id_conflict');
    assert.equal(
      afterFirst.body.data.component_revisions.space.state_revision,
      1,
    );
    assert.equal(
      afterSleep.body.data.component_revisions.space.state_revision,
      2,
    );
    assert.equal(
      afterStale.body.data.component_revisions.space.state_revision,
      3,
    );
    assert.equal(
      afterDuplicate.body.data.component_revisions.space.state_revision,
      3,
    );
    assert.equal(
      afterDuplicate.body.data.component_revisions.learning.space_revision,
      3,
    );
    assert.equal(
      afterDuplicate.body.data.component_revisions.progress.space_revision,
      3,
    );
    assert.deepEqual(duplicate.body.data.space_state.states, [
      {
        card_id: '002001',
        is_favorited: true,
        is_sleeping: true,
        last_modified_at: '2026-04-30T12:01:00.000Z',
      },
    ]);
  }
});

test('space sidecars recover a directly proven previous-package commit without changing the old state schema', async () => {
  const db = createFakeCloudBaseDb();
  const store = createCloudBaseStore({db});
  const api = createTestApi({store});
  const session = await authenticatedV2Session(api);
  const firstAction = {
    action_id: 'space_current_writer_first',
    card_id: '002001',
    client_occurred_at: '2026-04-30T11:00:00.000Z',
    dimension: 'favorite',
    value: true,
  };
  assert.equal(
    (await submitSpaceActions(api, session, [firstAction])).statusCode,
    200,
  );
  const accountKey = [
    ...db.snapshot().get('softbook_auth_sessions').values(),
  ][0].account_key;
  const stateId = createSpaceStateId(accountKey);
  const previousWriterAction = {
    action_id: 'space_previous_writer_sleep',
    card_id: '002001',
    client_occurred_at: '2026-04-30T11:01:00.000Z',
    dimension: 'sleep',
    value: true,
  };
  const previousWriterCommit = prepareSpaceActionCommit({
    acknowledgedAt: '2026-04-30T12:00:01.000Z',
    accountKey,
    actions: [previousWriterAction],
    ledgerByActionId: new Map([[previousWriterAction.action_id, null]]),
    state: db.snapshot().get('softbook_space_states').get(stateId),
  });
  const previousWriterState = cloneJson(previousWriterCommit.state);
  delete previousWriterState.revision;

  await db.runTransaction(async transaction => {
    await transaction
      .collection('softbook_space_actions')
      .doc(createSpaceActionLedgerId(accountKey, previousWriterAction.action_id))
      .set(previousWriterCommit.ledgers[0]);
    await transaction
      .collection('softbook_space_states')
      .doc(stateId)
      .set(previousWriterState);
  });

  const replay = await submitSpaceActions(api, session, [previousWriterAction]);
  assert.equal(replay.statusCode, 200, JSON.stringify(replay.body));
  assert.deepEqual(replay.body.data.results, [
    {action_id: previousWriterAction.action_id, status: 'duplicate'},
  ]);
  const revision = db
    .snapshot()
    .get('softbook_space_state_revisions')
    .get(createSpaceStateRevisionId(accountKey));
  const lineage = db
    .snapshot()
    .get('softbook_space_action_lineages')
    .get(createSpaceActionLineageId(accountKey, previousWriterAction.action_id));
  assert.equal(revision.revision, 2);
  assert.equal(lineage.committed_state_revision, 2);
  assert.equal(lineage.committed_lineage_digest, revision.lineage_digest);
  assert.deepEqual(
    Object.keys(db.snapshot().get('softbook_space_states').get(stateId)).sort(),
    [
      'account_key',
      'acknowledged_at',
      'schema_version',
      'states_by_card_id',
    ],
  );
});

test('space ledger, lineage, revision, and state roll back after a ledger-stage failure', async () => {
  const db = createFakeCloudBaseDb();
  const store = createCloudBaseStore({db});
  const input = {
    acknowledgedAt: fixedNow.toISOString(),
    accountKey: 'account-space-staged-rollback',
    actions: [
      {
        action_id: 'space_staged_rollback',
        card_id: '002001',
        client_occurred_at: fixedNow.toISOString(),
        dimension: 'favorite',
        value: true,
      },
    ],
    phoneNumber: '13800138000',
  };
  db.failNextTransactionSet('softbook_space_states');

  await assert.rejects(
    () => store.commitSpaceActions(input),
    /injected transaction set failure/,
  );
  for (const collection of [
    'softbook_space_actions',
    'softbook_space_action_lineages',
    'softbook_space_state_revisions',
    'softbook_space_states',
  ]) {
    assert.equal(db.snapshot().get(collection).size, 0, collection);
  }

  const retried = await store.commitSpaceActions(input);
  assert.deepEqual(retried.results, [
    {action_id: 'space_staged_rollback', status: 'applied'},
  ]);
  assert.equal(retried.state.revision, 1);
});

test('an unproven previous-writer ledger never becomes a duplicate acknowledgement', async () => {
  const db = createFakeCloudBaseDb();
  const store = createCloudBaseStore({db});
  const api = createTestApi({store});
  const session = await authenticatedV2Session(api);
  const currentAction = {
    action_id: 'space_lineage_current',
    card_id: '002001',
    client_occurred_at: '2026-04-30T12:00:00.000Z',
    dimension: 'favorite',
    value: false,
  };
  await submitSpaceActions(api, session, [currentAction]);
  const accountKey = [
    ...db.snapshot().get('softbook_auth_sessions').values(),
  ][0].account_key;
  const orphanAction = {
    ...currentAction,
    action_id: 'space_lineage_unproven_orphan',
    client_occurred_at: '2026-04-30T11:00:00.000Z',
    value: true,
  };
  const orphan = prepareSpaceActionCommit({
    acknowledgedAt: fixedNow.toISOString(),
    accountKey,
    actions: [orphanAction],
    ledgerByActionId: new Map([[orphanAction.action_id, null]]),
    state: null,
  }).ledgers[0];
  await db
    .collection('softbook_space_actions')
    .doc(createSpaceActionLedgerId(accountKey, orphanAction.action_id))
    .set(orphan);

  const replay = await submitSpaceActions(api, session, [orphanAction]);
  assert.equal(replay.statusCode, 500);
  assert.equal(replay.body.error.code, 'space_state_invalid');
  assert.equal(
    db.snapshot()
      .get('softbook_space_action_lineages')
      .has(createSpaceActionLineageId(accountKey, orphanAction.action_id)),
    false,
  );
  assert.equal(
    db.snapshot()
      .get('softbook_space_state_revisions')
      .get(createSpaceStateRevisionId(accountKey)).revision,
    1,
  );
});

test('current checkpoint rejects a coordinated ledger and lineage result rewrite', async () => {
  const db = createFakeCloudBaseDb();
  const store = createCloudBaseStore({db});
  const api = createTestApi({store});
  const session = await authenticatedV2Session(api);
  const action = {
    action_id: 'space_binding_tamper',
    card_id: '002001',
    client_occurred_at: '2026-04-30T12:00:00.000Z',
    dimension: 'favorite',
    value: true,
  };
  assert.equal((await submitSpaceActions(api, session, [action])).statusCode, 200);
  const accountKey = [
    ...db.snapshot().get('softbook_auth_sessions').values(),
  ][0].account_key;
  const ledger = db
    .snapshot()
    .get('softbook_space_actions')
    .get(createSpaceActionLedgerId(accountKey, action.action_id));
  const lineage = db
    .snapshot()
    .get('softbook_space_action_lineages')
    .get(createSpaceActionLineageId(accountKey, action.action_id));
  ledger.result = 'stale';
  lineage.result = 'stale';

  const replay = await submitSpaceActions(api, session, [action]);
  assert.equal(replay.statusCode, 500);
  assert.equal(replay.body.error.code, 'space_state_invalid');
});

test('mixed duplicate, stale, and new space actions share one committed revision', async () => {
  const db = createFakeCloudBaseDb();
  const store = createCloudBaseStore({db});
  const accountKey = 'account-space-mixed-lineage';
  const existing = {
    action_id: 'space_mixed_existing',
    card_id: '002001',
    client_occurred_at: '2026-04-30T12:00:00.000Z',
    dimension: 'favorite',
    value: true,
  };
  await store.commitSpaceActions({
    acknowledgedAt: fixedNow.toISOString(),
    accountKey,
    actions: [existing],
    phoneNumber: '13800138000',
  });
  const mixed = await store.commitSpaceActions({
    acknowledgedAt: '2026-04-30T12:00:01.000Z',
    accountKey,
    actions: [
      existing,
      {
        ...existing,
        action_id: 'space_mixed_stale',
        client_occurred_at: '2026-04-30T11:00:00.000Z',
        value: false,
      },
      {
        ...existing,
        action_id: 'space_mixed_sleep',
        dimension: 'sleep',
      },
    ],
    phoneNumber: '13800138000',
  });

  assert.deepEqual(mixed.results, [
    {action_id: 'space_mixed_existing', status: 'duplicate'},
    {action_id: 'space_mixed_stale', status: 'stale'},
    {action_id: 'space_mixed_sleep', status: 'applied'},
  ]);
  assert.equal(mixed.state.revision, 2);
  assert.equal(db.snapshot().get('softbook_space_actions').size, 3);
  assert.equal(db.snapshot().get('softbook_space_action_lineages').size, 3);
});

test('space action state maps treat prototype-like card ids as data keys', () => {
  const accountKey = 'account-prototype-card';
  const action = {
    action_id: 'space_prototype_card_action',
    card_id: 'toString',
    client_occurred_at: '2026-04-30T12:00:00.000Z',
    dimension: 'favorite',
    value: true,
  };
  const commit = prepareSpaceActionCommit({
    acknowledgedAt: fixedNow.toISOString(),
    accountKey,
    actions: [action],
    ledgerByActionId: new Map([[action.action_id, null]]),
    state: null,
  });

  assert.deepEqual(commit.state.states_by_card_id.toString, {
    card_id: 'toString',
    favorite_action_id: action.action_id,
    favorite_changed_at: action.client_occurred_at,
    is_favorited: true,
    is_sleeping: false,
    sleep_action_id: null,
    sleep_changed_at: null,
  });
  assert.equal(commit.state.revision, 1);
  assert.deepEqual(normalizeStoredSpaceState(commit.state, accountKey), commit.state);

  const legacyState = {...commit.state};
  delete legacyState.revision;
  assert.equal(normalizeStoredSpaceState(legacyState, accountKey).revision, 1);
});

test('space action replay fails closed when a ledger is orphaned from canonical state', () => {
  const accountKey = 'account-orphan-ledger';
  const action = {
    action_id: 'space_orphan_ledger_action',
    card_id: '002001',
    client_occurred_at: fixedNow.toISOString(),
    dimension: 'favorite',
    value: true,
  };
  const committed = prepareSpaceActionCommit({
    acknowledgedAt: fixedNow.toISOString(),
    accountKey,
    actions: [action],
    ledgerByActionId: new Map([[action.action_id, null]]),
    state: null,
  });

  assert.throws(
    () =>
      prepareSpaceActionCommit({
        acknowledgedAt: fixedNow.toISOString(),
        accountKey,
        actions: [action],
        ledgerByActionId: new Map([
          [action.action_id, committed.ledgers[0]],
        ]),
        state: null,
      }),
    /no verified committed-state lineage/,
  );
});

test('space actions reject identity, snapshot, time, batch, and content authority drift before writes', async () => {
  const store = createMemoryStore();
  const api = createTestApi({store});
  const session = await authenticatedV2Session(api);
  const headers = {authorization: `Bearer ${session.access_token}`};
  const source = await request(api, {
    headers,
    method: 'GET',
    path: '/v1/learning/card-source',
    query: {track: 'cet4'},
  });
  const contentVersion = source.body.data.content_version;
  const action = {
    action_id: 'space_strict_action',
    card_id: '002001',
    client_occurred_at: fixedNow.toISOString(),
    dimension: 'favorite',
    value: true,
  };
  const body = {
    actions: [action],
    content_version: contentVersion,
    schema_version: 'space-actions.v2',
    track: 'cet4',
  };
  const post = (nextBody, nextHeaders = headers) =>
    request(api, {
      body: nextBody,
      headers: nextHeaders,
      method: 'POST',
      path: '/v2/space/actions',
    });
  const missingSession = await post(body, {});
  const forbiddenAuthority = await post({
    ...body,
    day_key: '2026-04-30',
    favorite_count: 1,
    phone_number: '13800138000',
  });
  const unknownActionField = await post({
    ...body,
    actions: [{...action, is_favorited: true}],
  });
  const impossibleTimestamp = await post({
    ...body,
    actions: [
      {
        ...action,
        action_id: 'space_invalid_calendar',
        client_occurred_at: '2026-02-30T12:00:00.000Z',
      },
    ],
  });
  const futureTimestamp = await post({
    ...body,
    actions: [
      {
        ...action,
        action_id: 'space_future_action',
        client_occurred_at: '2026-04-30T12:05:00.001Z',
      },
    ],
  });
  const duplicateBatchId = await post({
    ...body,
    actions: [action, {...action}],
  });
  const oversizedBatch = await post({
    ...body,
    actions: Array.from({length: 21}, (_, index) => ({
      ...action,
      action_id: `space_oversized_${index}`,
    })),
  });
  const unknownCard = await post({
    ...body,
    actions: [{...action, action_id: 'space_unknown_card', card_id: '999999'}],
  });
  const mismatchedContent = await post({
    ...body,
    content_version: `sha256:${'0'.repeat(64)}`,
  });

  assert.equal(missingSession.statusCode, 401);
  assert.equal(missingSession.body.error.code, 'missing_auth_token');
  for (const response of [
    forbiddenAuthority,
    unknownActionField,
    impossibleTimestamp,
    futureTimestamp,
    duplicateBatchId,
    oversizedBatch,
  ]) {
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error.code, 'invalid_space_actions');
  }
  assert.equal(unknownCard.statusCode, 409);
  assert.equal(unknownCard.body.error.code, 'space_card_not_in_content');
  assert.equal(mismatchedContent.statusCode, 409);
  assert.equal(
    mismatchedContent.body.error.code,
    'space_content_version_mismatch',
  );
  assert.equal(store.snapshot().spaceActions.size, 0);
  assert.equal(store.snapshot().spaceStates.size, 0);
});

test('both legacy physical-space snapshot methods are globally disabled', async () => {
  const developmentApi = createTestApi();

  for (const method of ['GET', 'POST']) {
    const response = await request(developmentApi, {
      body: method === 'POST' ? {} : undefined,
      method,
      path: '/v1/space/state-sync',
    });

    assert.equal(response.statusCode, 410);
    assert.equal(response.body.error.code, 'legacy_space_snapshot_disabled');
  }

  const productionApi = createTestApi({
    authV2CodeGenerator: () => '2468',
    authV2IndexSecret: 'production-legacy-index-secret-0000',
    runtimeMode: 'production',
    smsProvider: {
      delivery: 'test_sms',
      kind: 'test_sms',
      sendCode: async () => undefined,
    },
    store: createCloudBaseStore({db: createFakeCloudBaseDb()}),
    tokenSecret: 'production-legacy-token-secret-0000',
  });

  for (const method of ['GET', 'POST']) {
    const response = await request(productionApi, {
      body: method === 'POST' ? {} : undefined,
      method,
      path: '/v1/space/state-sync',
    });

    assert.equal(response.statusCode, 410);
    assert.equal(response.body.error.code, 'legacy_api_disabled');
  }
});

test('space action conflict in the second batch item leaves no first-item write', async () => {
  const memoryStore = createMemoryStore();
  const cloudBaseDb = createFakeCloudBaseDb();
  const variants = [
    {
      snapshot: () => ({
        actions: cloneJson([
          ...memoryStore.snapshot().spaceActions.entries(),
        ]),
        states: cloneJson([...memoryStore.snapshot().spaceStates.entries()]),
      }),
      store: memoryStore,
    },
    {
      snapshot: () => ({
        actions: cloneJson([
          ...(cloudBaseDb.snapshot().get('softbook_space_actions') ??
            new Map()),
        ]),
        states: cloneJson([
          ...(cloudBaseDb.snapshot().get('softbook_space_states') ??
            new Map()),
        ]),
      }),
      store: createCloudBaseStore({db: cloudBaseDb}),
    },
  ];

  for (const variant of variants) {
    const api = createTestApi({store: variant.store});
    const session = await authenticatedV2Session(api);
    const firstAction = {
      action_id: 'space_atomic_existing',
      card_id: '002001',
      client_occurred_at: '2026-04-30T11:00:00.000Z',
      dimension: 'favorite',
      value: true,
    };
    const first = await submitSpaceActions(api, session, [firstAction]);

    assert.equal(first.statusCode, 200);
    const beforeConflict = variant.snapshot();
    const conflict = await submitSpaceActions(api, session, [
      {
        action_id: 'space_atomic_must_rollback',
        card_id: '002001',
        client_occurred_at: '2026-04-30T11:30:00.000Z',
        dimension: 'sleep',
        value: true,
      },
      {...firstAction, value: false},
    ]);

    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.body.error.code, 'space_action_id_conflict');
    assert.deepEqual(variant.snapshot(), beforeConflict);
  }
});

test('production space actions require a matching published content release', async () => {
  const db = createFakeCloudBaseDb();
  const draftSource = validateCardSourceForImport(
    createPersistedCardSource('cet4'),
    'cet4',
  );
  await db.collection('softbook_card_sources').doc('cet4').set(draftSource);
  const api = createTestApi({
    authV2CodeGenerator: () => '2468',
    authV2IndexSecret: 'production-space-index-secret-000000',
    runtimeMode: 'production',
    smsProvider: {
      delivery: 'test_sms',
      kind: 'test_sms',
      sendCode: async () => undefined,
    },
    store: createCloudBaseStore({db}),
    tokenSecret: 'production-space-token-secret-000000',
  });
  const session = await authenticatedV2Session(api);
  const headers = {authorization: `Bearer ${session.access_token}`};
  const body = {
    actions: [
      {
        action_id: 'space_production_release_guard',
        card_id: '052199',
        client_occurred_at: fixedNow.toISOString(),
        dimension: 'favorite',
        value: true,
      },
    ],
    content_version: draftSource.content_version,
    schema_version: 'space-actions.v2',
    track: 'cet4',
  };
  const submit = () =>
    request(api, {
      body,
      headers,
      method: 'POST',
      path: '/v2/space/actions',
    });
  const unavailable = await submit();

  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.body.error.code, 'content_release_unavailable');
  assert.equal(db.snapshot().get('softbook_space_actions').size, 0);
  assert.equal(db.snapshot().get('softbook_space_states').size, 0);

  await db
    .collection('softbook_card_sources')
    .doc('cet4')
    .set(createReleasedCardSource('cet4'));
  const available = await submit();

  assert.equal(available.statusCode, 200);
  assert.deepEqual(available.body.data.results, [
    {action_id: 'space_production_release_guard', status: 'applied'},
  ]);
});

test('CloudBase space action storage accepts only system ids beyond exact business schemas', async () => {
  const db = createFakeCloudBaseDb();
  const store = createCloudBaseStore({db});
  const api = createTestApi({store});
  const session = await authenticatedV2Session(api);
  const action = {
    action_id: 'space_storage_integrity',
    card_id: '002001',
    client_occurred_at: fixedNow.toISOString(),
    dimension: 'favorite',
    value: true,
  };
  const first = await submitSpaceActions(api, session, [action]);
  const duplicateWithSystemIds = await submitSpaceActions(api, session, [
    action,
  ]);

  assert.equal(first.statusCode, 200);
  assert.equal(duplicateWithSystemIds.statusCode, 200);

  const accountKey = [
    ...db.snapshot().get('softbook_auth_sessions').values(),
  ][0].account_key;
  const ledger = db
    .snapshot()
    .get('softbook_space_actions')
    .get(createSpaceActionLedgerId(accountKey, action.action_id));
  ledger.unexpected = true;
  const corruptLedger = await submitSpaceActions(api, session, [action]);

  assert.equal(corruptLedger.statusCode, 500);
  assert.equal(corruptLedger.body.error.code, 'space_state_invalid');
  delete ledger.unexpected;

  const state = db
    .snapshot()
    .get('softbook_space_states')
    .get(createSpaceStateId(accountKey));
  state.unexpected = true;
  const corruptState = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-04-30', track: 'cet4'},
  });

  assert.equal(corruptState.statusCode, 500);
  assert.equal(corruptState.body.error.code, 'space_state_invalid');
});

test('maximum CloudBase space action batch stays within 64 transaction operations', async () => {
  const db = createFakeCloudBaseDb();
  const api = createTestApi({store: createCloudBaseStore({db})});
  const session = await authenticatedV2Session(api);
  const response = await submitSpaceActions(
    api,
    session,
    Array.from({length: 20}, (_, index) => ({
      action_id: `space_operation_budget_${String(index + 1).padStart(2, '0')}`,
      card_id: '002001',
      client_occurred_at: '2026-04-30T11:59:00.000Z',
      dimension: 'favorite',
      value: index % 2 === 0,
    })),
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.results.length, 20);
  assert.equal(db.transactionOperationCounts().at(-1), 64);
});

test('space action ids and canonical state stay isolated between accounts', async () => {
  const store = createMemoryStore();
  const api = createTestApi({store});
  const firstSession = await authenticatedV2Session(
    api,
    '13800138000',
    '127.0.0.71',
  );
  const secondSession = await authenticatedV2Session(
    api,
    '13900139000',
    '127.0.0.72',
  );
  const action = {
    action_id: 'space_shared_external_action_id',
    card_id: '002001',
    client_occurred_at: fixedNow.toISOString(),
    dimension: 'favorite',
    value: true,
  };
  const first = await submitSpaceActions(api, firstSession, [action]);
  const second = await submitSpaceActions(api, secondSession, [
    {...action, value: false},
  ]);

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(first.body.data.results[0].status, 'applied');
  assert.equal(second.body.data.results[0].status, 'applied');
  assert.equal(store.snapshot().spaceActions.size, 2);
  assert.equal(store.snapshot().spaceStates.size, 2);
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

test('CloudBase store keeps membership and canonical check-in outside function memory', async () => {
  const db = createFakeCloudBaseDb();
  const firstApi = createTestApi({
    store: createCloudBaseStore({db}),
  });
  const secondApi = createTestApi({
    store: createCloudBaseStore({db}),
  });
  const session = await authenticatedV2Session(firstApi);
  const headers = {
    authorization: `Bearer ${session.access_token}`,
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
      day_key: '2026-04-30',
    },
    headers,
    method: 'POST',
    path: '/v2/progress/check-in',
  });

  assert.equal(entitlement.body.data.entitlement.stage, 'premium');
  assert.equal(daily.statusCode, 200);
  assert.equal(daily.body.data.checked_in_today, true);
  assert.equal(
    db.snapshot().get('softbook_memberships').get('13800138000').entitlement
      .stage,
    'premium',
  );
  assert.equal(db.snapshot().get('softbook_daily_check_ins').size, 1);
  assert.equal(db.snapshot().get('softbook_daily_progress')?.size ?? 0, 0);
});

test('CloudBase membership overlays an audited beta grant without overwriting base state', async () => {
  const db = createFakeCloudBaseDb();
  const store = createCloudBaseStore({db});
  const phoneNumber = '13800138000';
  await store.startTrial(phoneNumber, fixedNow.toISOString());
  const grantEvent = {
    schema_version: 'beta-entitlement-audit.v1',
    action: 'grant',
    actor_id: 'receiver-operator',
    command_sha256: `sha256:${'a'.repeat(64)}`,
    event_id: 'beta-event-grant-0001',
    grant_id: 'cet4-beta-grant-0001',
    occurred_at: fixedNow.toISOString(),
    previous_stage: 'trial',
    reason: 'closed_beta_access',
    resulting_stage: 'premium',
  };
  db.snapshot().get('softbook_beta_entitlements').set(phoneNumber, {
    active_grant: {
      schema_version: 'beta-entitlement.v1',
      actor_id: grantEvent.actor_id,
      command_sha256: grantEvent.command_sha256,
      grant_event_id: grantEvent.event_id,
      grant_id: grantEvent.grant_id,
      granted_at: grantEvent.occurred_at,
      reason: grantEvent.reason,
    },
    audit: [grantEvent],
    phone_number: phoneNumber,
    revision: 1,
    updated_at: fixedNow.toISOString(),
  });

  const granted = await store.getMembership(phoneNumber);
  assert.equal(granted.stage, 'premium');
  assert.deepEqual(granted.component_revision, {
    base_membership_revision: 1,
    beta_entitlement_revision: 1,
  });
  assert.equal(
    db.snapshot().get('softbook_memberships').get(phoneNumber).entitlement.stage,
    'trial',
  );
  await store.purchase(phoneNumber, '2026-05-01T12:00:00.000Z');
  const purchasedDuringBeta = await store.getMembership(phoneNumber);
  assert.equal(purchasedDuringBeta.stage, 'premium');
  assert.equal(
    purchasedDuringBeta.acknowledged_at,
    '2026-05-01T12:00:00.000Z',
  );
  assert.deepEqual(purchasedDuringBeta.component_revision, {
    base_membership_revision: 2,
    beta_entitlement_revision: 1,
  });

  const betaDocument = db
    .snapshot()
    .get('softbook_beta_entitlements')
    .get(phoneNumber);
  betaDocument.active_grant = null;
  betaDocument.audit.push({
    ...grantEvent,
    action: 'revoke',
    event_id: 'beta-event-revoke-0001',
    occurred_at: '2026-05-02T12:00:00.000Z',
    previous_stage: 'premium',
    resulting_stage: 'premium',
  });
  betaDocument.revision = 2;
  betaDocument.updated_at = '2026-05-02T12:00:00.000Z';
  const revoked = await store.getMembership(phoneNumber);
  assert.equal(revoked.stage, 'premium');
  assert.deepEqual(revoked.component_revision, {
    base_membership_revision: 2,
    beta_entitlement_revision: 2,
  });
});

test('CloudBase membership fails closed on malformed active beta evidence', async () => {
  const db = createFakeCloudBaseDb();
  const store = createCloudBaseStore({db});
  db.snapshot().get('softbook_beta_entitlements').set('13800138000', {
    active_grant: {schema_version: 'beta-entitlement.v1'},
    audit: [],
    phone_number: '13800138000',
    revision: 1,
  });

  await assert.rejects(
    () => store.getMembership('13800138000'),
    error => error.code === 'invalid_beta_entitlement',
  );
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
  const session = await authenticatedV2Session(api);
  const response = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-04-30', track: 'cet4'},
  });

  assert.equal(response.statusCode, 200);
  assert.equal(
    response.body.data.space.states[0].last_modified_at,
    '2026-04-29T12:00:00.000Z',
  );
  assert.equal(db.snapshot().get('softbook_space_states').size, 2);
});

test('CloudBase space transactions preserve simultaneous writes from separate function instances', async () => {
  const db = createFakeCloudBaseDb();
  const firstStore = createCloudBaseStore({db});
  const secondStore = createCloudBaseStore({db});
  const accountKey = 'account-space-concurrency';
  const write = (store, cardId, lastModifiedAt) =>
    store.commitSpaceActions({
      acknowledgedAt: fixedNow.toISOString(),
      accountKey,
      actions: [
        {
          action_id: `action_${cardId}`,
          card_id: cardId,
          client_occurred_at: lastModifiedAt,
          dimension: 'favorite',
          value: true,
        },
      ],
      phoneNumber: '13800138000',
    });

  await Promise.all([
    write(firstStore, '002001', '2026-04-30T12:00:00.000Z'),
    write(secondStore, '002002', '2026-04-30T12:00:01.000Z'),
  ]);

  const canonical = await firstStore.getSpaceState(
    '13800138000',
    '2026-04-30',
    {accountKey, acknowledgedAt: fixedNow.toISOString()},
  );

  assert.deepEqual(Object.keys(canonical.states_by_card_id).sort(), [
    '002001',
    '002002',
  ]);
  assert.equal(db.transactionCount(), 3);
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
  let activeTransactionOperationCount = null;
  let activeTransactionWrites = null;
  let failNextTransactionSetCollection = null;
  let transactionTail = Promise.resolve();
  const transactionOperationCounts = [];

  const collection = (
    name,
    transactional = false,
    collectionState = collections,
  ) => {
    if (!collectionState.has(name)) {
      collectionState.set(name, new Map());
    }

    const documents = collectionState.get(name);

    return {
      doc: documentId => ({
        get: async () => {
          if (transactional) {
            activeTransactionOperationCount += 1;
          }
          const document = documents.has(documentId)
            ? {
                _id: documentId,
                ...cloneJson(documents.get(documentId)),
              }
            : null;
          return {
            data: transactional
              ? {list: document ? [document] : []}
              : document
              ? [document]
              : [],
          };
        },
        set: async data => {
          if (transactional) {
            activeTransactionOperationCount += 1;
            if (failNextTransactionSetCollection === name) {
              failNextTransactionSetCollection = null;
              throw new Error(`injected transaction set failure: ${name}`);
            }
            activeTransactionWrites.add(JSON.stringify([name, documentId]));
          }
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
        activeTransactionOperationCount = 0;
        activeTransactionWrites = new Set();
        const stagedCollections = cloneCollectionMaps(collections);

        try {
          const result = await callback({
            collection: name => collection(name, true, stagedCollections),
          });
          commitCollectionWrites(
            collections,
            stagedCollections,
            activeTransactionWrites,
          );
          return result;
        } finally {
          transactionOperationCounts.push(activeTransactionOperationCount);
          activeTransactionOperationCount = null;
          activeTransactionWrites = null;
        }
      });
      transactionTail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    failNextTransactionSet: collectionName => {
      failNextTransactionSetCollection = collectionName;
    },
    snapshot: () => collections,
    transactionCount: () => transactionCount,
    transactionOperationCounts: () => [...transactionOperationCounts],
  };
}

function cloneCollectionMaps(collections) {
  return new Map(
    [...collections.entries()].map(([name, documents]) => [
      name,
      new Map(
        [...documents.entries()].map(([documentId, document]) => [
          documentId,
          cloneJson(document),
        ]),
      ),
    ]),
  );
}

function commitCollectionWrites(target, staged, writes) {
  for (const encoded of writes) {
    const [name, documentId] = JSON.parse(encoded);
    if (!target.has(name)) target.set(name, new Map());
    const targetDocuments = target.get(name);
    targetDocuments.set(
      documentId,
      cloneJson(staged.get(name).get(documentId)),
    );
  }
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

function createAudioReleasedCardSource(track) {
  const source = createPersistedCardSource(track);
  const assetId = `${track}.052199.prompt`;
  const sha256 = `sha256:${'a'.repeat(64)}`;
  source.card_records[0].audio = {
    asset_id: assetId,
    duration_ms: 2100,
    sha256,
    transcript: 'The committee postponed the vote.',
  };
  source.assets = [
    {
      asset_id: assetId,
      duration_ms: 2100,
      media_type: 'audio/mpeg',
      sha256,
      size_bytes: 4096,
      storage_file_id: `cloud://softbook-content/${track}/052199.mp3`,
    },
  ];
  const normalized = validateCardSourceForImport(source, track);

  return {
    ...source,
    release: {
      schema_version: 'content-release.v1',
      release_id: `${track}-audio-release`,
      track,
      content_version: normalized.content_version,
      minimum_client_version: '1.0.0',
      parent_release_id: null,
      published_at: fixedNow.toISOString(),
    },
  };
}

function createMultiAudioReleasedCardSource(track) {
  const source = createAudioReleasedCardSource(track);
  delete source.release;
  const secondCard = cloneJson(source.card_records[0]);
  secondCard.card_id = `${secondCard.knowledge_ref}98`;
  secondCard.audio.asset_id = `${track}.${secondCard.card_id}.prompt`;
  secondCard.audio.sha256 = `sha256:${'b'.repeat(64)}`;
  source.card_records.push(secondCard);
  const secondAsset = cloneJson(source.assets[0]);
  secondAsset.asset_id = secondCard.audio.asset_id;
  secondAsset.sha256 = secondCard.audio.sha256;
  secondAsset.storage_file_id =
    `cloud://softbook-content/${track}/${secondCard.card_id}.mp3`;
  source.assets.push(secondAsset);
  const normalized = validateCardSourceForImport(source, track);

  return {
    ...source,
    release: {
      schema_version: 'content-release.v1',
      release_id: `${track}-multi-audio-release`,
      track,
      content_version: normalized.content_version,
      minimum_client_version: '1.0.0',
      parent_release_id: null,
      published_at: fixedNow.toISOString(),
    },
  };
}
