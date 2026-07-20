import {resolveAuthRepositoryConfig} from '../src/auth/authRuntimeConfig';
import {
  resolveLearningSessionRepositoryConfig,
  resolveLearningTrack,
} from '../src/learning/learningRuntimeConfig';
import {resolveMembershipRepositoryConfig} from '../src/membership/membershipRuntimeConfig';
import {
  SOFTBOOK_APP_RUNTIME_CONFIG,
  createSoftbookRemoteRuntimeConfig,
  readRemoteRuntimeProfileFromEnv,
  resolveSoftbookAppRuntimeConfig,
} from '../src/runtime/appRuntimeConfig';
import {resolveSpaceStateRepositoryConfig} from '../src/space/spaceStateRuntimeConfig';
import {resolveLearningStateRepositoryConfig} from '../src/sync/learningStateRuntimeConfig';
import {resolveProgressSyncRepositoryConfig} from '../src/sync/progressSyncRuntimeConfig';

test('tracked app runtime config stays on the local safe baseline', () => {
  expect(SOFTBOOK_APP_RUNTIME_CONFIG).toMatchObject({
    auth: {mode: 'local'},
    learningSource: {mode: 'local'},
    learningState: {mode: 'local'},
    membership: {mode: 'local'},
    progressSync: {mode: 'local'},
    spaceState: {mode: 'local'},
  });
});

test('runtime config resolver keeps the tracked local baseline without a remote profile', () => {
  expect(resolveSoftbookAppRuntimeConfig({env: {}})).toEqual(
    SOFTBOOK_APP_RUNTIME_CONFIG,
  );
});

test('runtime config resolver can build a remote profile from environment values', () => {
  const config = resolveSoftbookAppRuntimeConfig({
    env: {
      SOFTBOOK_CET_LEARNING_TRACK: 'cet6',
      SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES: 'learningSource, spaceState',
      SOFTBOOK_CET_REMOTE_API_KEY: 'env-key',
      SOFTBOOK_CET_REMOTE_BASE_URL: ' https://api.softbook.example/ ',
    },
  });

  expect(resolveLearningTrack(config)).toBe('cet6');
  expect(resolveAuthRepositoryConfig(config).remoteConfig).toMatchObject({
    requestCodeEndpoint: 'https://api.softbook.example/v2/auth/request-code',
    headers: {
      'x-api-key': 'env-key',
    },
  });
  expect(resolveLearningSessionRepositoryConfig(config).mode).toBe('local');
  expect(resolveMembershipRepositoryConfig(config).mode).toBe('remote');
  expect(resolveSpaceStateRepositoryConfig(config).mode).toBe('local');
  expect(resolveLearningStateRepositoryConfig(config).mode).toBe('remote');
});

test('remote runtime env profile rejects invalid staged feature names', () => {
  expect(() =>
    readRemoteRuntimeProfileFromEnv({
      SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES: 'unknownSurface',
      SOFTBOOK_CET_REMOTE_BASE_URL: 'https://api.softbook.example',
    }),
  ).toThrow(
    'Unknown SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES value: unknownSurface.',
  );
});

test('remote runtime profile switches every remote-capable surface to one base url', () => {
  const config = createSoftbookRemoteRuntimeConfig({
    apiKey: 'dev-key',
    baseUrl: 'https://api.softbook.example/',
    learningTrack: 'cet6',
  });

  expect(resolveLearningTrack(config)).toBe('cet6');
  expect(resolveAuthRepositoryConfig(config).remoteConfig).toMatchObject({
    requestCodeEndpoint: 'https://api.softbook.example/v2/auth/request-code',
    verifyCodeEndpoint: 'https://api.softbook.example/v2/auth/verify-code',
    headers: {
      'x-api-key': 'dev-key',
      'x-softbook-client': 'mobile',
    },
  });
  expect(
    resolveLearningSessionRepositoryConfig(config).remoteConfig,
  ).toMatchObject({
    endpoint: 'https://api.softbook.example/v1/learning/card-source',
    headers: {
      'x-softbook-client': 'mobile',
    },
  });
  expect(resolveMembershipRepositoryConfig(config).remoteConfig).toMatchObject({
    entitlementEndpoint: 'https://api.softbook.example/v1/membership/entitlement',
    purchaseEndpoint: 'https://api.softbook.example/v1/membership/purchase',
    startTrialEndpoint: 'https://api.softbook.example/v1/membership/start-trial',
    headers: {
      'x-api-key': 'dev-key',
      'x-softbook-client': 'mobile',
    },
  });
  expect(resolveProgressSyncRepositoryConfig(config).remoteConfig).toMatchObject({
    endpoint: 'https://api.softbook.example/v1/progress/daily-sync',
  });
  expect(resolveSpaceStateRepositoryConfig(config).remoteConfig).toMatchObject({
    endpoint: 'https://api.softbook.example/v1/space/state-sync',
  });
  expect(resolveLearningStateRepositoryConfig(config).remoteConfig).toMatchObject({
    endpoint: 'https://api.softbook.example/v1/learning/state-sync',
  });
});

test('remote runtime profile normalizes the shared base url', () => {
  const config = createSoftbookRemoteRuntimeConfig({
    apiKey: 'dev-key',
    baseUrl: '  https://api.softbook.example///  ',
  });

  expect(config.auth?.remote?.baseUrl).toBe('https://api.softbook.example');
  expect(config.learningSource?.remote?.baseUrl).toBe(
    'https://api.softbook.example',
  );
  expect(config.membership?.remote?.baseUrl).toBe(
    'https://api.softbook.example',
  );
  expect(resolveProgressSyncRepositoryConfig(config).remoteConfig).toMatchObject({
    endpoint: 'https://api.softbook.example/v1/progress/daily-sync',
  });
});

test('remote runtime profile rejects a blank base url', () => {
  expect(() =>
    createSoftbookRemoteRuntimeConfig({
      baseUrl: '   ',
    }),
  ).toThrow('Remote runtime profile requires baseUrl.');
});

test('remote runtime profile can keep one surface local for staged smoke tests', () => {
  const config = createSoftbookRemoteRuntimeConfig({
    baseUrl: 'https://api.softbook.example',
    featureModes: {
      learningSource: 'local',
      spaceState: 'local',
    },
  });

  expect(resolveAuthRepositoryConfig(config).mode).toBe('remote');
  expect(resolveLearningSessionRepositoryConfig(config).mode).toBe('local');
  expect(resolveMembershipRepositoryConfig(config).mode).toBe('remote');
  expect(resolveProgressSyncRepositoryConfig(config).mode).toBe('remote');
  expect(resolveSpaceStateRepositoryConfig(config).mode).toBe('local');
  expect(resolveLearningStateRepositoryConfig(config).mode).toBe('remote');
});
