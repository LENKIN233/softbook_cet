import {
  createAuthRepository,
  createSoftbookRemoteAuthConfig,
  parseSoftbookRemoteAuthSession,
} from '../src/auth/authRepository';
import type {RemoteAuthSession} from '../src/auth/authSession';
import {RemoteHttpError} from '../src/runtime/remoteHttpError';
import {RemoteRequestLifecycleError} from '../src/runtime/remoteRequest';

const NOW = new Date('2026-07-20T00:00:00.000Z');

afterEach(() => {
  jest.useRealTimers();
});

function createSessionPayload(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      access_token: 'softbook_v2.access.signature',
      expires_in: 900,
      phone_number: '13800138000',
      refresh_expires_at: '2026-08-19T00:00:00.000Z',
      refresh_token: 'softbook_refresh.session.0.payload.signature',
      session_id: 'session-123',
      token_type: 'Bearer',
      ...overrides,
    },
  };
}

test('local auth repository binds verification to its SMS challenge', async () => {
  const repository = createAuthRepository({mode: 'local'});
  const challenge = await repository.requestSmsCode('13800138000');

  expect(challenge).toEqual({
    mode: 'local',
    phoneNumber: '13800138000',
  });
  await expect(
    repository.verifySmsCode({
      challenge,
      phoneNumber: '13800138000',
      smsCode: '2468',
    }),
  ).resolves.toEqual({
    mode: 'local',
    phoneNumber: '13800138000',
  });
});

test('remote auth repository uses challenge-bound v2 verification', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      json: async () => ({
        data: {
          challenge_id: 'challenge-123',
          expires_at: '2026-07-20T00:05:00.000Z',
          retry_after_seconds: 60,
        },
      }),
      ok: true,
      status: 200,
    })
    .mockResolvedValueOnce({
      json: async () => createSessionPayload(),
      ok: true,
      status: 200,
    });
  const remoteConfig = createSoftbookRemoteAuthConfig({
    baseUrl: 'https://api.softbook.example/',
  });
  const repository = createAuthRepository({
    fetchImpl: fetchMock,
    mode: 'remote',
    now: () => NOW,
    remoteConfig,
  });

  const challenge = await repository.requestSmsCode('13800138000');
  await expect(
    repository.verifySmsCode({
      challenge,
      phoneNumber: '13800138000',
      smsCode: '2468',
    }),
  ).resolves.toEqual({
    accessToken: 'softbook_v2.access.signature',
    accessTokenExpiresAt: '2026-07-20T00:15:00.000Z',
    mode: 'remote',
    phoneNumber: '13800138000',
    refreshExpiresAt: '2026-08-19T00:00:00.000Z',
    refreshToken: 'softbook_refresh.session.0.payload.signature',
    sessionId: 'session-123',
    tokenType: 'Bearer',
  });

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    'https://api.softbook.example/v2/auth/request-code',
    expect.objectContaining({method: 'POST'}),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    'https://api.softbook.example/v2/auth/verify-code',
    expect.objectContaining({
      body: JSON.stringify({
        challenge_id: 'challenge-123',
        phone_number: '13800138000',
        sms_code: '2468',
      }),
      method: 'POST',
    }),
  );
});

test('remote auth repository rotates refresh credentials and revokes logout', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      json: async () =>
        createSessionPayload({
          access_token: 'softbook_v2.rotated.signature',
          refresh_token: 'softbook_refresh.session.1.payload.signature',
        }),
      ok: true,
      status: 200,
    })
    .mockResolvedValueOnce({
      json: async () => undefined,
      ok: true,
      status: 204,
    });
  const repository = createAuthRepository({
    fetchImpl: fetchMock,
    mode: 'remote',
    now: () => NOW,
    remoteConfig: createSoftbookRemoteAuthConfig({
      baseUrl: 'https://api.softbook.example',
    }),
  });
  const session = parseSoftbookRemoteAuthSession(
    createSessionPayload(),
    '13800138000',
    NOW,
  );

  const refreshed = await repository.refreshSession(session);
  await repository.logout(refreshed);

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    'https://api.softbook.example/v2/auth/refresh',
    expect.objectContaining({
      body: JSON.stringify({refresh_token: session.refreshToken}),
    }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    'https://api.softbook.example/v2/auth/logout',
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: `Bearer ${refreshed.accessToken}`,
      }),
    }),
  );
});

test('remote auth challenge cannot be submitted for a different phone', async () => {
  const repository = createAuthRepository({mode: 'local'});
  const challenge = await repository.requestSmsCode('13800138000');

  await expect(
    repository.verifySmsCode({
      challenge,
      phoneNumber: '13800138001',
      smsCode: '2468',
    }),
  ).rejects.toThrow('SMS challenge does not match');
});

test('remote auth session parser rejects identity and session substitution', () => {
  expect(() =>
    parseSoftbookRemoteAuthSession(
      createSessionPayload({phone_number: '13800138001'}),
      '13800138000',
      NOW,
    ),
  ).toThrow('must match requested phone number');

  expect(() =>
    parseSoftbookRemoteAuthSession(
      createSessionPayload(),
      '13800138000',
      NOW,
      'different-session',
    ),
  ).toThrow('changed the server session identifier');
});

test('remote auth failures preserve the response status', async () => {
  const repository = createAuthRepository({
    fetchImpl: jest.fn(async () => ({
      json: async () => ({}),
      ok: false,
      status: 429,
    })),
    mode: 'remote',
    remoteConfig: createSoftbookRemoteAuthConfig({
      baseUrl: 'https://api.softbook.example',
    }),
  });

  await expect(repository.requestSmsCode('13800138000')).rejects.toEqual(
    expect.objectContaining<Partial<RemoteHttpError>>({status: 429}),
  );
});

test('refresh requires a remote session', async () => {
  const repository = createAuthRepository({mode: 'local'});

  await expect(
    repository.refreshSession({} as RemoteAuthSession),
  ).rejects.toThrow('cannot be refreshed remotely');
});

test('remote auth timeout bounds a fetch that never returns headers', async () => {
  jest.useFakeTimers();
  let requestSignal: AbortSignal | undefined;
  const repository = createAuthRepository({
    fetchImpl: jest.fn(
      (_input, init) =>
        new Promise(() => {
          requestSignal = init?.signal;
        }),
    ),
    mode: 'remote',
    remoteConfig: createSoftbookRemoteAuthConfig({
      baseUrl: 'https://api.softbook.example',
    }),
    requestTimeoutMs: 20,
  });

  const request = repository.requestSmsCode('13800138000');
  const outcome = request.catch(error => error);
  jest.advanceTimersByTime(20);

  await expect(outcome).resolves.toEqual(
    expect.objectContaining<Partial<RemoteRequestLifecycleError>>({
      reason: 'timeout',
      retryable: true,
    }),
  );
  expect(requestSignal?.aborted).toBe(true);
});

test('remote auth timeout includes response parsing', async () => {
  jest.useFakeTimers();
  const repository = createAuthRepository({
    fetchImpl: jest.fn(async () => ({
      json: () => new Promise(() => undefined),
      ok: true,
      status: 200,
    })),
    mode: 'remote',
    remoteConfig: createSoftbookRemoteAuthConfig({
      baseUrl: 'https://api.softbook.example',
    }),
    requestTimeoutMs: 20,
  });

  const request = repository.requestSmsCode('13800138000');
  const outcome = request.catch(error => error);
  jest.advanceTimersByTime(20);

  await expect(outcome).resolves.toMatchObject({reason: 'timeout'});
});

test('session cancellation aborts a pending refresh without becoming authorization failure', async () => {
  const session = parseSoftbookRemoteAuthSession(
    createSessionPayload(),
    '13800138000',
    NOW,
  );
  const cancellation = new AbortController();
  let requestSignal: AbortSignal | undefined;
  const repository = createAuthRepository({
    fetchImpl: jest.fn(
      (_input, init) =>
        new Promise(() => {
          requestSignal = init?.signal;
        }),
    ),
    mode: 'remote',
    remoteConfig: createSoftbookRemoteAuthConfig({
      baseUrl: 'https://api.softbook.example',
    }),
  });

  const request = repository.refreshSession(session, {
    cancellationReason: 'session_superseded',
    signal: cancellation.signal,
  });
  cancellation.abort();

  await expect(request).rejects.toMatchObject({
    reason: 'session_superseded',
    retryable: false,
  });
  expect(requestSignal?.aborted).toBe(true);
});
