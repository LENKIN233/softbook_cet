import {SoftbookAppRuntimeConfig} from '../learning/learningRuntimeConfig';

export interface MutationQueueRuntimeConfig {
  mode?: 'local' | 'remote';
}

export function resolveMutationQueueRepositoryConfig(
  runtimeConfig: SoftbookAppRuntimeConfig | undefined,
): MutationQueueRuntimeConfig {
  const mutationQueue = runtimeConfig?.mutationQueue;

  if (!mutationQueue) {
    return {mode: 'local'};
  }

  if (mutationQueue.mode === 'remote') {
    throw new Error(
      'Mutation queue remote mode not supported; mutations are always queued locally for offline-first behavior.',
    );
  }

  return {
    mode: 'local',
  };
}
