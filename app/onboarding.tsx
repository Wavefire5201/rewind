import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Fonts, Typography } from '@/constants/theme';
import { useAppContext } from '@/context/AppContext';
import { createAlbum } from '@/utils/albums';

function makeDefaultTime(): Date {
  const d = new Date();
  d.setHours(8, 0, 0, 0);
  return d;
}

function dateToTimeString(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ─── Step 1: Welcome ────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.centerContent}>
        <Text style={styles.displayTitle}>rewind</Text>
        <Text style={styles.subtitle}>capture every day. watch yourself change.</Text>
      </View>
      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={onNext}>
          <Text style={styles.primaryButtonText}>get started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Step 2: Name album ─────────────────────────────────────────────────────

function StepNameAlbum({ onNext }: { onNext: (name: string) => void }) {
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
        <Text style={styles.stepTitle}>name your album</Text>
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          value={value}
          onChangeText={setValue}
          placeholder="daily selfie"
          placeholderTextColor={Colors.textTertiary}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleContinue}
        />
        <Text style={styles.hint}>you can create more albums later</Text>
      </View>
      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={handleContinue}
        >
          <Text style={styles.primaryButtonText}>continue</Text>
        </TouchableOpacity>
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
  const [time, setTime] = useState<Date>(makeDefaultTime());
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
    onEnable(dateToTimeString(time));
  }

  return (
    <View style={styles.stepContainer}>
      <View style={styles.centerContent}>
        <Text style={styles.stepTitle}>daily reminder</Text>
        <Text style={styles.subtitle}>
          {permissionGranted
            ? 'pick a time for your daily nudge'
            : "we'll nudge you to capture each day"}
        </Text>
        {permissionGranted && (
          <View style={styles.pickerWrapper}>
            <DateTimePicker
              value={time}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_e, selected) => {
                if (selected) setTime(selected);
              }}
              themeVariant="dark"
            />
          </View>
        )}
      </View>
      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={handleEnablePress}
        >
          <Text style={styles.primaryButtonText}>
            {permissionGranted ? 'set reminder' : 'enable reminder'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.textButton} activeOpacity={0.7} onPress={onSkip}>
          <Text style={styles.textButtonText}>skip</Text>
        </TouchableOpacity>
      </View>
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
    router.replace({ pathname: '/album/[id]', params: { id: newAlbum.id } });
  }

  function handleReminderEnable(time: string) {
    finalize(true, time);
  }

  function handleReminderSkip() {
    finalize(false, '08:00');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
