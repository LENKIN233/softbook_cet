import {RemoteHttpError} from '../runtime/remoteHttpError';
import {RemoteRequestLifecycleError} from '../runtime/remoteRequest';

export type AuthFailureKind = 'invalid_code' | 'expired_code' | 'throttled' | 'network' | 'service' | 'unknown';
export function authFailure(error: unknown): {kind: AuthFailureKind; message: string} {
  if (error instanceof RemoteHttpError) {
    if (error.code === 'invalid_sms_code' || error.code === 'invalid_sms_code_format') {
      return {kind: 'invalid_code', message: '验证码不正确，请检查后重试。'};
    }
    if (error.code === 'expired_sms_challenge' || error.code === 'sms_challenge_consumed') {
      return {kind: 'expired_code', message: '验证码已失效，请重新获取。'};
    }
    if (error.status === 429 || error.code === 'sms_challenge_locked') {
      return {kind: 'throttled', message: '操作太频繁，请稍后重试。'};
    }
    if (error.status >= 500) return {kind: 'service', message: '登录服务暂不可用，请稍后重试。'};
  }
  if ((error instanceof RemoteRequestLifecycleError && error.reason === 'timeout') || error instanceof TypeError) {
    return {kind: 'network', message: '连接失败，请检查网络后重试。'};
  }
  return {kind: 'unknown', message: '登录未完成，请重试。'};
}
