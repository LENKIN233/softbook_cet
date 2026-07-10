import { resolveLearningStateRepositoryConfig } from '../src/sync/learningStateRuntimeConfig';

test('learning state runtime config defaults repository mode to local', () => {
  expect(resolveLearningStateRepositoryConfig(undefined)).toEqual({
    mode: 'local',
  });
});

test('learning state runtime config can switch repository mode to remote', () => {
  const config = resolveLearningStateRepositoryConfig({
    auth: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example/',
      },
    },
    learningState: {
      mode: 'remote',
      remote: {
        apiKey: 'learning-key',
        baseUrl: 'https://api.softbook.example/',
      },
    },
  });

  expect(config).toEqual({
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://api.softbook.example/v1/learning/state-sync',
      headers: {
        'x-api-key': 'learning-key',
        'x-softbook-client': 'mobile',
      },
    },
  });
});

test('learning state runtime config rejects remote mode without baseUrl', () => {
  expect(() =>
    resolveLearningStateRepositoryConfig({
      auth: {
        mode: 'remote',
        remote: {
          baseUrl: 'https://api.softbook.example',
        },
      },
      learningState: {
        mode: 'remote',
      },
    }),
  ).toThrow(
    'Remote learning state mode requires learningState.remote.baseUrl.',
  );
});

test('learning state runtime config requires remote auth when sync is remote', () => {
  expect(() =>
    resolveLearningStateRepositoryConfig({
      auth: {
        mode: 'local',
      },
      learningState: {
        mode: 'remote',
        remote: {
          baseUrl: 'https://api.softbook.example',
        },
      },
    }),
  ).toThrow(
    'Remote learning state mode requires auth.mode to also be remote.',
  );
});
