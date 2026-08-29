import type { SoftbookAppRuntimeConfig } from '../learning/learningRuntimeConfig';
import { assertRemoteRuntimeUsesRemoteAuth } from '../learning/learningRuntimeConfig';
import type { SpaceStateRepositoryConfig } from './spaceStateRepository';
import {
  createSoftbookClientHeaders,
  resolveSoftbookClientKind,
  type SoftbookClientKind,
} from '../runtime/remoteClient';

export type SoftbookRemoteSpaceStateRuntimeConfig = {
  apiKey?: string;
  baseUrl: string;
  clientKind?: SoftbookClientKind;
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
      {
        ...(spaceState.remote as SoftbookRemoteSpaceStateRuntimeConfig),
        clientKind: runtimeConfig?.clientKind,
      },
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
): {
  clientKind: SoftbookClientKind;
  endpoint: string;
  headers: Record<string, string>;
} {
  const baseUrl = trimTrailingSlash(config.baseUrl);

  return {
    clientKind: resolveSoftbookClientKind(config.clientKind),
    endpoint: `${baseUrl}/v2/space/actions`,
    headers: {
      ...createSoftbookClientHeaders(config.clientKind),
      ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
    },
  };
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
