import {
  readSoftbookAppRuntimeConfig,
  resolveLearningSessionRepositoryConfig,
} from '../src/learning/learningRuntimeConfig';

declare global {
  var __SOFTBOOK_CET_RUNTIME_CONFIG__:
    | {
        learningSource?: {
          mode?: 'local' | 'remote';
          remote?: {
            apiKey?: string;
            baseUrl: string;
          };
        };
      }
    | undefined;
}

afterEach(() => {
  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = undefined;
});

test('learning runtime config defaults repository mode to local', () => {
  expect(resolveLearningSessionRepositoryConfig()).toEqual({
    mode: 'local',
  });
});

test('learning runtime config can switch repository mode to remote', () => {
  const config = resolveLearningSessionRepositoryConfig({
    learningSource: {
      mode: 'remote',
      remote: {
        apiKey: 'runtime-key',
        baseUrl: 'https://api.softbook.example/',
      },
    },
  });

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
});

test('learning runtime config rejects remote mode without baseUrl', () => {
  expect(() =>
    resolveLearningSessionRepositoryConfig({
      learningSource: {
        mode: 'remote',
      },
    }),
  ).toThrow(
    'Remote learning source mode requires learningSource.remote.baseUrl.',
  );
});
