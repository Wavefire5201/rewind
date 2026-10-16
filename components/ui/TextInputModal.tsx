import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
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
    haptics.tap();
    onConfirm(trimmed);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel} accessible={false} />
        <View style={styles.card}>
          <Text style={[styles.title, { fontFamily: fonts.regular }]}>{title}</Text>
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
          <View style={styles.row}>
            <Pressable
              style={styles.btn}
              onPress={cancel}
              accessibilityLabel="Cancel"
              accessibilityRole="button"
            >
              <Text style={[styles.cancelLabel, { fontFamily: fonts.regular }]}>cancel</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={handleConfirm}
              accessibilityLabel={confirmLabel}
              accessibilityRole="button"
            >
              <Text style={[styles.confirmLabel, { fontFamily: fonts.regular }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 300,
    backgroundColor: Colors.bgCard,
    padding: 24,
    gap: 16,
  },
  title: {
    fontFamily: Fonts.mono.regular,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.textPrimary,
  },
  message: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
    marginTop: -8,
  },
  input: {
    fontFamily: Fonts.mono.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderPrimary,
    paddingVertical: 8,
  },
  errorHint: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    color: Colors.danger,
    marginTop: -8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 4,
  },
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  cancelLabel: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  confirmLabel: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.accent,
  },
});
