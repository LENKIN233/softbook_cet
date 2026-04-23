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

test('remote membership repository loads entitlement and posts mutations', async () => {
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
            trial_started_at_entry_count: 1,
          },
        },
      }),
      ok: true,
      status: 200,
    })
    .mockResolvedValueOnce({
      json: async () => ({
        data: {
          entitlement: {
            counted_entry_count: 3,
            last_experience_ended_by: null,
            recovery_prompt_visible: false,
            stage: 'trial',
            trial_duration_days: 5,
            trial_started_at_entry_count: 3,
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
        'https://api.softbook.example/v1/membership/dismiss-recovery',
      entitlementEndpoint:
        'https://api.softbook.example/v1/membership/entitlement',
      headers: {
        'x-softbook-client': 'mobile',
      },
      purchaseEndpoint: 'https://api.softbook.example/v1/membership/purchase',
      startTrialEndpoint: 'https://api.softbook.example/v1/membership/start-trial',
    },
  });

  const state = await repository.loadState(authenticatedContext);
  const trialResult = await repository.startTrial(authenticatedContext, state);

  expect(state.stage).toBe('free');
  expect(trialResult.mode).toBe('remote');
  expect(trialResult.state.stage).toBe('trial');
  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    'https://api.softbook.example/v1/membership/entitlement',
    expect.objectContaining({
      method: 'GET',
    }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    'https://api.softbook.example/v1/membership/start-trial',
    expect.objectContaining({
      method: 'POST',
    }),
  );
});

test('remote membership repository requires auth token', async () => {
  const repository = createMembershipRepository({
    fetchImpl: jest.fn(),
    mode: 'remote',
    remoteConfig: {
      dismissRecoveryEndpoint:
        'https://api.softbook.example/v1/membership/dismiss-recovery',
      entitlementEndpoint:
        'https://api.softbook.example/v1/membership/entitlement',
      purchaseEndpoint: 'https://api.softbook.example/v1/membership/purchase',
      startTrialEndpoint: 'https://api.softbook.example/v1/membership/start-trial',
    },
  });

  await expect(
    repository.loadState({
      phoneNumber: '13800138000',
    }),
  ).rejects.toThrow('Remote membership repository requires authToken.');
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
          trial_started_at_entry_count: null,
        },
      },
    }),
  ).toThrow(
    'Remote membership payload.data.entitlement.stage must be a valid membership stage.',
  );
});
