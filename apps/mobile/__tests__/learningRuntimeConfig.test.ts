import {
  type SoftbookAppRuntimeConfig,
  readSoftbookAppRuntimeConfig,
  resolveLearningTrack,
  resolveLearningSessionRepositoryConfig,
} from '../src/learning/learningRuntimeConfig';

declare global {
  var __SOFTBOOK_CET_RUNTIME_CONFIG__: SoftbookAppRuntimeConfig | undefined;
}

afterEach(() => {
  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = undefined;
});

test('learning runtime config defaults repository mode to local', () => {
  expect(resolveLearningSessionRepositoryConfig()).toEqual({
    mode: 'local',
  });
  expect(resolveLearningTrack()).toBe('cet4');
});

test('learning runtime config can switch repository mode to remote', () => {
  const config = resolveLearningSessionRepositoryConfig({
    auth: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example/',
      },
    },
    learningSource: {
      mode: 'remote',
      remote: {
        apiKey: 'runtime-key',
        baseUrl: 'https://api.softbook.example/',
      },
    },
  });

  expect(config.fallbackToLocalOnRemoteError).toBe(true);
  expect(config.mode).toBe('remote');
  expect(config.remoteConfig?.endpoint).toBe(
    'https://api.softbook.example/v1/learning/card-source',
  );
  expect(config.remoteConfig?.headers).toEqual({
    'x-softbook-client': 'mobile',
  });
});

test('learning runtime config reads global runtime overrides', () => {
  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = {
    auth: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
    learningTrack: 'cet6',
    learningSource: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
  };

  expect(readSoftbookAppRuntimeConfig()).toEqual(
    global.__SOFTBOOK_CET_RUNTIME_CONFIG__,
  );
  expect(resolveLearningSessionRepositoryConfig().mode).toBe('remote');
  expect(resolveLearningTrack()).toBe('cet6');
});

test('learning runtime config rejects remote mode without baseUrl', () => {
  expect(() =>
    resolveLearningSessionRepositoryConfig({
      auth: {
        mode: 'remote',
        remote: {
          baseUrl: 'https://api.softbook.example',
        },
      },
      learningSource: {
        mode: 'remote',
      },
    }),
  ).toThrow(
    'Remote learning source mode requires learningSource.remote.baseUrl.',
  );
});

test('learning runtime config requires remote auth when source is remote', () => {
  expect(() =>
    resolveLearningSessionRepositoryConfig({
      auth: {
        mode: 'local',
      },
      learningSource: {
        mode: 'remote',
        remote: {
          baseUrl: 'https://api.softbook.example',
        },
      },
    }),
  ).toThrow(
    'Remote learning source mode requires auth.mode to also be remote.',
  );
});
