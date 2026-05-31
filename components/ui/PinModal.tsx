import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Modal } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import PinEntry from '@/components/ui/PinEntry';
import { hasPin, savePin, verifyPin, getAttemptInfo } from '@/utils/pin';
import { haptics } from '@/utils/haptics';

/**
 * intent controls what the modal does:
 *   'unlock'  — verify the existing PIN to unlock something; if no PIN data exists, auto-clear
 *               isLocked on the caller's side (onNoPinFound) rather than silently switching to setup
 *   'set'     — set a brand-new PIN (no prior verify step)
 *   'change'  — verify old PIN, then set new PIN (two-phase)
 */
export type PinIntent = 'unlock' | 'set' | 'change';

interface PinModalProps {
  visible: boolean;
  intent: PinIntent;
  onSuccess: () => void;
  onCancel: () => void;
  /** Called when intent==='unlock' but no PIN data exists in storage. */
  onNoPinFound?: () => void;
}

type InternalStep = 'verify' | 'enter-new' | 'confirm-new' | 'no-pin';

export default function PinModal({ visible, intent, onSuccess, onCancel, onNoPinFound }: PinModalProps) {
  const [step, setStep] = useState<InternalStep>('verify');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  const handleReset = useCallback(() => {
    setStep(intent === 'set' ? 'enter-new' : 'verify');
    setFirstPin('');
    setError('');
    setResetKey(k => k + 1);
    setLockoutSeconds(0);
    clearTimer();
  }, [intent]);

  // When modal becomes visible, initialise step and check for missing PIN on unlock
  useEffect(() => {
    if (!visible) {
      clearTimer();
      return;
    }

    handleReset();

    if (intent === 'unlock') {
      hasPin().then(exists => {
        if (!exists) {
          // No PIN data — show notice instead of silently prompting setup
          setStep('no-pin');
        }
      });
    }
  }, [visible, intent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lockout countdown
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    timerRef.current = setInterval(() => {
      setLockoutSeconds(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearTimer();
          setError('');
          setResetKey(k => k + 1);
          return 0;
        }
        setError(`too many attempts — try again in ${next}s`);
        return next;
      });
    }, 1000);
    return clearTimer;
  }, [lockoutSeconds]);

  const handleSetupComplete = useCallback(async (pin: string) => {
    if (step === 'enter-new') {
      setFirstPin(pin);
      setStep('confirm-new');
      setError('');
      setResetKey(k => k + 1);
    } else {
      // confirm-new
      if (pin === firstPin) {
        await savePin(pin);
        haptics.success();
        handleReset();
        onSuccess();
      } else {
        haptics.error();
        setError("passcodes don't match");
        setStep('enter-new');
        setFirstPin('');
        setResetKey(k => k + 1);
      }
    }
  }, [step, firstPin, onSuccess, handleReset]);

  const handleVerifyComplete = useCallback(async (pin: string) => {
    const result = await verifyPin(pin);
    if (result.success) {
      haptics.success();
      if (intent === 'change') {
        // Advance to new-PIN entry
        setStep('enter-new');
        setError('');
        setResetKey(k => k + 1);
      } else {
        handleReset();
        onSuccess();
      }
    } else if (result.locked) {
      haptics.error();
      // Surface the countdown
      const info = await getAttemptInfo();
      const secsRemaining = info.lockoutUntil
        ? Math.max(0, Math.ceil((info.lockoutUntil - Date.now()) / 1000))
        : 30;
      setError(`too many attempts — try again in ${secsRemaining}s`);
      setLockoutSeconds(secsRemaining);
      setResetKey(k => k + 1);
    } else {
      haptics.error();
      const remaining = result.remainingAttempts ?? 0;
      setError(`wrong passcode (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`);
      setResetKey(k => k + 1);
    }
  }, [intent, onSuccess, handleReset]);

  const handleCancel = useCallback(() => {
    handleReset();
    onCancel();
  }, [onCancel, handleReset]);

  // "no-pin" screen — shown when unlock is attempted but PIN data is gone
  if (step === 'no-pin') {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaProvider style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgPage }} edges={['top', 'bottom']}>
            <PinEntry
              title="passcode unavailable"
              subtitle="The passcode data was cleared. This album will be unlocked."
              error=""
              onComplete={() => {
                // This shouldn't be called in no-pin state, but guard anyway
              }}
              onCancel={() => {
                handleReset();
                onNoPinFound?.();
                onCancel();
              }}
              resetKey={resetKey}
              disableKeypad
              cancelLabel="continue"
            />
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    );
  }

  const isSetupStep = step === 'enter-new' || step === 'confirm-new';

  let title: string;
  if (step === 'verify') {
    title = intent === 'change' ? 'enter current passcode' : 'enter passcode';
  } else if (step === 'enter-new') {
    title = 'set new passcode';
  } else {
    title = 'confirm passcode';
  }

  const subtitle = step === 'enter-new' ? 'choose a 4-digit passcode' : undefined;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaProvider style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgPage }} edges={['top', 'bottom']}>
          <PinEntry
            title={title}
            subtitle={subtitle}
            error={error}
            onComplete={isSetupStep ? handleSetupComplete : handleVerifyComplete}
            onCancel={handleCancel}
            resetKey={resetKey}
            disableKeypad={lockoutSeconds > 0}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
