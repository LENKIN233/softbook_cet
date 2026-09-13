import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export const DEFAULT_SMS_RESEND_SECONDS = 120;

export function smsResendRemainingSeconds(
  availableAt: number,
  now = Date.now(),
) {
  return Math.max(0, Math.ceil((availableAt - now) / 1000));
}

// Only the small authentication control ticks. Account/learning state is not
// rehydrated on each countdown update, and foreground entry uses the real time.
export function useSmsResendRemainingSeconds(availableAt: number) {
  const [remaining, setRemaining] = useState(() =>
    smsResendRemainingSeconds(availableAt),
  );
  useEffect(() => {
    const update = () => {
      const next = smsResendRemainingSeconds(availableAt);
      setRemaining(next);
      if (next === 0) clearInterval(timer);
    };
    const timer = setInterval(update, 250);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') update();
    });
    update();
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [availableAt]);
  return remaining;
}
