const REMOTE_STATUS_ERROR_PATTERN =
  /^Remote (auth request-code|auth verify-code|learning card source request|membership entitlement request|membership mutation|progress sync|learning state sync|space state sync) failed(?: with status| with)? (\d+)\.$/;

function getKnownRemoteErrorCopy(type: string): string | null {
  switch (type) {
    case 'auth request-code':
      return '验证码发送失败，请重试。';
    case 'auth verify-code':
      return '验证码验证失败，请重试。';
    case 'learning card source request':
      return '卡片加载失败，请重试。';
    case 'learning state sync':
      return '学习记录暂时没有更新。';
    case 'membership entitlement request':
      return '会员状态暂时无法读取。';
    case 'membership mutation':
      return '会员状态更新暂时失败。';
    case 'progress sync':
      return '今日进度更新失败，请重试。';
    case 'space state sync':
      return '卡片位置暂时没有更新。';
    default:
      return null;
  }
}

/**
 * Converts untrusted runtime exceptions into copy that is safe to render.
 * Caller-owned fallback copy is trusted; exception messages are fail-closed.
 */
export function getUserFacingErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (findClientUpdateRequiredError(error)) {
    return '请更新到最新版本，更新后可继续学习。';
  }
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  const remoteStatusMatch = message.match(REMOTE_STATUS_ERROR_PATTERN);

  if (remoteStatusMatch) {
    return getKnownRemoteErrorCopy(remoteStatusMatch[1]) ?? fallback;
  }

  // Exception text is never user copy. A language/length/blacklist heuristic
  // cannot distinguish a safe sentence from leaked prompts, storage content,
  // native diagnostics, or attacker-controlled text. Only explicit mappings
  // above may cross this rendering boundary.
  return fallback;
}
import {findClientUpdateRequiredError} from './clientVersion';
