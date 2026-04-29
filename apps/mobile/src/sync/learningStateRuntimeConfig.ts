import {
  assertRemoteRuntimeUsesRemoteAuth,
  type SoftbookAppRuntimeConfig,
} from '../learning/learningRuntimeConfig';

import type {LearningStateRepositoryConfig} from './learningStateRepository';

export type LearningStateRemoteRuntimeConfig = {
  apiKey?: string;
  baseUrl: string;
};

export type LearningStateRuntimeConfig = {
  mode?: 'local' | 'remote';
  remote?: LearningStateRemoteRuntimeConfig;
};

export function resolveLearningStateRepositoryConfig(
  runtimeConfig: SoftbookAppRuntimeConfig | undefined,
): LearningStateRepositoryConfig {
  const learningState = runtimeConfig?.learningState;
  const mode = learningState?.mode ?? 'local';

  if (mode === 'remote') {
    assertRemoteRuntimeUsesRemoteAuth(runtimeConfig, 'learningState');

    if (!learningState?.remote?.baseUrl) {
      throw new Error(
        'Remote learning state mode requires learningState.remote.baseUrl.',
      );
    }

    return {
      mode: 'remote',
      remoteConfig: {
        endpoint: `${learningState.remote.baseUrl.replace(/\/$/, '')}/v1/learning/state-sync`,
        headers: {
          'x-softbook-client': 'mobile',
          ...(learningState.remote.apiKey
            ? {
                'x-api-key': learningState.remote.apiKey,
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
