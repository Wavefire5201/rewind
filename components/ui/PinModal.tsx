import React, { useState, useCallback, useEffect } from 'react';
import { Modal } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import PinEntry from '@/components/ui/PinEntry';
import { hasPin, savePin, verifyPin } from '@/utils/pin';
import { haptics } from '@/utils/haptics';

type PinMode = 'setup' | 'verify';

interface PinModalProps {
  visible: boolean;
  mode: PinMode;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PinModal({ visible, mode: requestedMode, onSuccess, onCancel }: PinModalProps) {
  // Auto-detect: if verify requested but no PIN exists, switch to setup
  const [mode, setMode] = useState<PinMode>(requestedMode);

  useEffect(() => {
    if (visible) {
      if (requestedMode === 'verify') {
        hasPin().then(exists => setMode(exists ? 'verify' : 'setup'));
      } else {
        setMode(requestedMode);
      }
    }
  }, [visible, requestedMode]);

  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [resetKey, setResetKey] = useState(0);

  const handleReset = useCallback(() => {
    setStep('enter');
    setFirstPin('');
    setError('');
    setResetKey(k => k + 1);
  }, []);

  // Reset all state when modal becomes visible
  useEffect(() => {
    if (visible) {
      handleReset();
    }
  }, [visible]);

  const handleSetupComplete = useCallback(async (pin: string) => {
    if (step === 'enter') {
      setFirstPin(pin);
      setStep('confirm');
      setError('');
      setResetKey(k => k + 1);
    } else {
      if (pin === firstPin) {
        await savePin(pin);
        haptics.success();
        handleReset();
        onSuccess();
      } else {
        haptics.error();
        setError("passcodes don't match");
        setStep('enter');
        setFirstPin('');
        setResetKey(k => k + 1);
      }
    }
  }, [step, firstPin, onSuccess, handleReset]);

  const handleVerifyComplete = useCallback(async (pin: string) => {
    const result = await verifyPin(pin);
    if (result.success) {
      haptics.success();
      handleReset();
      onSuccess();
    } else if (result.locked) {
      haptics.error();
      setError('too many attempts, try again later');
      setResetKey(k => k + 1);
    } else {
      haptics.error();
      const remaining = result.remainingAttempts ?? 0;
      setError(`wrong passcode (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`);
      setResetKey(k => k + 1);
    }
  }, [onSuccess, handleReset]);

  const handleCancel = useCallback(() => {
    handleReset();
    onCancel();
  }, [onCancel, handleReset]);

  const title = mode === 'setup'
    ? (step === 'enter' ? 'set passcode' : 'confirm passcode')
    : 'enter passcode';

  const subtitle = mode === 'setup' && step === 'enter'
    ? 'choose a 4-digit passcode'
    : undefined;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaProvider style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgPage }} edges={['top', 'bottom']}>
          <PinEntry
            title={title}
            subtitle={subtitle}
            error={error}
            onComplete={mode === 'setup' ? handleSetupComplete : handleVerifyComplete}
            onCancel={handleCancel}
            resetKey={resetKey}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
