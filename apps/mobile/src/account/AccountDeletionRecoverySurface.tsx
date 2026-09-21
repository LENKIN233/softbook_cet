import React, { useEffect } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSmsResendRemainingSeconds } from '../auth/smsResend';

type RecoveryPalette = {
  accent: string;
  border: string;
  panel: string;
  panelStrong: string;
  primaryActionText: string;
  text: string;
  textMuted: string;
  warning: string;
};

export function AccountDeletionRecoverySurface({
  accepted,
  busy,
  error,
  hasChallenge,
  onChangeCode,
  onRequestCode,
  onRetryLoad,
  onVerifyCode,
  palette,
  phoneNumber,
  resendAvailableAt,
  smsCode,
}: {
  accepted: boolean;
  busy: 'checking' | 'request_code' | 'verify_code' | null;
  error: string | null;
  hasChallenge: boolean;
  onChangeCode: (code: string) => void;
  onRequestCode: () => void;
  onRetryLoad: () => void;
  onVerifyCode: () => void;
  palette: RecoveryPalette;
  phoneNumber: string | null;
  resendAvailableAt: number;
  smsCode: string;
}) {
  const remaining = useSmsResendRemainingSeconds(resendAvailableAt);
  const title =
    phoneNumber === null
      ? busy === 'checking'
        ? '正在检查账号状态'
        : '暂时无法加载账号信息'
      : accepted
      ? '注销仍在处理中'
      : '查询注销进度';
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(error ?? title);
  }, [error, title]);
  const canRequest = busy === null && remaining === 0;
  const canVerify = busy === null && /^\d{6}$/.test(smsCode);
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID="account-deletion-recovery-screen"
    >
      <View
        style={[
          styles.card,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.eyebrow, { color: palette.accent }]}>
          账号状态
        </Text>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: palette.text }]}
        >
          {title}
        </Text>
        <Text style={[styles.copy, { color: palette.textMuted }]}>
          {phoneNumber === null
            ? '暂时无法确认账号状态，请稍后重试登录。'
            : accepted
            ? '注销申请已收到，暂时不能登录。验证手机号后可查询进度。'
            : '还没收到注销结果，请验证手机号后查询。'}
        </Text>
        {phoneNumber !== null ? (
          <>
            <Text
              style={[styles.phone, { color: palette.text }]}
            >{`${phoneNumber.slice(0, 3)}****${phoneNumber.slice(-4)}`}</Text>
            <Text style={[styles.copy, { color: palette.textMuted }]}>
              此验证码仅用于查询注销进度，不会登录账号。
            </Text>
            {hasChallenge ? (
              <>
                <TextInput
                  accessibilityLabel="查询验证码"
                  editable={busy === null}
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={onChangeCode}
                  placeholder="输入 6 位验证码"
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.panelStrong,
                      color: palette.text,
                    },
                  ]}
                  testID="account-deletion-recovery-code-input"
                  textContentType="oneTimeCode"
                  value={smsCode}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={!canVerify}
                  onPress={onVerifyCode}
                  style={[
                    styles.button,
                    {
                      backgroundColor: canVerify
                        ? palette.accent
                        : palette.panelStrong,
                    },
                  ]}
                  testID="account-deletion-recovery-verify-button"
                >
                  <Text
                    style={[
                      styles.buttonText,
                      {
                        color: canVerify
                          ? palette.primaryActionText
                          : palette.textMuted,
                      },
                    ]}
                  >
                    {busy === 'verify_code' ? '正在查询' : '查询注销进度'}
                  </Text>
                </Pressable>
              </>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={!canRequest}
              onPress={onRequestCode}
              style={[
                styles.button,
                {
                  backgroundColor:
                    hasChallenge || !canRequest
                      ? palette.panelStrong
                      : palette.accent,
                },
              ]}
              testID="account-deletion-recovery-request-button"
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    color:
                      hasChallenge || !canRequest
                        ? palette.text
                        : palette.primaryActionText,
                  },
                ]}
              >
                {busy === 'request_code'
                  ? '正在发送验证码'
                  : remaining > 0
                  ? `${remaining} 秒后可重发`
                  : hasChallenge
                  ? '重新获取验证码'
                  : '获取验证码'}
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={busy !== null}
            onPress={onRetryLoad}
            style={[styles.button, { backgroundColor: palette.accent }]}
            testID="account-deletion-recovery-retry-button"
          >
            <Text
              style={[styles.buttonText, { color: palette.primaryActionText }]}
            >
              {busy === 'checking' ? '正在读取' : '重试'}
            </Text>
          </Pressable>
        )}
        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.copy, { color: palette.text }]}
            testID="account-deletion-recovery-error"
          >
            {error}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  card: { borderRadius: 28, borderWidth: 1, gap: 14, padding: 22 },
  eyebrow: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 25, lineHeight: 33, fontWeight: '800' },
  copy: { fontSize: 15, lineHeight: 23 },
  phone: {
    fontSize: 20,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  input: {
    borderRadius: 16,
    minHeight: 52,
    paddingHorizontal: 16,
    fontSize: 19,
  },
  button: {
    alignItems: 'center',
    borderRadius: 24,
    justifyContent: 'center',
    minHeight: 48,
    padding: 12,
  },
  buttonText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
});
