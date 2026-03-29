import React, { useState, useCallback, useEffect } from 'react';
import { Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

  const handleReset = useCallback(() => {
    setStep('enter');
    setFirstPin('');
    setError('');
  }, []);

  const handleSetupComplete = useCallback(async (pin: string) => {
    if (step === 'enter') {
      setFirstPin(pin);
      setStep('confirm');
      setError('');
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
      }
    }
  }, [step, firstPin, onSuccess, handleReset]);

  const handleVerifyComplete = useCallback(async (pin: string) => {
    const correct = await verifyPin(pin);
    if (correct) {
      haptics.success();
      handleReset();
      onSuccess();
    } else {
      haptics.error();
      setError('wrong passcode, try again');
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
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <PinEntry
          title={title}
          subtitle={subtitle}
          error={error}
          onComplete={mode === 'setup' ? handleSetupComplete : handleVerifyComplete}
          onCancel={handleCancel}
        />
      </SafeAreaView>
    </Modal>
  );
}
