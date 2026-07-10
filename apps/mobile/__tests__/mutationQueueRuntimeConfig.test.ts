import {resolveMutationQueueRepositoryConfig} from '../src/sync/mutationQueueRuntimeConfig';

describe('mutationQueueRuntimeConfig', () => {
  it('defaults to local mode', () => {
    const config = resolveMutationQueueRepositoryConfig({});

    expect(config.mode).toBe('local');
  });

  it('throws when remote mode is requested', () => {
    expect(() => {
      resolveMutationQueueRepositoryConfig({
        mutationQueue: {mode: 'remote'},
      });
    }).toThrow(/remote mode not supported/);
  });

  it('returns local mode when undefined', () => {
    const config = resolveMutationQueueRepositoryConfig(undefined);

    expect(config.mode).toBe('local');
  });
});
