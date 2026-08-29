import {
  assertRemoteRuntimeUsesRemoteAuth,
  type SoftbookAppRuntimeConfig,
} from '../learning/learningRuntimeConfig';

import type {LearningEventsRepositoryConfig} from './learningEventsRepository';
import {
  createSoftbookClientHeaders,
  resolveSoftbookClientKind,
} from '../runtime/remoteClient';

export function resolveLearningEventsRepositoryConfig(
  runtimeConfig: SoftbookAppRuntimeConfig | undefined,
): LearningEventsRepositoryConfig {
  const learningState = runtimeConfig?.learningState;
  const mode = learningState?.mode ?? 'local';

  if (mode === 'remote') {
    assertRemoteRuntimeUsesRemoteAuth(runtimeConfig, 'learningState');

    if (
      runtimeConfig?.accountBootstrap?.mode !== 'remote' ||
      runtimeConfig.learningSource?.mode !== 'remote'
    ) {
      throw new Error(
        'Remote learning events require remote account bootstrap and learning source modes.',
      );
    }

    if (!learningState?.remote?.baseUrl) {
      throw new Error(
        'Remote learning events require learningState.remote.baseUrl.',
      );
    }

    return {
      mode: 'remote',
      remoteConfig: {
        clientKind: resolveSoftbookClientKind(runtimeConfig?.clientKind),
        endpoint: `${learningState.remote.baseUrl.replace(
          /\/$/,
          '',
        )}/v2/learning/events`,
        headers: {
          ...createSoftbookClientHeaders(runtimeConfig?.clientKind),
          ...(learningState.remote.apiKey
            ? {'x-api-key': learningState.remote.apiKey}
            : {}),
        },
      },
    };
  }

  return {mode: 'local'};
}
