import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft, LockSimple } from 'phosphor-react-native';
import PinModal from '@/components/ui/PinModal';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { useAppContext } from '@/context/AppContext';
import { useAlbumLock } from '@/hooks/useAlbumLock';
import { haptics } from '@/utils/haptics';
import PillButton from '@/components/ui/PillButton';

interface AlbumLockGateProps {
  albumId: string | undefined;
  children: React.ReactNode;
}

/**
 * Wraps every screen that shows an album. While the album is locked the screen isn't
 * mounted at all (no photos, no camera, no backfills), only a prompt to unlock it. Each
 * album route needs this, because any of them can be opened directly by a deep link.
 */
export default function AlbumLockGate({ albumId, children }: AlbumLockGateProps) {
  const { isAlbumLocked } = useAlbumLock();
  if (!albumId || !isAlbumLocked(albumId)) return <>{children}</>;
  return <LockedAlbum albumId={albumId} />;
}

function LockedAlbum({ albumId }: { albumId: string }) {
  const router = useRouter();
  const { fonts, typography } = useFont();
  const { albums, updateAlbum } = useAppContext();
  const { unlockAlbum } = useAlbumLock();
  const [showPinModal, setShowPinModal] = useState(false);
  const albumName = albums.find(a => a.id === albumId)?.name ?? 'album';

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => { haptics.tap(); leave(); }}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <CaretLeft size={20} color={Colors.textPrimary} weight="regular" />
        </Pressable>
        <Text style={[styles.title, { fontFamily: fonts.regular }]} numberOfLines={1}>{albumName}</Text>
        <View style={styles.headerBtn} />
      </View>
      <View style={styles.body}>
        <LockSimple size={48} color={Colors.textTertiary} weight="light" />
        <Text style={[typography.body, { color: Colors.textTertiary }]}>this album is locked</Text>
        <PillButton label="unlock" size="medium" onPress={() => setShowPinModal(true)} accessibilityLabel="Unlock album" />
      </View>
      <PinModal
        visible={showPinModal}
        intent="unlock"
        onSuccess={() => { setShowPinModal(false); unlockAlbum(albumId); }}
        onCancel={() => { setShowPinModal(false); leave(); }}
        onNoPinFound={() => {
          // PIN data gone: clear the lock so the album isn't locked forever.
          updateAlbum(albumId, { isLocked: false });
          setShowPinModal(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
    fontFamily: Fonts.mono.regular,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
});
