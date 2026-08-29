import type {SoftbookAppRuntimeConfig} from '../learning/learningRuntimeConfig';

import {
  createSoftbookRemoteAccountDeletionConfig,
  type AccountDeletionRepositoryConfig,
} from './accountDeletionRepository';

export function resolveAccountDeletionRepositoryConfig(
  runtimeConfig: SoftbookAppRuntimeConfig | undefined,
): AccountDeletionRepositoryConfig | null {
  const auth = runtimeConfig?.auth;

  if (auth?.mode !== 'remote') {
    return null;
  }

  if (!auth.remote?.baseUrl) {
    throw new Error(
      'Remote account deletion requires auth.remote.baseUrl.',
    );
  }

  return createSoftbookRemoteAccountDeletionConfig(auth.remote);
}
