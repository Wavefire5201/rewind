import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Directory, Paths } from 'expo-file-system';
import { HardDrive, Image, Trash, Database, Clock, LockSimple } from 'phosphor-react-native';
import PinModal from '@/components/ui/PinModal';
import { hasPin, clearPin } from '@/utils/pin';
import { Colors } from '@/constants/theme';
import SectionLabel from '@/components/ui/SectionLabel';
import SettingsRow from '@/components/ui/SettingsRow';
import { haptics } from '@/utils/haptics';
import { confirm } from '@/utils/confirm';
import type { AppSettings, Album } from '@/types';

interface SettingsListProps {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  onClearData: () => void;
  onSeedMock: () => void;
  albums: Album[];
  onUnlockAllAlbums: (albumIds: string[]) => void;
}

function cyclePhotoQuality(current: AppSettings['photoQuality']): AppSettings['photoQuality'] {
  if (current === 'low') return 'medium';
  if (current === 'medium') return 'high';
  return 'low';
}


export default function SettingsList({ settings, updateSettings, onClearData, onSeedMock, albums, onUnlockAllAlbums }: SettingsListProps) {
  const [storageSize, setStorageSize] = useState('—');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinIntent, setPinIntent] = useState<'unlock' | 'set' | 'change'>('set');
  const [pinStep, setPinStep] = useState<'change' | 'set-new' | 'remove' | null>(null);
  const [pinExists, setPinExists] = useState(false);

  useEffect(() => {
    hasPin().then(setPinExists);
  }, []);

  async function handleChangePasscode() {
    haptics.tap();
    const exists = await hasPin();
    if (exists) {
      setPinStep('change');
      setPinIntent('change');
      setShowPinModal(true);
    } else {
      // No PIN yet — go straight to set
      setPinStep('set-new');
      setPinIntent('set');
      setShowPinModal(true);
    }
  }

  async function handleRemovePasscode() {
    haptics.tap();
    const lockedAlbumIds = albums.filter(a => a.isLocked).map(a => a.id);
    if (lockedAlbumIds.length > 0) {
      const one = lockedAlbumIds.length === 1;
      const yes = await confirm({
        title: 'remove passcode?',
        message: `${lockedAlbumIds.length} album${one ? '' : 's'} ${one ? 'is' : 'are'} currently locked. removing the passcode will unlock ${one ? 'it' : 'them'}. continue?`,
        confirmLabel: 'remove and unlock',
        destructive: true,
      });
      if (!yes) return;
      haptics.tap(); // on to PIN entry
    }
    setPinStep('remove');
    setPinIntent('unlock');
    setShowPinModal(true);
  }

  // PinModal played the success haptic: one per action, so none here.
  function handlePinSuccess() {
    if (pinStep === 'remove') {
      // PIN verified — clear it and unlock any locked albums
      const lockedAlbumIds = albums.filter(a => a.isLocked).map(a => a.id);
      clearPin();
      if (lockedAlbumIds.length > 0) {
        onUnlockAllAlbums(lockedAlbumIds);
      }
      setShowPinModal(false);
      setPinStep(null);
      setPinExists(false);
    } else {
      // 'change' or 'set-new' — new PIN was saved by PinModal internally
      setShowPinModal(false);
      setPinStep(null);
      setPinExists(true);
    }
  }

  useEffect(() => {
    async function calcStorage() {
      try {
        const docDir = new Directory(Paths.document);
        const files = docDir.list();
        // Photos only: thumbnails are a few KB each.
        const photoCount = files.filter(
          (f) => /\.(jpe?g|png)$/i.test(f.name) && !f.name.endsWith('_thumb.jpg')
        ).length;
        const mbPerPhoto: Record<AppSettings['photoQuality'], number> = { low: 1, medium: 2, high: 4 };
        const estimatedMB = photoCount * mbPerPhoto[settings.photoQuality];
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

        <SettingsRow
          icon={<HardDrive size={20} color={Colors.textSecondary} weight="light" />}
          label="storage"
          value={storageSize}
        />

        <View style={styles.divider} />

        <SettingsRow
          icon={<Image size={20} color={Colors.textSecondary} weight="light" />}
          label="photo quality"
          value={settings.photoQuality}
          onPress={() => { haptics.tap(); updateSettings({ photoQuality: cyclePhotoQuality(settings.photoQuality) }); }}
        />

        <View style={styles.divider} />

        <SettingsRow
          icon={<Clock size={20} color={Colors.textSecondary} weight="light" />}
          label="24-hour clock"
          value={settings.use24hClock ? 'on' : 'off'}
          highlight={settings.use24hClock}
          onPress={() => { haptics.tap(); updateSettings({ use24hClock: !settings.use24hClock }); }}
        />

        <View style={styles.divider} />

        <SettingsRow
          icon={<LockSimple size={20} color={Colors.textSecondary} weight="light" />}
          label={pinExists ? 'change passcode' : 'set passcode'}
          chevron
          onPress={handleChangePasscode}
        />

        {pinExists && (
          <>
            <View style={styles.divider} />
            <SettingsRow
              icon={<LockSimple size={20} color={Colors.danger} weight="light" />}
              label="remove passcode"
              danger
              chevron
              onPress={handleRemovePasscode}
            />
          </>
        )}

      </View>

      {__DEV__ && (
        <>
          <SectionLabel style={{ marginTop: 24 }}>dev tools</SectionLabel>
          <View style={styles.container}>
            <SettingsRow
              icon={<Trash size={20} color={Colors.danger} weight="light" />}
              label="clear all data"
              danger
              onPress={async () => {
                haptics.tap();
                const yes = await confirm({
                  title: 'clear all data?',
                  message: 'this will permanently delete all photos, albums, and settings. this cannot be undone.',
                  confirmLabel: 'clear everything',
                  destructive: true,
                });
                if (!yes) return;
                onClearData();
                haptics.success();
              }}
            />

            <View style={styles.divider} />

            <SettingsRow
              icon={<Database size={20} color={Colors.textSecondary} weight="light" />}
              label="add mock photos (7 days)"
              onPress={() => { haptics.tap(); onSeedMock(); }}
            />

          </View>
        </>
      )}
      <PinModal
        visible={showPinModal}
        intent={pinIntent}
        onSuccess={handlePinSuccess}
        onCancel={() => { setShowPinModal(false); setPinStep(null); }}
      />
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
  divider: {
    height: 1,
    backgroundColor: Colors.borderDivider,
    width: '100%',
  },
});
