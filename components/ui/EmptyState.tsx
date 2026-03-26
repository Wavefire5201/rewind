import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';

interface EmptyStateProps {
  icon: React.ReactNode;
  message: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function EmptyState({ icon, message, subtitle, ctaLabel, onCta }: EmptyStateProps) {
  const { fonts } = useFont();
  return (
    <View style={styles.container}>
      {icon}
      <Text style={[styles.message, { fontFamily: fonts.regular }]}>{message}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { fontFamily: fonts.regular }]}>{subtitle}</Text>
      )}
      {ctaLabel && onCta && (
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.7 }]}
          onPress={() => { haptics.tap(); onCta(); }}
          accessibilityRole="button"
        >
          <Text style={[styles.ctaText, { fontFamily: fonts.regular }]}>{ctaLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },
  message: { fontFamily: Fonts.mono.regular, fontSize: 14, color: Colors.textTertiary, textAlign: 'center', lineHeight: 22 },
  subtitle: { fontFamily: Fonts.mono.regular, fontSize: 12, color: Colors.textTertiary, textAlign: 'center', lineHeight: 18, marginTop: -8 },
  cta: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.accent },
  ctaText: { fontFamily: Fonts.mono.regular, fontSize: 13, color: Colors.bgPage },
});
