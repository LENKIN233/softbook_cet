import { resolveProgressSyncRepositoryConfig } from '../src/sync/progressSyncRuntimeConfig';

test('progress sync runtime config defaults repository mode to local', () => {
  expect(resolveProgressSyncRepositoryConfig(undefined)).toEqual({
    mode: 'local',
  });
});

test('progress sync runtime config can switch repository mode to remote', () => {
  const config = resolveProgressSyncRepositoryConfig({
    auth: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example/',
      },
    },
    progressSync: {
      mode: 'remote',
      remote: {
        apiKey: 'progress-key',
        baseUrl: 'https://api.softbook.example/',
      },
    },
  });

  expect(config).toEqual({
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://api.softbook.example/v1/progress/daily-sync',
      headers: {
        'x-api-key': 'progress-key',
        'x-softbook-client': 'mobile',
      },
    },
  });
});

test('progress sync runtime config rejects remote mode without baseUrl', () => {
  expect(() =>
    resolveProgressSyncRepositoryConfig({
      auth: {
        mode: 'remote',
        remote: {
          baseUrl: 'https://api.softbook.example',
        },
      },
      progressSync: {
        mode: 'remote',
      },
    }),
  ).toThrow(
    'Remote progress sync mode requires progressSync.remote.baseUrl.',
  );
});

test('progress sync runtime config requires remote auth when sync is remote', () => {
  expect(() =>
    resolveProgressSyncRepositoryConfig({
      auth: {
        mode: 'local',
      },
      progressSync: {
        mode: 'remote',
        remote: {
          baseUrl: 'https://api.softbook.example',
        },
      },
    }),
  ).toThrow(
    'Remote progress sync mode requires auth.mode to also be remote.',
  );
});
