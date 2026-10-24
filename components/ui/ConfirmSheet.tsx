import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BottomSheet from '@/components/ui/BottomSheet';
import { Colors, Fonts, Pressed } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';
import type { PendingConfirm } from '@/utils/confirm';

/**
 * A yes/no question as a bottom sheet. The primary button plays no haptic: the caller plays the
 * one for the outcome (success when done, or a tap when it starts longer work). Cancel taps;
 * cancel, scrim, drag and back all answer no.
 */
export default function ConfirmSheet({ confirm, onResolve, testID }: {
  confirm: PendingConfirm | null;
  onResolve: (result: boolean) => void;
  testID?: string;
}) {
  const { fonts } = useFont();
  // Keeps the words on screen while the sheet animates out after an answer.
  const [shown, setShown] = useState(confirm);
  if (confirm && confirm !== shown) setShown(confirm);
  // One answer per question, however many buttons get pressed before the sheet leaves.
  const answered = useRef<string | null>(null);

  function answer(result: boolean) {
    if (!confirm || answered.current === confirm.id) return;
    answered.current = confirm.id;
    onResolve(result);
  }

  return (
    <BottomSheet visible={confirm !== null} onClose={() => answer(false)} testID={testID}>
      {shown && (
        <View style={styles.body}>
          <Text style={[styles.title, { fontFamily: fonts.medium }]}>{shown.title}</Text>
          {shown.message ? <Text style={[styles.message, { fontFamily: fonts.regular }]}>{shown.message}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              onPress={() => answer(true)}
              style={({ pressed }) => [styles.button, shown.destructive ? styles.destructive : styles.primary, pressed && { opacity: Pressed.filled }]}
              accessibilityRole="button"
              accessibilityLabel={shown.confirmLabel}
            >
              <Text style={[styles.primaryText, { fontFamily: fonts.medium }]}>{shown.confirmLabel}</Text>
            </Pressable>
            <Pressable
              onPress={() => { haptics.tap(); answer(false); }}
              style={({ pressed }) => [styles.button, styles.cancel, pressed && { opacity: Pressed.text }]}
              accessibilityRole="button"
              accessibilityLabel={shown.cancelLabel}
            >
              <Text style={[styles.cancelText, { fontFamily: fonts.regular }]}>{shown.cancelLabel}</Text>
            </Pressable>
          </View>
        </View>
      )}
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
    marginBottom: 8,
  },
  message: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
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
  destructive: {
    backgroundColor: Colors.danger,
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
