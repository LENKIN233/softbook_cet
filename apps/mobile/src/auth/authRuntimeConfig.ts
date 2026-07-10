import type {SoftbookAppRuntimeConfig} from '../learning/learningRuntimeConfig';

import {
  AuthRepositoryConfig,
  createSoftbookRemoteAuthConfig,
} from './authRepository';

export function resolveAuthRepositoryConfig(
  runtimeConfig: SoftbookAppRuntimeConfig | undefined,
): AuthRepositoryConfig {
  const auth = runtimeConfig?.auth;
  const mode = auth?.mode ?? 'local';

  if (mode === 'remote') {
    if (!auth?.remote?.baseUrl) {
      throw new Error('Remote auth mode requires auth.remote.baseUrl.');
    }

    return {
      mode: 'remote',
      remoteConfig: createSoftbookRemoteAuthConfig(auth.remote),
    };
  }

  return {
    mode: 'local',
  };
}
