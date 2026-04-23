import {resolveMembershipRepositoryConfig} from '../src/membership/membershipRuntimeConfig';

test('membership runtime config defaults repository mode to local', () => {
  expect(resolveMembershipRepositoryConfig(undefined)).toEqual({
    mode: 'local',
  });
});

test('membership runtime config can switch repository mode to remote', () => {
  expect(
    resolveMembershipRepositoryConfig({
      membership: {
        mode: 'remote',
        remote: {
          apiKey: 'membership-key',
          baseUrl: 'https://api.softbook.example/',
        },
      },
    }),
  ).toEqual({
    mode: 'remote',
    remoteConfig: {
      dismissRecoveryEndpoint:
        'https://api.softbook.example/v1/membership/dismiss-recovery',
      entitlementEndpoint:
        'https://api.softbook.example/v1/membership/entitlement',
      headers: {
        'x-api-key': 'membership-key',
        'x-softbook-client': 'mobile',
      },
      purchaseEndpoint: 'https://api.softbook.example/v1/membership/purchase',
      startTrialEndpoint: 'https://api.softbook.example/v1/membership/start-trial',
    },
  });
});

test('membership runtime config rejects remote mode without baseUrl', () => {
  expect(() =>
    resolveMembershipRepositoryConfig({
      membership: {
        mode: 'remote',
      },
    }),
  ).toThrow('Remote membership mode requires membership.remote.baseUrl.');
});
