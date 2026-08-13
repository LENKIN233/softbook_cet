const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  createContentManifestV1Service,
} = require('../content-manifest-v1');
const {
  isContentReleaseValidForRuntime,
} = require('../content-release-runtime');

const CONTENT_VERSION = `sha256:${'a'.repeat(64)}`;
const CHECKED_AT = new Date('2026-08-12T06:00:00.000Z');

function pilotSource(overrides = {}) {
  return {
    card_records: Array.from({length: 120}, (_, index) => ({
      card_id: String(index + 1).padStart(6, '0'),
    })),
    content_version: CONTENT_VERSION,
    release: {
      schema_version: 'pilot-content-release.v1',
      release_id: 'cet4-pilot-release-001',
      profile_id: 'receiver-pilot-profile',
      pilot_id: 'cet4-pilot-2026',
      release_class: 'controlled_pilot',
      runtime_mode: 'controlled_pilot',
      track: 'cet4',
      content_version: CONTENT_VERSION,
      card_count: 120,
      free_card_count: 60,
      activated_at: '2026-08-12T05:00:00.000Z',
      expires_at: '2026-09-12T05:00:00.000Z',
      minimum_client_versions: {android: '1.0.0', ios: '1.0.0'},
      gate_eligible: false,
      ...overrides,
    },
    track: 'cet4',
  };
}

function formalSource() {
  return {
    card_records: [{card_id: '000001'}],
    content_version: CONTENT_VERSION,
    release: {
      schema_version: 'content-release.v1',
      release_id: 'cet4-formal-release',
      track: 'cet4',
      content_version: CONTENT_VERSION,
    },
    track: 'cet4',
  };
}

test('production and controlled-pilot releases cannot cross runtime modes', () => {
  assert.equal(
    isContentReleaseValidForRuntime(pilotSource(), 'controlled_pilot', CHECKED_AT),
    true,
  );
  assert.equal(
    isContentReleaseValidForRuntime(pilotSource(), 'production', CHECKED_AT),
    false,
  );
  assert.equal(
    isContentReleaseValidForRuntime(formalSource(), 'production', CHECKED_AT),
    true,
  );
  assert.equal(
    isContentReleaseValidForRuntime(formalSource(), 'controlled_pilot', CHECKED_AT),
    false,
  );
});

test('controlled-pilot release rejects expiry and 120/60 scope drift', () => {
  assert.equal(
    isContentReleaseValidForRuntime(
      pilotSource({expires_at: CHECKED_AT.toISOString()}),
      'controlled_pilot',
      CHECKED_AT,
    ),
    false,
  );
  assert.equal(
    isContentReleaseValidForRuntime(
      pilotSource({free_card_count: 59}),
      'controlled_pilot',
      CHECKED_AT,
    ),
    false,
  );
  const shortSource = pilotSource();
  shortSource.card_records.pop();
  assert.equal(
    isContentReleaseValidForRuntime(shortSource, 'controlled_pilot', CHECKED_AT),
    false,
  );
  assert.equal(
    isContentReleaseValidForRuntime(
      pilotSource({minimum_client_versions: {ios: '1.0.0'}}),
      'controlled_pilot',
      CHECKED_AT,
    ),
    false,
  );
  assert.equal(
    isContentReleaseValidForRuntime(
      pilotSource({minimum_client_versions: {android: 'latest', ios: '1.0.0'}}),
      'controlled_pilot',
      CHECKED_AT,
    ),
    false,
  );
  for (const invalidVersion of [
    ['1.0.0'],
    {value: '1.0.0'},
    new String('1.0.0'),
  ]) {
    assert.equal(
      isContentReleaseValidForRuntime(
        pilotSource({
          minimum_client_versions: {
            android: invalidVersion,
            ios: '1.0.0',
          },
        }),
        'controlled_pilot',
        CHECKED_AT,
      ),
      false,
    );
  }
  assert.equal(
    isContentReleaseValidForRuntime(
      pilotSource({activated_at: '2026-08-12T13:00:00.000+08:00'}),
      'controlled_pilot',
      CHECKED_AT,
    ),
    false,
  );
  assert.equal(
    isContentReleaseValidForRuntime(
      pilotSource({expires_at: '2026-09-12T13:00:00.000+08:00'}),
      'controlled_pilot',
      CHECKED_AT,
    ),
    false,
  );
  assert.equal(
    isContentReleaseValidForRuntime(
      pilotSource({pilot_id: 'invalid pilot id'}),
      'controlled_pilot',
      CHECKED_AT,
    ),
    false,
  );
  assert.equal(
    isContentReleaseValidForRuntime(
      pilotSource({release_id: ''}),
      'controlled_pilot',
      CHECKED_AT,
    ),
    false,
  );
  assert.equal(
    isContentReleaseValidForRuntime(
      pilotSource({release_id: ['cet4-pilot-release-001']}),
      'controlled_pilot',
      CHECKED_AT,
    ),
    false,
  );
  assert.equal(
    isContentReleaseValidForRuntime(
      pilotSource({pilot_id: new String('cet4-pilot-2026')}),
      'controlled_pilot',
      CHECKED_AT,
    ),
    false,
  );
  assert.equal(
    isContentReleaseValidForRuntime(
      pilotSource({profile_id: ['receiver-pilot-profile']}),
      'controlled_pilot',
      CHECKED_AT,
    ),
    false,
  );
  assert.equal(
    isContentReleaseValidForRuntime(
      pilotSource({unexpected: true}),
      'controlled_pilot',
      CHECKED_AT,
    ),
    false,
  );
});

test('content manifest applies the same runtime-mode authority', async () => {
  const source = pilotSource();
  source.assets = [];
  const {privateKey} = crypto.generateKeyPairSync('ed25519');
  const common = {
    now: () => CHECKED_AT,
    resolveDownloadUrl: async () => 'https://private.example/unused',
    signer: {keyId: 'pilot-manifest-key', privateKey},
    store: {
      getCardSource: async () => source,
      getMembership: async () => ({stage: 'trial'}),
    },
  };
  const pilot = createContentManifestV1Service({
    ...common,
    runtimeMode: 'controlled_pilot',
  });
  const result = await pilot.read({
    contentVersion: CONTENT_VERSION,
    phoneNumber: '13800138000',
    track: 'cet4',
  });
  assert.equal(result.manifest.release_class, 'controlled_pilot');
  assert.equal(result.manifest.gate_eligible, false);
  assert.deepEqual(Object.keys(result.manifest).sort(), [
    'assets',
    'content_version',
    'expires_at',
    'gate_eligible',
    'minimum_client_versions',
    'pilot_id',
    'release_class',
    'release_id',
    'schema_version',
    'track',
  ]);

  const production = createContentManifestV1Service({
    ...common,
    runtimeMode: 'production',
  });
  await assert.rejects(
    production.read({
      contentVersion: CONTENT_VERSION,
      phoneNumber: '13800138000',
      track: 'cet4',
    }),
    error =>
      error.statusCode === 409 &&
      error.code === 'content_manifest_version_mismatch',
  );
});

test('controlled-pilot download expiry never outlives its signed release', async () => {
  const releaseExpiresAt = new Date(CHECKED_AT.getTime() + 60_000);
  const source = pilotSource({expires_at: releaseExpiresAt.toISOString()});
  source.card_records[0].audio = {
    asset_id: 'cet4-pilot-audio-000001',
    duration_ms: 1000,
    sha256: `sha256:${'b'.repeat(64)}`,
  };
  source.assets = [
    {
      asset_id: 'cet4-pilot-audio-000001',
      duration_ms: 1000,
      media_type: 'audio/mpeg',
      sha256: `sha256:${'b'.repeat(64)}`,
      size_bytes: 1024,
    },
  ];
  const {privateKey} = crypto.generateKeyPairSync('ed25519');
  const service = createContentManifestV1Service({
    downloadTtlSeconds: 900,
    now: () => CHECKED_AT,
    resolveDownloadUrl: async () => 'https://private.example/pilot.mp3',
    runtimeMode: 'controlled_pilot',
    signer: {keyId: 'pilot-manifest-key', privateKey},
    store: {
      getCardSource: async () => source,
      getMembership: async () => ({stage: 'trial'}),
    },
  });
  const result = await service.read({
    contentVersion: CONTENT_VERSION,
    phoneNumber: '13800138000',
    track: 'cet4',
  });
  assert.equal(result.manifest.expires_at, releaseExpiresAt.toISOString());
  assert.equal(result.downloads[0].expires_at, releaseExpiresAt.toISOString());
});
