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
      mode?: 'remote';
      track?: LearningTrack;
    };
  }
}

export function resolveWebRuntime(): WebRuntime {
  const configured = window.__SOFTBOOK_WEB_RUNTIME__;
  const track = configured?.track ?? 'cet4';

  if (configured?.mode === 'remote' && isHttpsUrl(configured.baseUrl)) {
    return {
      baseUrl: configured.baseUrl as string,
      clientIdentity: WEB_CLIENT_IDENTITY,
      clientKind: WEB_CLIENT_KIND,
      mode: 'remote',
      track,
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

function isHttpsUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}
