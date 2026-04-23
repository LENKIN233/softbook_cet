import {resolveAuthRepositoryConfig} from '../src/auth/authRuntimeConfig';

test('auth runtime config defaults repository mode to local', () => {
  expect(resolveAuthRepositoryConfig(undefined)).toEqual({
    mode: 'local',
  });
});

test('auth runtime config can switch repository mode to remote', () => {
  expect(
    resolveAuthRepositoryConfig({
      auth: {
        mode: 'remote',
        remote: {
          apiKey: 'auth-key',
          baseUrl: 'https://api.softbook.example/',
        },
      },
    }),
  ).toEqual({
    mode: 'remote',
    remoteConfig: {
      headers: {
        'x-api-key': 'auth-key',
        'x-softbook-client': 'mobile',
      },
      requestCodeEndpoint: 'https://api.softbook.example/v1/auth/request-code',
      verifyCodeEndpoint: 'https://api.softbook.example/v1/auth/verify-code',
    },
  });
});

test('auth runtime config rejects remote mode without baseUrl', () => {
  expect(() =>
    resolveAuthRepositoryConfig({
      auth: {
        mode: 'remote',
      },
    }),
  ).toThrow('Remote auth mode requires auth.remote.baseUrl.');
});
