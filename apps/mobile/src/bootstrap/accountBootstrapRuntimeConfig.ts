import type { SoftbookAppRuntimeConfig } from '../learning/learningRuntimeConfig';
import { assertRemoteRuntimeUsesRemoteAuth } from '../learning/learningRuntimeConfig';
import {readInstalledClientIdentity} from '../runtime/installedClientVersion';

import {
  createSoftbookRemoteAccountBootstrapConfig,
  type AccountBootstrapRepositoryConfig,
} from './accountBootstrapRepository';

export function resolveAccountBootstrapRepositoryConfig(
  runtimeConfig: SoftbookAppRuntimeConfig | undefined,
): AccountBootstrapRepositoryConfig {
  const accountBootstrap = runtimeConfig?.accountBootstrap;
  const mode = accountBootstrap?.mode ?? 'local';

  if (mode === 'remote') {
    assertRemoteRuntimeUsesRemoteAuth(runtimeConfig, 'accountBootstrap');

    if (runtimeConfig?.learningSource?.mode !== 'remote') {
      throw new Error(
        'Remote account bootstrap requires learningSource to also be remote.',
      );
    }

    if (!accountBootstrap?.remote?.baseUrl.trim()) {
      throw new Error(
        'Remote account bootstrap mode requires accountBootstrap.remote.baseUrl.',
      );
    }

    return {
      mode: 'remote',
      remoteConfig: createSoftbookRemoteAccountBootstrapConfig(
        {
          ...accountBootstrap.remote,
          clientKind: runtimeConfig?.clientKind,
          installedClientIdentityProvider: readInstalledClientIdentity,
        },
      ),
    };
  }

  return { mode: 'local' };
}
