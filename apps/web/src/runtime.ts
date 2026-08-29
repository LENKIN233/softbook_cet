import type {LearningTrack} from '../../mobile/src/learning/model';
import {
  createWebBuildClientIdentity,
  type WebBuildClientIdentity,
} from '../../mobile/src/runtime/clientVersion';
import type {SoftbookClientKind} from '../../mobile/src/runtime/remoteClient';
import webPackage from '../package.json';

const WEB_CLIENT_KIND = 'web' satisfies SoftbookClientKind;
const WEB_CLIENT_IDENTITY = createWebBuildClientIdentity(webPackage.version);

export type WebRuntime =
  | {
      mode: 'development';
      clientKind: 'web';
      track: LearningTrack;
    }
  | {
      mode: 'remote';
      baseUrl: string;
      clientIdentity: WebBuildClientIdentity;
      clientKind: 'web';
      contentManifestPublicKeys: Readonly<Record<string, string>>;
      track: LearningTrack;
    }
  | {
      mode: 'unavailable';
      clientKind: 'web';
      reason: string;
      track: LearningTrack;
    };

declare global {
  interface Window {
    __SOFTBOOK_WEB_RUNTIME__?: {
      baseUrl?: string;
      clientKind?: 'web';
      contentManifestPublicKeys?: Readonly<Record<string, string>>;
      mode?: 'remote';
      track?: LearningTrack;
    };
  }
}

export function resolveWebRuntime(): WebRuntime {
  try {
    return resolveWebRuntimeUnchecked();
  } catch {
    return {
      clientKind: WEB_CLIENT_KIND,
      mode: 'unavailable',
      reason: '服务配置尚未完整，请稍后再试。',
      track: 'cet4',
    };
  }
}

function resolveWebRuntimeUnchecked(): WebRuntime {
  const configured = window.__SOFTBOOK_WEB_RUNTIME__;
  const track = isLearningTrack(configured?.track) ? configured.track : 'cet4';

  if (configured?.mode === 'remote') {
    if (!isCompleteRemoteRuntime(configured)) {
      return {
        clientKind: WEB_CLIENT_KIND,
        mode: 'unavailable',
        reason: '服务配置尚未完整，请稍后再试。',
        track,
      };
    }
    return {
      baseUrl: configured.baseUrl as string,
      clientIdentity: WEB_CLIENT_IDENTITY,
      clientKind: WEB_CLIENT_KIND,
      contentManifestPublicKeys: configured.contentManifestPublicKeys,
      mode: 'remote',
      track: configured.track,
    };
  }

  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    return {clientKind: WEB_CLIENT_KIND, mode: 'development', track};
  }

  return {
    clientKind: WEB_CLIENT_KIND,
    mode: 'unavailable',
    reason: '服务正在完成上线配置，请稍后再试。',
    track,
  };
}

function isCompleteRemoteRuntime(
  value: NonNullable<Window['__SOFTBOOK_WEB_RUNTIME__']>,
): value is {
  baseUrl: string;
  clientKind: 'web';
  contentManifestPublicKeys: Readonly<Record<string, string>>;
  mode: 'remote';
  track: LearningTrack;
} {
  const keys = Object.keys(value).sort();
  const expectedKeys = [
    'baseUrl',
    'clientKind',
    'contentManifestPublicKeys',
    'mode',
    'track',
  ];
  return (
    keys.length === expectedKeys.length &&
    keys.every((key, index) => key === expectedKeys[index]) &&
    value.mode === 'remote' &&
    value.clientKind === 'web' &&
    isLearningTrack(value.track) &&
    isHttpsUrl(value.baseUrl) &&
    isPublicKeyring(value.contentManifestPublicKeys)
  );
}

function isLearningTrack(value: unknown): value is LearningTrack {
  return value === 'cet4' || value === 'cet6';
}

function isPublicKeyring(
  value: unknown,
): value is Readonly<Record<string, string>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    entries.every(
      ([keyId, publicKey]) =>
        /^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/.test(keyId) &&
        typeof publicKey === 'string' &&
        /^[a-f0-9]{64}$/.test(publicKey),
    )
  );
}

function isHttpsUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.search === '' &&
      url.hash === '' &&
      hostname !== 'localhost' &&
      !hostname.endsWith('.localhost') &&
      !hostname.endsWith('.invalid') &&
      hostname !== '0.0.0.0' &&
      hostname !== '[::1]' &&
      !/^127(?:\.\d{1,3}){3}$/.test(hostname)
    );
  } catch {
    return false;
  }
}
