import type { SoftbookAppRuntimeConfig } from '../learning/learningRuntimeConfig';
import { assertRemoteRuntimeUsesRemoteAuth } from '../learning/learningRuntimeConfig';
import type { SpaceStateRepositoryConfig } from './spaceStateRepository';

export type SoftbookRemoteSpaceStateRuntimeConfig = {
  apiKey?: string;
  baseUrl: string;
};

export function resolveSpaceStateRepositoryConfig(
  runtimeConfig: SoftbookAppRuntimeConfig,
): SpaceStateRepositoryConfig {
  const spaceState = runtimeConfig?.spaceState;
  const mode = spaceState?.mode ?? 'local';

  if (mode === 'remote') {
    assertRemoteRuntimeUsesRemoteAuth(runtimeConfig, 'spaceState');

    if (runtimeConfig.accountBootstrap?.mode !== 'remote') {
      throw new Error(
        'Remote space state requires accountBootstrap.mode to also be remote.',
      );
    }

    if (!spaceState?.remote?.baseUrl) {
      throw new Error(
        'Remote space state mode requires spaceState.remote.baseUrl.',
      );
    }

    const remoteConfig = createSoftbookRemoteSpaceStateConfig(
      spaceState.remote as SoftbookRemoteSpaceStateRuntimeConfig,
    );

    return {
      mode: 'remote',
      remoteConfig,
    };
  }

  return {
    mode: 'local',
  };
}

export function createSoftbookRemoteSpaceStateConfig(
  config: SoftbookRemoteSpaceStateRuntimeConfig,
): { endpoint: string; headers: Record<string, string> } {
  const baseUrl = trimTrailingSlash(config.baseUrl);

  return {
    endpoint: `${baseUrl}/v2/space/actions`,
    headers: {
      'x-softbook-client': 'mobile',
      ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
    },
  };
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
