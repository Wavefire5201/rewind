import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView } from 'react-native';
import BottomSheet from '@/components/ui/BottomSheet';
import { Colors, Fonts, Pressed } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';

interface TextInputModalProps {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  maxLength?: number;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/** A one-field question (rename, new album) as a bottom sheet that rises with the keyboard. */
export default function TextInputModal({
  visible,
  title,
  message,
  placeholder = '',
  defaultValue = '',
  confirmLabel = 'confirm',
  maxLength = 100,
  onConfirm,
  onCancel,
}: TextInputModalProps) {
  const { fonts } = useFont();
  const [value, setValue] = useState(defaultValue);
  const [showEmptyError, setShowEmptyError] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue(defaultValue);
      setShowEmptyError(false);
    }
  }, [visible, defaultValue]);

  function cancel() {
    haptics.tap();
    onCancel();
  }

  function handleConfirm() {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setShowEmptyError(true);
      haptics.error();
      return;
    }
    setShowEmptyError(false);
    // No haptic here: every caller plays the one for the outcome (success).
    onConfirm(trimmed);
  }

  return (
    // Scrim, drag and back cancel; the sheet's scrim tap already plays the tap.
    <BottomSheet visible={visible} onClose={onCancel}>
      {/* Pads itself by the keyboard's height, so the field and buttons stay above it. */}
      <KeyboardAvoidingView behavior="padding" style={styles.body}>
        <Text style={[styles.title, { fontFamily: fonts.medium }]}>{title}</Text>
        {message ? <Text style={[styles.message, { fontFamily: fonts.regular }]}>{message}</Text> : null}
        <TextInput
          style={[styles.input, { fontFamily: fonts.regular }]}
          value={value}
          onChangeText={(v) => { setValue(v); if (showEmptyError) setShowEmptyError(false); }}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleConfirm}
          maxLength={maxLength}
          accessibilityLabel={placeholder || title}
        />
        {showEmptyError ? (
          <Text style={[styles.errorHint, { fontFamily: fonts.regular }]}>{"name can't be empty"}</Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.button, styles.primary, pressed && { opacity: Pressed.filled }]}
            onPress={handleConfirm}
            accessibilityLabel={confirmLabel}
            accessibilityRole="button"
          >
            <Text style={[styles.primaryText, { fontFamily: fonts.medium }]}>{confirmLabel}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.button, styles.cancel, pressed && { opacity: Pressed.text }]}
            onPress={cancel}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
          >
            <Text style={[styles.cancelText, { fontFamily: fonts.regular }]}>cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop: 4,
  },
  title: {
    fontFamily: Fonts.mono.medium,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
  message: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  input: {
    fontFamily: Fonts.mono.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderPrimary,
    paddingVertical: 8,
    marginTop: 16,
  },
  errorHint: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    color: Colors.danger,
    marginTop: 8,
  },
  actions: {
    gap: 8,
    marginTop: 20,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primary: {
    backgroundColor: Colors.accent,
  },
  primaryText: {
    fontFamily: Fonts.mono.medium,
    fontSize: 12,
    letterSpacing: 1,
    color: Colors.bgPage,
  },
  cancel: {
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
  },
  cancelText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    letterSpacing: 1,
    color: Colors.textPrimary,
  },
});
