import {
  assertRemoteRuntimeUsesRemoteAuth,
  readSoftbookAppRuntimeConfig,
  type SoftbookAppRuntimeConfig,
} from '../learning/learningRuntimeConfig';
import {
  readInstalledClientIdentity,
  type InstalledClientIdentityProvider,
} from '../runtime/installedClientVersion';
import { createPinnedContentManifestSignatureVerifier } from './contentManifestSignature';
import type { ContentManifestSignatureVerifier } from './contentManifestRepository';

export type ResolvedContentManifestRuntimeConfig =
  | { mode: 'local' }
  | {
      mode: 'remote';
      remote: {
        apiKey?: string;
        baseUrl: string;
        installedClientIdentityProvider: InstalledClientIdentityProvider;
        verifySignature: ContentManifestSignatureVerifier;
      };
    };

export function resolveContentManifestRuntimeConfig(
  runtimeConfig:
    | SoftbookAppRuntimeConfig
    | undefined = readSoftbookAppRuntimeConfig(),
): ResolvedContentManifestRuntimeConfig {
  const contentManifest = runtimeConfig?.contentManifest;
  const mode = contentManifest?.mode ?? 'local';

  if (mode === 'local') {
    return { mode: 'local' };
  }

  assertRemoteRuntimeUsesRemoteAuth(runtimeConfig, 'contentManifest');
  const remote = contentManifest?.remote;

  if (!remote?.baseUrl) {
    throw new Error(
      'Remote content manifest mode requires contentManifest.remote.baseUrl.',
    );
  }

  return {
    mode: 'remote',
    remote: {
      ...(remote.apiKey ? { apiKey: remote.apiKey } : {}),
      baseUrl: remote.baseUrl,
      installedClientIdentityProvider: readInstalledClientIdentity,
      verifySignature: createPinnedContentManifestSignatureVerifier(
        remote.publicKeys,
      ),
    },
  };
}
