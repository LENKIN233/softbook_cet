import type {SoftbookAppRuntimeConfig} from '../learning/learningRuntimeConfig';

import {
  MembershipRepositoryConfig,
  createSoftbookRemoteMembershipConfig,
} from './membershipRepository';

export function resolveMembershipRepositoryConfig(
  runtimeConfig: SoftbookAppRuntimeConfig | undefined,
): MembershipRepositoryConfig {
  const membership = runtimeConfig?.membership;
  const mode = membership?.mode ?? 'local';

  if (mode === 'remote') {
    if (!membership?.remote?.baseUrl) {
      throw new Error(
        'Remote membership mode requires membership.remote.baseUrl.',
      );
    }

    return {
      mode: 'remote',
      remoteConfig: createSoftbookRemoteMembershipConfig(membership.remote),
    };
  }

  return {
    mode: 'local',
  };
}
