const REMOTE_STATUS_ERROR_PATTERN =
  /^Remote (auth request-code|auth verify-code|learning card source request|membership entitlement request|membership mutation|progress sync|learning state sync|space state sync) failed(?: with status| with)? (\d+)\.$/;

const UNSAFE_USER_COPY_PATTERN =
  /[A-Za-z]{2,}|https?:|file:|\/|\\|@|\b[1-5]\d{2}\b|数据库|云函数|密钥|令牌|模块|堆栈|调用栈|原生|内部|卡源|队列|缓存|接口|状态码|响应体|配置|文件路径|运行时|开发环境|测试环境|调试/i;

const HAN_CHARACTER_PATTERN = /[\u3400-\u9fff]/;
const MAX_USER_COPY_LENGTH = 120;

function hasUnsafeUnicodeControl(message: string): boolean {
  return Array.from(message).some(character => {
    const codePoint = character.codePointAt(0) ?? 0;

    return (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      (codePoint >= 0x202a && codePoint <= 0x202e) ||
      (codePoint >= 0x2066 && codePoint <= 0x2069)
    );
  });
}

function getKnownRemoteErrorCopy(type: string): string | null {
  switch (type) {
    case 'auth request-code':
      return '验证码暂时没发出。';
    case 'auth verify-code':
      return '验证码暂时没通过。';
    case 'learning card source request':
      return '学习卡片加载暂时失败。';
    case 'learning state sync':
      return '学习记录暂时没有更新。';
    case 'membership entitlement request':
      return '会员状态暂时无法读取。';
    case 'membership mutation':
      return '会员状态更新暂时失败。';
    case 'progress sync':
      return '今天的进展暂时没有更新。';
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
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  const remoteStatusMatch = message.match(REMOTE_STATUS_ERROR_PATTERN);

  if (remoteStatusMatch) {
    return getKnownRemoteErrorCopy(remoteStatusMatch[1]) ?? fallback;
  }

  if (
    message.length === 0 ||
    message.length > MAX_USER_COPY_LENGTH ||
    !HAN_CHARACTER_PATTERN.test(message) ||
    hasUnsafeUnicodeControl(message) ||
    UNSAFE_USER_COPY_PATTERN.test(message)
  ) {
    return fallback;
  }

  return message;
}
