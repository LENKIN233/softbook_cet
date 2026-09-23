import {authFailure} from '../src/auth/authErrorCopy';
import {RemoteHttpError} from '../src/runtime/remoteHttpError';
import {RemoteRequestLifecycleError} from '../src/runtime/remoteRequest';

test.each([
  [new TypeError('Failed to fetch'), 'network'],
  [new RemoteRequestLifecycleError('timeout'), 'network'],
  [new RemoteHttpError('private server detail', 503), 'service'],
  [new RemoteHttpError('private server detail', 429), 'throttled'],
  [new RemoteHttpError('private server detail', 401, 'expired_sms_challenge'), 'expired_code'],
  [new RemoteHttpError('private server detail', 401), 'unknown'],
  [new Error('JSON Parse error'), 'unknown'],
])('does not blame the entered code for a transport, service or unknown failure: %s', (error, kind) => {
  const failure = authFailure(error);
  expect(failure.kind).toBe(kind);
  expect(failure.message).not.toMatch(/验证码不正确|private|JSON/);
});

test('only a specific rejected-code response asks the user to correct the code', () => {
  expect(authFailure(new RemoteHttpError('private', 401, 'invalid_sms_code'))).toEqual({
    kind: 'invalid_code', message: '验证码不正确，请检查后重试。',
  });
});
