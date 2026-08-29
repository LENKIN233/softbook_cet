import {
  assertRemoteRuntimeUsesRemoteAuth,
  readSoftbookAppRuntimeConfig,
  type SoftbookAppRuntimeConfig,
} from '../learning/learningRuntimeConfig';
import {
  readInstalledClientIdentity,
} from '../runtime/installedClientVersion';
import type {InstalledClientIdentityProvider} from '../runtime/clientVersion';
import {
  resolveSoftbookClientKind,
  type SoftbookClientKind,
} from '../runtime/remoteClient';
import { createPinnedContentManifestSignatureVerifier } from './contentManifestSignature';
import type { ContentManifestSignatureVerifier } from './contentManifestRepository';

export type ResolvedContentManifestRuntimeConfig =
  | { mode: 'local' }
  | {
      mode: 'remote';
      remote: {
        apiKey?: string;
        baseUrl: string;
        clientKind: SoftbookClientKind;
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
      clientKind: resolveSoftbookClientKind(runtimeConfig?.clientKind),
      installedClientIdentityProvider: readInstalledClientIdentity,
      verifySignature: createPinnedContentManifestSignatureVerifier(
        remote.publicKeys,
      ),
    },
  };
}
