import {resolveLearningEventsRepositoryConfig} from '../src/sync/learningEventsRuntimeConfig';

test('learning events runtime config defaults to local', () => {
  expect(resolveLearningEventsRepositoryConfig(undefined)).toEqual({
    mode: 'local',
  });
});

test('learning events runtime config resolves the v2 endpoint', () => {
  expect(
    resolveLearningEventsRepositoryConfig({
      accountBootstrap: {
        mode: 'remote',
        remote: {baseUrl: 'https://api.softbook.example'},
      },
      auth: {
        mode: 'remote',
        remote: {baseUrl: 'https://api.softbook.example'},
      },
      learningSource: {
        mode: 'remote',
        remote: {baseUrl: 'https://api.softbook.example'},
      },
      learningState: {
        mode: 'remote',
        remote: {
          apiKey: 'event-key',
          baseUrl: 'https://api.softbook.example/',
        },
      },
    }),
  ).toEqual({
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://api.softbook.example/v2/learning/events',
      headers: {
        'x-api-key': 'event-key',
        'x-softbook-client': 'mobile',
      },
    },
  });
});

test('remote learning events require remote auth', () => {
  expect(() =>
    resolveLearningEventsRepositoryConfig({
      accountBootstrap: {
        mode: 'remote',
        remote: {baseUrl: 'https://api.softbook.example'},
      },
      auth: {mode: 'local'},
      learningSource: {
        mode: 'remote',
        remote: {baseUrl: 'https://api.softbook.example'},
      },
      learningState: {
        mode: 'remote',
        remote: {baseUrl: 'https://api.softbook.example'},
      },
    }),
  ).toThrow('requires auth.mode to also be remote');
});

test.each([
  {
    accountBootstrap: 'local' as const,
    learningSource: 'remote' as const,
  },
  {
    accountBootstrap: 'remote' as const,
    learningSource: 'local' as const,
  },
])(
  'remote learning events fail closed without canonical content validation',
  modes => {
    expect(() =>
      resolveLearningEventsRepositoryConfig({
        accountBootstrap: {mode: modes.accountBootstrap},
        auth: {
          mode: 'remote',
          remote: {baseUrl: 'https://api.softbook.example'},
        },
        learningSource: {mode: modes.learningSource},
        learningState: {
          mode: 'remote',
          remote: {baseUrl: 'https://api.softbook.example'},
        },
      }),
    ).toThrow(
      'Remote learning events require remote account bootstrap and learning source modes.',
    );
  },
);
