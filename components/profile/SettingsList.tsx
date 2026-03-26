import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Directory, Paths } from 'expo-file-system';
import { HardDrive, Image, Cloud, CaretRight, Trash, Database } from 'phosphor-react-native';
import { Colors, Fonts } from '@/constants/theme';
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
            <Text style={styles.rowLabel}>Storage</Text>
          </View>
          <Text style={styles.rowValue}>{storageSize}</Text>
        </View>

        <View style={styles.divider} />

        {/* Row 3: Photo Quality */}
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          onPress={() => { haptics.tap(); updateSettings({ photoQuality: cyclePhotoQuality(settings.photoQuality) }); }}
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
          onPress={() => { haptics.tap(); Alert.alert('Coming Soon', 'Cloud backup will be available in a future update.'); }}
        >
          <View style={styles.left}>
            <Cloud size={20} color={Colors.textSecondary} weight="light" />
            <Text style={styles.rowLabel}>Cloud Backup</Text>
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
                Alert.alert('Clear All Data', 'This will delete all photos, albums, and settings. Are you sure?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: onClearData },
                ]);
              }}
            >
              <View style={styles.left}>
                <Trash size={20} color="#E57373" weight="light" />
                <Text style={[styles.rowLabel, { color: '#E57373' }]}>Clear All Data</Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              onPress={() => { haptics.tap(); onSeedMock(); }}
            >
              <View style={styles.left}>
                <Database size={20} color={Colors.textSecondary} weight="light" />
                <Text style={styles.rowLabel}>Add Mock Photos (7 days)</Text>
              </View>
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
