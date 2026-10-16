import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import { Colors, Fonts, Pressed } from '@/constants/theme';
import { useFont } from '@/context/FontContext';

interface SettingsRowProps {
  label: string;
  /** Left icon; pass a 20-wide spacer to indent a sub-row. */
  icon?: React.ReactNode;
  value?: string;
  /** Shows the value in the highlight colour: "on" states, the reminder time. */
  highlight?: boolean;
  /** A secondary row (e.g. the reminder time under its toggle). */
  muted?: boolean;
  danger?: boolean;
  chevron?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** One row of a settings card, the same on the profile and album settings screens. */
export default function SettingsRow({
  label,
  icon,
  value,
  highlight = false,
  muted = false,
  danger = false,
  chevron = false,
  onPress,
  accessibilityLabel,
}: SettingsRowProps) {
  const { typography, fonts } = useFont();
  const labelColor = danger ? Colors.danger : muted ? Colors.textSecondary : Colors.textPrimary;
  const content = (
    <>
      <View style={styles.left}>
        {icon}
        <Text style={[typography.body, { fontFamily: fonts.regular, color: labelColor }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.right}>
        {value !== undefined ? (
          <Text
            style={[styles.value, { fontFamily: fonts.regular, color: highlight ? Colors.streak : Colors.textSecondary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {value}
          </Text>
        ) : null}
        {chevron ? <CaretRight size={16} color={Colors.textTertiary} weight="regular" /> : null}
      </View>
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: Pressed.text }]}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flex: 1,
  },
  value: {
    flexShrink: 1,
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
  },
});
