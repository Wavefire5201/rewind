import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { BellSimple, HardDrive, Image, Cloud, CaretRight } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts } from '@/constants/theme';
import SectionLabel from '@/components/ui/SectionLabel';
import type { AppSettings } from '@/types';

interface SettingsListProps {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function cyclePhotoQuality(current: AppSettings['photoQuality']): AppSettings['photoQuality'] {
  if (current === 'low') return 'medium';
  if (current === 'medium') return 'high';
  return 'low';
}

function formatReminderTime(time: string): string {
  const [hourStr, minuteStr] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${period}`;
}

export default function SettingsList({ settings, updateSettings }: SettingsListProps) {
  return (
    <View>
      <SectionLabel>settings</SectionLabel>
      <View style={styles.container}>
        {/* Row 1: Daily Reminder */}
        <View style={styles.row}>
          <View style={styles.left}>
            <BellSimple size={20} color={Colors.textSecondary} weight="light" />
            <Text style={styles.rowLabel}>Daily Reminder</Text>
          </View>
          <Text style={styles.rowValue}>{formatReminderTime(settings.reminderTime)}</Text>
        </View>

        <View style={styles.divider} />

        {/* Row 2: Storage */}
        <View style={styles.row}>
          <View style={styles.left}>
            <HardDrive size={20} color={Colors.textSecondary} weight="light" />
            <Text style={styles.rowLabel}>Storage</Text>
          </View>
          <Text style={styles.rowValue}>1.2 GB</Text>
        </View>

        <View style={styles.divider} />

        {/* Row 3: Photo Quality */}
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateSettings({ photoQuality: cyclePhotoQuality(settings.photoQuality) }); }}
        >
          <View style={styles.left}>
            <Image size={20} color={Colors.textSecondary} weight="light" />
            <Text style={styles.rowLabel}>Photo Quality</Text>
          </View>
          <Text style={styles.rowValue}>{capitalize(settings.photoQuality)}</Text>
        </Pressable>

        <View style={styles.divider} />

        {/* Row 4: Cloud Backup */}
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Alert.alert('Coming Soon', 'Cloud backup will be available in a future update.'); }}
        >
          <View style={styles.left}>
            <Cloud size={20} color={Colors.textSecondary} weight="light" />
            <Text style={styles.rowLabel}>Cloud Backup</Text>
          </View>
          <CaretRight size={16} color={Colors.textTertiary} weight="light" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    fontFamily: Fonts.mono.regular,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  rowValue: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderDivider,
    width: '100%',
  },
});
