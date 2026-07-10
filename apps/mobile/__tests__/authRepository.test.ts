import {
  createAuthRepository,
  parseSoftbookRemoteAuthVerifyPayload,
} from '../src/auth/authRepository';

test('local auth repository verifies a phone number without fetch', async () => {
  const repository = createAuthRepository({
    mode: 'local',
  });

  await expect(repository.requestSmsCode('13800138000')).resolves.toBeUndefined();
  await expect(
    repository.verifySmsCode({
      phoneNumber: '13800138000',
      smsCode: '2468',
    }),
  ).resolves.toEqual({
    phoneNumber: '13800138000',
  });
});

test('remote auth repository posts request-code and verify-code payloads', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
    })
    .mockResolvedValueOnce({
      json: async () => ({
        data: {
          auth_token: 'token-123',
          phone_number: '13800138000',
        },
      }),
      ok: true,
      status: 200,
    });
  const repository = createAuthRepository({
    fetchImpl: fetchMock,
    mode: 'remote',
    remoteConfig: {
      headers: {
        'x-softbook-client': 'mobile',
      },
      requestCodeEndpoint: 'https://api.softbook.example/v1/auth/request-code',
      verifyCodeEndpoint: 'https://api.softbook.example/v1/auth/verify-code',
    },
  });

  await repository.requestSmsCode('13800138000');
  await expect(
    repository.verifySmsCode({
      phoneNumber: '13800138000',
      smsCode: '2468',
    }),
  ).resolves.toEqual({
    authToken: 'token-123',
    phoneNumber: '13800138000',
  });

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    'https://api.softbook.example/v1/auth/request-code',
    expect.objectContaining({
      method: 'POST',
    }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    'https://api.softbook.example/v1/auth/verify-code',
    expect.objectContaining({
      method: 'POST',
    }),
  );
});

test('remote auth verify payload must match the requested phone number', () => {
  expect(() =>
    parseSoftbookRemoteAuthVerifyPayload(
      {
        data: {
          phone_number: '13800138001',
        },
      },
      '13800138000',
    ),
  ).toThrow(
    'Remote auth verify payload.data.phone_number must match requested phone number 13800138000.',
  );
});

test('remote auth verify payload requires a non-empty auth token', () => {
  expect(() =>
    parseSoftbookRemoteAuthVerifyPayload(
      {
        data: {
          phone_number: '13800138000',
        },
      },
      '13800138000',
    ),
  ).toThrow('Remote auth verify payload.data.auth_token is required.');

  expect(() =>
    parseSoftbookRemoteAuthVerifyPayload(
      {
        data: {
          auth_token: '   ',
          phone_number: '13800138000',
        },
      },
      '13800138000',
    ),
  ).toThrow('Remote auth verify payload.data.auth_token is required.');
});
