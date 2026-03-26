import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import TimePicker from '@/components/ui/TimePicker';
import { Colors, Fonts, Typography } from '@/constants/theme';
import { useAppContext } from '@/context/AppContext';
import { useFont } from '@/context/FontContext';
import { createAlbum } from '@/utils/albums';

// ─── Step 1: Welcome ────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  const { fonts } = useFont();
  return (
    <View style={styles.stepContainer}>
      <View style={styles.centerContent}>
        <Text style={[styles.displayTitle, { fontFamily: fonts.light }]}>rewind</Text>
        <Text style={[styles.subtitle, { fontFamily: fonts.regular }]}>capture every day. watch yourself change.</Text>
      </View>
      <View style={styles.buttonGroup}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.85 }]}
          onPress={onNext}
          accessibilityLabel="Get started"
          accessibilityRole="button"
        >
          <Text style={[styles.primaryButtonText, { fontFamily: fonts.medium }]}>get started</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Step 2: Name album ─────────────────────────────────────────────────────

function StepNameAlbum({ onNext }: { onNext: (name: string) => void }) {
  const { fonts } = useFont();
  const [value, setValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  function handleContinue() {
    const trimmed = value.trim();
    onNext(trimmed || 'daily selfie');
  }

  return (
    <KeyboardAvoidingView
      style={styles.stepContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.centerContent}>
        <Text style={[styles.stepTitle, { fontFamily: fonts.light }]}>name your album</Text>
        <TextInput
          ref={inputRef}
          style={[styles.textInput, { fontFamily: fonts.regular }]}
          value={value}
          onChangeText={setValue}
          placeholder="daily selfie"
          placeholderTextColor={Colors.textTertiary}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleContinue}
          maxLength={50}
        />
        <Text style={[styles.hint, { fontFamily: fonts.regular }]}>you can create more albums later</Text>
      </View>
      <View style={styles.buttonGroup}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.85 }]}
          onPress={handleContinue}
          accessibilityLabel="Continue"
          accessibilityRole="button"
        >
          <Text style={[styles.primaryButtonText, { fontFamily: fonts.medium }]}>continue</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Step 3: Reminder ───────────────────────────────────────────────────────

function StepReminder({
  onEnable,
  onSkip,
}: {
  onEnable: (time: string) => void;
  onSkip: () => void;
}) {
  const { fonts } = useFont();
  const [time, setTime] = useState<string>('08:00');
  const [permissionGranted, setPermissionGranted] = useState(false);

  async function handleEnablePress() {
    if (!permissionGranted) {
      const { requestNotificationPermission } = await import('@/utils/notifications');
      const granted = await requestNotificationPermission();
      if (granted) {
        setPermissionGranted(true);
      } else {
        onSkip();
      }
      return;
    }
    onEnable(time);
  }

  return (
    <View style={styles.stepContainer}>
      <View style={styles.centerContent}>
        <Text style={[styles.stepTitle, { fontFamily: fonts.light }]}>daily reminder</Text>
        <Text style={[styles.subtitle, { fontFamily: fonts.regular }]}>
          {permissionGranted
            ? 'pick a time for your daily nudge'
            : "we'll nudge you to capture each day"}
        </Text>
        {permissionGranted && (
          <View style={styles.pickerWrapper}>
            <TimePicker
              value={time}
              onChange={setTime}
            />
          </View>
        )}
      </View>
      <View style={styles.buttonGroup}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.85 }]}
          onPress={handleEnablePress}
          accessibilityLabel={permissionGranted ? 'Set reminder' : 'Enable reminder'}
          accessibilityRole="button"
        >
          <Text style={[styles.primaryButtonText, { fontFamily: fonts.medium }]}>
            {permissionGranted ? 'set reminder' : 'enable reminder'}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.textButton, pressed && { opacity: 0.7 }]}
          onPress={onSkip}
          accessibilityLabel="Skip reminder setup"
          accessibilityRole="button"
        >
          <Text style={[styles.textButtonText, { fontFamily: fonts.regular }]}>skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── StepDots ────────────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i + 1 === current && styles.dotActive,
            i + 1 < current && styles.dotDone,
          ]}
        />
      ))}
    </View>
  );
}

// ─── OnboardingScreen ───────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { addAlbum, updateProfile } = useAppContext();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const albumNameRef = useRef<string>('daily selfie');

  function handleWelcomeNext() {
    setStep(2);
  }

  function handleNameNext(name: string) {
    albumNameRef.current = name;
    setStep(3);
  }

  function finalize(reminderEnabled: boolean, reminderTime: string) {
    const newAlbum = createAlbum(albumNameRef.current, { reminderEnabled, reminderTime });
    addAlbum(newAlbum);
    updateProfile({ joinDate: new Date().toISOString().split('T')[0] });
    router.replace({ pathname: '/(tabs)/camera', params: { albumId: newAlbum.id } });
  }

  function handleReminderEnable(time: string) {
    finalize(true, time);
  }

  function handleReminderSkip() {
    finalize(false, '08:00');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StepDots current={step} total={3} />
      {step === 1 && <StepWelcome onNext={handleWelcomeNext} />}
      {step === 2 && <StepNameAlbum onNext={handleNameNext} />}
      {step === 3 && <StepReminder onEnable={handleReminderEnable} onSkip={handleReminderSkip} />}
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 36,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 40,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  displayTitle: {
    ...Typography.displayTitle,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -2,
  },
  stepTitle: {
    fontFamily: Fonts.mono.light,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -1,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: Fonts.mono.regular,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  textInput: {
    fontFamily: Fonts.mono.regular,
    fontSize: 20,
    lineHeight: 28,
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderPrimary,
    paddingVertical: 10,
    paddingHorizontal: 0,
    marginTop: 8,
  },
  hint: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  pickerWrapper: {
    marginTop: 16,
    alignItems: 'center',
  },
  buttonGroup: {
    gap: 12,
    paddingTop: 24,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: Fonts.mono.medium,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.bgPage,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.borderPrimary,
  },
  dotActive: {
    backgroundColor: Colors.accent,
    width: 20,
  },
  dotDone: {
    backgroundColor: Colors.textTertiary,
  },
  textButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  textButtonText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
});
