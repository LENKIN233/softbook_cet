import type { SoftbookAppRuntimeConfig } from '../learning/learningRuntimeConfig';

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
    if (!progressSync?.remote?.baseUrl) {
      throw new Error(
        'Remote progress sync mode requires progressSync.remote.baseUrl.',
      );
    }

    return {
      mode: 'remote',
      remoteConfig: {
        endpoint: `${progressSync.remote.baseUrl.replace(/\/$/, '')}/v1/progress/daily-sync`,
        headers: progressSync.remote.apiKey
          ? {
              Authorization: `Bearer ${progressSync.remote.apiKey}`,
            }
          : undefined,
      },
    };
  }

  return {
    mode: 'local',
  };
}
