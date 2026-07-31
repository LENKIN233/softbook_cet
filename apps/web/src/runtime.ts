import type {LearningTrack} from '../../mobile/src/learning/model';

export type WebRuntime =
  | {
      mode: 'development';
      track: LearningTrack;
    }
  | {
      mode: 'remote';
      baseUrl: string;
      track: LearningTrack;
    }
  | {
      mode: 'unavailable';
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
    return {baseUrl: configured.baseUrl as string, mode: 'remote', track};
  }

  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    return {mode: 'development', track};
  }

  return {
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
