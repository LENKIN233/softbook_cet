import {createInitialMembershipState} from '../src/membership/localMembership';
import {
  createMembershipRepository,
  parseSoftbookRemoteMembershipPayload,
} from '../src/membership/membershipRepository';

const authenticatedContext = {
  authToken: 'user-token',
  phoneNumber: '13800138000',
};

test('local membership repository loads trial-available state and updates it locally', async () => {
  const repository = createMembershipRepository({
    mode: 'local',
  });

  const initialState = await repository.loadState(authenticatedContext);
  const trialResult = await repository.startTrial(
    authenticatedContext,
    initialState,
  );

  expect(initialState).toEqual(createInitialMembershipState());
  expect(trialResult.mode).toBe('local');
  expect(trialResult.state.stage).toBe('trial');
});

test('remote membership repository loads entitlement and refuses direct trial mutation', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      json: async () => ({
        data: {
          entitlement: {
            counted_entry_count: 2,
            last_experience_ended_by: null,
            recovery_prompt_visible: false,
            stage: 'free',
            trial_duration_days: 5,
            trial_expires_at: '2026-07-20T08:00:00.000Z',
            trial_remaining_seconds: 0,
            trial_started_at: '2026-07-15T08:00:00.000Z',
            trial_started_at_entry_count: 1,
          },
        },
      }),
      ok: true,
      status: 200,
    });
  const repository = createMembershipRepository({
    fetchImpl: fetchMock,
    mode: 'remote',
    remoteConfig: {
      dismissRecoveryEndpoint:
        'https://api.softbook.example/v2/membership/dismiss-recovery',
      entitlementEndpoint:
        'https://api.softbook.example/v2/membership/entitlement',
      headers: {
        'x-softbook-client': 'mobile',
      },
      purchaseEndpoint: 'https://api.softbook.example/v2/membership/purchase',
    },
  });

  const state = await repository.loadState(authenticatedContext);
  expect(state.stage).toBe('free');
  await expect(repository.startTrial(authenticatedContext, state)).rejects.toThrow(
    'Remote membership trials start only from Learning Session.',
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    'https://api.softbook.example/v2/membership/entitlement',
    expect.objectContaining({
      method: 'GET',
    }),
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('remote membership repository requires auth token', async () => {
  const repository = createMembershipRepository({
    fetchImpl: jest.fn(),
    mode: 'remote',
    remoteConfig: {
      dismissRecoveryEndpoint:
        'https://api.softbook.example/v2/membership/dismiss-recovery',
      entitlementEndpoint:
        'https://api.softbook.example/v2/membership/entitlement',
      purchaseEndpoint: 'https://api.softbook.example/v2/membership/purchase',
    },
  });

  await expect(
    repository.loadState({
      phoneNumber: '13800138000',
    }),
  ).rejects.toThrow('Remote membership repository requires authToken.');
});

test('remote membership repository preserves authorization status', async () => {
  const repository = createMembershipRepository({
    fetchImpl: jest.fn().mockResolvedValue({
      json: async () => ({}),
      ok: false,
      status: 401,
    }),
    mode: 'remote',
    remoteConfig: {
      dismissRecoveryEndpoint:
        'https://api.softbook.example/v2/membership/dismiss-recovery',
      entitlementEndpoint:
        'https://api.softbook.example/v2/membership/entitlement',
      purchaseEndpoint: 'https://api.softbook.example/v2/membership/purchase',
    },
  });

  await expect(
    repository.loadState(authenticatedContext),
  ).rejects.toMatchObject({status: 401});
});

test('remote membership payload parser validates stage', () => {
  expect(() =>
    parseSoftbookRemoteMembershipPayload({
      data: {
        entitlement: {
          counted_entry_count: 0,
          last_experience_ended_by: null,
          recovery_prompt_visible: false,
          stage: 'invalid',
          trial_duration_days: 5,
          trial_expires_at: null,
          trial_remaining_seconds: 0,
          trial_started_at: null,
          trial_started_at_entry_count: null,
        },
      },
    }),
  ).toThrow(
    'Remote membership payload.data.entitlement.stage must be a valid membership stage.',
  );
});

test('remote membership payload parser rejects trial clock drift', () => {
  expect(() =>
    parseSoftbookRemoteMembershipPayload({
      data: {
        entitlement: {
          counted_entry_count: 1,
          last_experience_ended_by: null,
          recovery_prompt_visible: false,
          stage: 'trial',
          trial_duration_days: 5,
          trial_expires_at: '2026-07-21T08:00:00.000Z',
          trial_remaining_seconds: 432001,
          trial_started_at: '2026-07-15T08:00:00.000Z',
          trial_started_at_entry_count: 1,
        },
      },
    }),
  ).toThrow(
    'Remote membership payload.data.entitlement trial clock is invalid.',
  );
});
