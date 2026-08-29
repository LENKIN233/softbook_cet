import {
  createSoftbookClientHeaders,
  resolveSoftbookClientKind,
} from '../src/runtime/remoteClient';
import {createSoftbookRemoteAuthConfig} from '../src/auth/authRepository';
import {createSoftbookRemoteLearningCardSourceConfig} from '../src/learning/remoteCardSource';

test('uses mobile as the exact default client kind', () => {
  expect(resolveSoftbookClientKind(undefined)).toBe('mobile');
  expect(createSoftbookClientHeaders()).toEqual({
    'x-softbook-client': 'mobile',
  });
  expect(
    createSoftbookRemoteAuthConfig({baseUrl: 'https://api.example'}),
  ).toMatchObject({
    clientKind: 'mobile',
    headers: {'x-softbook-client': 'mobile'},
  });
});

test('propagates an explicit web client kind into shared remote configs', () => {
  expect(
    createSoftbookClientHeaders('web', {
      'X-Softbook-Client': 'mobile',
      'x-trace-id': 'trace-1',
    }),
  ).toEqual({
    'x-softbook-client': 'web',
    'x-trace-id': 'trace-1',
  });
  expect(
    createSoftbookRemoteLearningCardSourceConfig({
      baseUrl: 'https://api.example',
      clientKind: 'web',
    }),
  ).toMatchObject({
    clientKind: 'web',
    headers: {'x-softbook-client': 'web'},
  });
});
