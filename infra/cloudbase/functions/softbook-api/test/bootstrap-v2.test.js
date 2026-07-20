const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createBootstrapV2Service,
} = require('../bootstrap-v2');

const fixedNow = new Date('2026-07-20T12:00:00.000Z');

test('development card-source imports cannot publish formal releases', async () => {
  const {assertDevelopmentCardSourceImport} = await import(
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
