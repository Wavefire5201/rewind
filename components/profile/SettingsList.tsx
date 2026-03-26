import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Directory, Paths } from 'expo-file-system';
import { HardDrive, Image, Cloud, CaretRight, Trash, Database, TextAa, Clock } from 'phosphor-react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import SectionLabel from '@/components/ui/SectionLabel';
import { haptics } from '@/utils/haptics';
import type { AppSettings } from '@/types';

interface SettingsListProps {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  onClearData: () => void;
  onSeedMock: () => void;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function cyclePhotoQuality(current: AppSettings['photoQuality']): AppSettings['photoQuality'] {
  if (current === 'low') return 'medium';
  if (current === 'medium') return 'high';
  return 'low';
}


export default function SettingsList({ settings, updateSettings, onClearData, onSeedMock }: SettingsListProps) {
  const { fonts, typography } = useFont();
  const [storageSize, setStorageSize] = useState('—');

  useEffect(() => {
    async function calcStorage() {
      try {
        const docDir = new Directory(Paths.document);
        const files = docDir.list();
        const photoCount = files.filter(
          (f) => f.name.endsWith('.jpg') || f.name.endsWith('.jpeg') || f.name.endsWith('.png')
        ).length;
        const estimatedMB = photoCount * 2;
        if (estimatedMB < 1) {
          setStorageSize('< 1 MB');
        } else if (estimatedMB < 1000) {
          setStorageSize(`~${estimatedMB} MB`);
        } else {
          setStorageSize(`~${(estimatedMB / 1000).toFixed(1)} GB`);
        }
      } catch {
        setStorageSize('—');
      }
    }
    calcStorage();
  }, [settings]);

  return (
    <View>
      <SectionLabel>settings</SectionLabel>
      <View style={styles.container}>
        {/* Reminders are now per-album — configure them from each album's detail page */}

        {/* Row 1: Storage */}
        <View style={styles.row}>
          <View style={styles.left}>
            <HardDrive size={20} color={Colors.textSecondary} weight="light" />
            <Text style={typography.body}>storage</Text>
          </View>
          <Text style={[styles.rowValue, { fontFamily: fonts.regular }]}>{storageSize}</Text>
        </View>

        <View style={styles.divider} />

        {/* Row 3: Photo Quality */}
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          onPress={() => { haptics.tap(); updateSettings({ photoQuality: cyclePhotoQuality(settings.photoQuality) }); }}
        >
          <View style={styles.left}>
            <Image size={20} color={Colors.textSecondary} weight="light" />
            <Text style={typography.body}>photo quality</Text>
          </View>
          <Text style={[styles.rowValue, { fontFamily: fonts.regular }]}>{capitalize(settings.photoQuality)}</Text>
        </Pressable>

        <View style={styles.divider} />

        {/* Row: 24h Clock */}
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          onPress={() => { haptics.tap(); updateSettings({ use24hClock: !settings.use24hClock }); }}
        >
          <View style={styles.left}>
            <Clock size={20} color={Colors.textSecondary} weight="light" />
            <Text style={typography.body}>24-hour clock</Text>
          </View>
          <Text style={[styles.rowValue, { fontFamily: fonts.regular }]}>{settings.use24hClock ? 'on' : 'off'}</Text>
        </Pressable>

        <View style={styles.divider} />

        {/* Row 4: Cloud Backup */}
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          onPress={() => { haptics.tap(); Alert.alert('Coming Soon', 'Cloud backup is not available yet.'); }}
        >
          <View style={styles.left}>
            <Cloud size={20} color={Colors.textSecondary} weight="light" />
            <Text style={typography.body}>cloud backup</Text>
          </View>
          <CaretRight size={16} color={Colors.textTertiary} weight="light" />
        </Pressable>
      </View>

      {__DEV__ && (
        <>
          <SectionLabel style={{ marginTop: 24 }}>dev tools</SectionLabel>
          <View style={styles.container}>
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              onPress={() => {
                haptics.tap();
                Alert.alert('Clear All Data', 'This will permanently delete all photos, albums, and settings. This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear Everything', style: 'destructive', onPress: onClearData },
                ]);
              }}
            >
              <View style={styles.left}>
                <Trash size={20} color={Colors.danger} weight="light" />
                <Text style={[typography.body, { color: Colors.danger }]}>clear all data</Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              onPress={() => { haptics.tap(); onSeedMock(); }}
            >
              <View style={styles.left}>
                <Database size={20} color={Colors.textSecondary} weight="light" />
                <Text style={typography.body}>add mock photos (7 days)</Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              onPress={() => {
                haptics.tap();
                updateSettings({
                  fontFamily: settings.fontFamily === 'jetbrains' ? 'commitmono' : 'jetbrains',
                });
              }}
            >
              <View style={styles.left}>
                <TextAa size={20} color={Colors.textSecondary} weight="light" />
                <Text style={typography.body}>font family</Text>
              </View>
              <Text style={[styles.rowValue, { fontFamily: fonts.regular }]}>
                {settings.fontFamily === 'commitmono' ? 'commit mono' : 'jetbrains mono'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
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
