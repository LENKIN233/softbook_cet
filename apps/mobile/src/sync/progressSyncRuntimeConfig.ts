import {
  assertRemoteRuntimeUsesRemoteAuth,
  type SoftbookAppRuntimeConfig,
} from '../learning/learningRuntimeConfig';

import type { ProgressSyncRepositoryConfig } from './progressSyncRepository';

export type ProgressSyncRemoteRuntimeConfig = {
  apiKey?: string;
  baseUrl: string;
};

export type ProgressSyncRuntimeConfig = {
  mode?: 'local' | 'remote';
  remote?: ProgressSyncRemoteRuntimeConfig;
};

export function resolveProgressSyncRepositoryConfig(
  runtimeConfig: SoftbookAppRuntimeConfig | undefined,
): ProgressSyncRepositoryConfig {
  const progressSync = runtimeConfig?.progressSync;
  const mode = progressSync?.mode ?? 'local';

  if (mode === 'remote') {
    assertRemoteRuntimeUsesRemoteAuth(runtimeConfig, 'progressSync');

    if (runtimeConfig?.accountBootstrap?.mode !== 'remote') {
      throw new Error(
        'Remote progress check-in requires remote account bootstrap mode.',
      );
    }

    if (!progressSync?.remote?.baseUrl) {
      throw new Error(
        'Remote daily check-in mode requires progressSync.remote.baseUrl.',
      );
    }

    return {
      mode: 'remote',
      remoteConfig: {
        endpoint: `${progressSync.remote.baseUrl.replace(/\/$/, '')}/v2/progress/check-in`,
        headers: {
          'x-softbook-client': 'mobile',
          ...(progressSync.remote.apiKey
            ? {
                'x-api-key': progressSync.remote.apiKey,
              }
            : {}),
        },
      },
    };
  }

  return {
    mode: 'local',
  };
}
