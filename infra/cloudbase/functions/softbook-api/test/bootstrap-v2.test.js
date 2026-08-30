const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createBootstrapV2Service,
} = require('../bootstrap-v2');
const {createMemoryStore} = require('../index');

const fixedNow = new Date('2026-07-20T12:00:00.000Z');

test('development card-source imports cannot publish formal releases', async () => {
  const {
    assertDevelopmentCardSourceImport,
    DEVELOPMENT_CARD_SOURCE_ENV_ID,
  } = await import(
    '../../../card-source-import-policy.mjs'
  );

  assert.doesNotThrow(() =>
    assertDevelopmentCardSourceImport({release: null}),
  );
  assert.throws(
    () =>
      assertDevelopmentCardSourceImport({
        release: {release_id: 'unapproved-release'},
      }),
    /cannot publish content releases/,
  );
  assert.throws(
    () =>
      assertDevelopmentCardSourceImport(
        {release: null},
        {envId: 'receiver-production'},
      ),
    /development importer is pinned/,
  );
  assert.equal(DEVELOPMENT_CARD_SOURCE_ENV_ID, 'test-d2gzcyxr9f7e80972');
});

test('bootstrap service requires every canonical read capability', () => {
  assert.throws(
    () =>
      createBootstrapV2Service({
        now: () => fixedNow,
        runtimeMode: 'development',
        store: {},
      }),
    /store is missing getCardSource\(\)/,
  );
});

test('production bootstrap checks the content release before account state', async () => {
  const accountReads = [];
  const store = {
    getCardSource: async (_track, options) => {
      assert.equal(options.allowDevelopmentDefault, false);
      const error = new Error('No published content source exists for cet4.');
      error.code = 'content_release_unavailable';
      error.statusCode = 503;
      throw error;
    },
    getDailyProgress: async () => accountReads.push('progress'),
    getLearningState: async () => accountReads.push('learning'),
    getMembership: async () => accountReads.push('membership'),
    getSpaceState: async () => accountReads.push('space'),
  };
  const service = createBootstrapV2Service({
    now: () => fixedNow,
    runtimeMode: 'production',
    store,
  });

  await assert.rejects(
    service.read({
      dayKey: '2026-07-20',
      phoneNumber: '13800138000',
      track: 'cet4',
    }),
    error =>
      error.statusCode === 503 &&
      error.code === 'content_release_unavailable',
  );
  assert.deepEqual(accountReads, []);
});

test('bootstrap serializes transaction-backed canonical reads', async () => {
  const baseStore = createMemoryStore();
  const store = {...baseStore};
  const observed = [];
  let activeReads = 0;
  let maximumActiveReads = 0;

  for (const method of [
    'getMembership',
    'getLearningState',
    'getSpaceState',
    'getDailyProgress',
  ]) {
    store[method] = async (...args) => {
      activeReads += 1;
      maximumActiveReads = Math.max(maximumActiveReads, activeReads);
      observed.push(method);
      await Promise.resolve();
      try {
        return await baseStore[method](...args);
      } finally {
        activeReads -= 1;
      }
    };
  }
  const service = createBootstrapV2Service({
    now: () => fixedNow,
    runtimeMode: 'development',
    store,
  });

  await service.read({
    accountKey: 'serialized-bootstrap-account',
    dayKey: '2026-07-20',
    phoneNumber: '13800138000',
    track: 'cet4',
  });

  assert.equal(maximumActiveReads, 1);
  assert.deepEqual(observed, [
    'getMembership',
    'getLearningState',
    'getSpaceState',
    'getDailyProgress',
  ]);
});

test('controlled-pilot bootstrap exposes its independent entitlement revision', async () => {
  const store = createMemoryStore();
  const contentVersion = `sha256:${'a'.repeat(64)}`;
  store.snapshot().cardSources.set('cet4', {
    assets: [],
    card_records: Array.from({length: 120}, (_, index) => ({
      card_id: String(index + 1).padStart(6, '0'),
    })),
    content_version: contentVersion,
    release: {
      schema_version: 'pilot-content-release.v1',
      activated_at: '2026-07-01T00:00:00.000Z',
      card_count: 120,
      content_version: contentVersion,
      expires_at: '2026-09-01T00:00:00.000Z',
      free_card_count: 60,
      gate_eligible: false,
      minimum_client_versions: {android: '1.0.0', ios: '1.0.0'},
      pilot_id: 'cet4-pilot-2026',
      profile_id: 'receiver-controlled-pilot',
      release_class: 'controlled_pilot',
      release_id: 'cet4-pilot-release-001',
      runtime_mode: 'controlled_pilot',
      track: 'cet4',
    },
    source: {id: 'pilot-source', label: 'Pilot source'},
    track: 'cet4',
  });
  const service = createBootstrapV2Service({
    now: () => fixedNow,
    runtimeMode: 'controlled_pilot',
    store,
  });

  const result = await service.read({
    accountKey: 'pilot-account-key',
    dayKey: '2026-07-20',
    phoneNumber: '13800138000',
    track: 'cet4',
  });

  assert.deepEqual(result.component_revisions.membership, {
    base_membership_revision: 0,
    beta_entitlement_revision: 0,
    pilot_entitlement_revision: 0,
  });
});
