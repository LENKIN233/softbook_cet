import {createWebAccountDeletionRecoveryRepository} from './webAccountDeletionRecovery';

const PHONE = '13800138000';
const CHALLENGE_ID = 'challenge_recovery_1234567890';

describe('Web account deletion recovery repository', () => {
  it('uses dedicated credential-free routes and parses pending state', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        challenge_id: CHALLENGE_ID,
        delivery: 'receiver_sms_provider',
        expires_at: '2026-08-30T12:05:00.000Z',
        purpose: 'account_deletion_recovery',
        retry_after_seconds: 60,
      }))
      .mockResolvedValueOnce(jsonResponse({
        deletion_request: {
          id: 'delete_recovery_1234567890',
          requested_at: '2026-08-30T12:00:00.000Z',
          status: 'processing',
        },
        safe_to_register: false,
        schema_version: 'account-deletion-recovery.v1',
        state: 'pending',
      }));
    const repository = createWebAccountDeletionRecoveryRepository({
      baseUrl: 'https://runtime.example.cn/',
      fetchImpl,
    });

    const challenge = await repository.requestCode(PHONE);
    await expect(
      repository.verifyCode({challenge, smsCode: '123456'}),
    ).resolves.toEqual({
      deletionRequest: {
        id: 'delete_recovery_1234567890',
        requestedAt: '2026-08-30T12:00:00.000Z',
        status: 'processing',
      },
      safeToRegister: false,
      state: 'pending',
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://runtime.example.cn/v2/account/deletion/recovery/request-code',
      expect.objectContaining({
        body: JSON.stringify({phone_number: PHONE}),
        method: 'POST',
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://runtime.example.cn/v2/account/deletion/recovery/verify-code',
      expect.objectContaining({
        body: JSON.stringify({
          challenge_id: CHALLENGE_ID,
          phone_number: PHONE,
          sms_code: '123456',
        }),
        method: 'POST',
      }),
    );
    for (const [, init] of fetchImpl.mock.calls) {
      expect(new Headers(init?.headers).has('Authorization')).toBe(false);
      expect(new Headers(init?.headers).get('x-softbook-client')).toBe('web');
    }
  });

  it('accepts exact none only as safe registration without completion', async () => {
    const repository = createWebAccountDeletionRecoveryRepository({
      baseUrl: 'https://runtime.example.cn',
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse({
          challenge_id: CHALLENGE_ID,
          delivery: 'sms_cloudbase_auth_default',
          expires_at: '2026-08-30T12:05:00.000Z',
          purpose: 'account_deletion_recovery',
          retry_after_seconds: 0,
        }))
        .mockResolvedValueOnce(jsonResponse({
          deletion_request: null,
          safe_to_register: true,
          schema_version: 'account-deletion-recovery.v1',
          state: 'none',
        })),
    });

    const challenge = await repository.requestCode(PHONE);
    await expect(
      repository.verifyCode({challenge, smsCode: '123456'}),
    ).resolves.toEqual({
      deletionRequest: null,
      safeToRegister: true,
      state: 'none',
    });
  });

  it.each([
    {
      deletion_request: null,
      safe_to_register: false,
      schema_version: 'account-deletion-recovery.v1',
      state: 'none',
    },
    {
      deletion_request: {
        id: 'delete_too_short',
        requested_at: '2026-08-30T12:00:00.000Z',
        status: 'queued',
      },
      safe_to_register: false,
      schema_version: 'account-deletion-recovery.v1',
      state: 'pending',
    },
    {
      deletion_request: {
        id: 'delete_recovery_1234567890',
        requested_at: '2026-08-30T12:00:00Z',
        status: 'queued',
      },
      safe_to_register: false,
      schema_version: 'account-deletion-recovery.v1',
      state: 'pending',
    },
    {
      access_token: 'must-not-be-accepted',
      deletion_request: null,
      safe_to_register: true,
      schema_version: 'account-deletion-recovery.v1',
      state: 'none',
    },
  ])('rejects contradictory or noncanonical verify payload %#', async data => {
    const repository = createWebAccountDeletionRecoveryRepository({
      baseUrl: 'https://runtime.example.cn',
      fetchImpl: vi.fn(async () => jsonResponse(data)),
    });

    await expect(
      repository.verifyCode({
        challenge: {
          challengeId: CHALLENGE_ID,
          delivery: 'sms',
          expiresAt: '2026-08-30T12:05:00.000Z',
          phoneNumber: PHONE,
          retryAfterSeconds: 0,
        },
        smsCode: '123456',
      }),
    ).rejects.toThrow(/Deletion recovery/);
  });
});

function jsonResponse(data: Record<string, unknown>) {
  return new Response(JSON.stringify({data}), {
    headers: {'content-type': 'application/json'},
    status: 200,
  });
}
