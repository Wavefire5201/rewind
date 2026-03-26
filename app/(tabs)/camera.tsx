import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView } from 'expo-camera';
import { ImageManipulator, FlipType } from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Colors, Fonts, Typography } from '@/constants/theme';
import { usePhotos } from '@/hooks/usePhotos';
import { useGreeting } from '@/hooks/useGreeting';
import { useAppContext } from '@/context/AppContext';
import { getToday, formatDateLabel } from '@/utils/dates';
import { haptics } from '@/utils/haptics';
import Viewfinder from '@/components/camera/Viewfinder';
import CameraControls from '@/components/camera/CameraControls';
import TimerSelector from '@/components/camera/TimerSelector';
import CapturePreview from '@/components/camera/CapturePreview';
import FaceGuide from '@/components/camera/FaceGuide';
import { UserFocus, CaretLeft } from 'phosphor-react-native';
import type { PhotoEntry } from '@/types';

const QUALITY_MAP: Record<string, number> = { low: 0.5, medium: 0.7, high: 1.0 };

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
  const { albums, settings } = useAppContext();
  const { mostRecentPhoto, todayPhoto, addPhoto } = usePhotos(albumId);
  const { dayNumber } = useGreeting();
  const albumName = albums.find(a => a.id === albumId)?.name ?? albumId;

  const cameraRef = useRef<CameraView>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [isMirrored, setIsMirrored] = useState(settings.mirrorSelfies);
  const [ghostOpacity, setGhostOpacity] = useState(0.3);
  const [showTimer, setShowTimer] = useState(false);
  const [timerDuration, setTimerDuration] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [capturedUri, setCapturedUri] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showFaceGuide, setShowFaceGuide] = useState(false);

  const today = getToday();
  const dateLabel = `${formatDateLabel(today)} — day ${dayNumber}`;

  const doCapture = async () => {
    const quality = QUALITY_MAP[settings.photoQuality] ?? 0.8;
    const photo = await cameraRef.current?.takePictureAsync({ quality });
    if (photo?.uri) {
      let uri = photo.uri;
      if (facing === 'front' && !isMirrored) {
        try {
          const imageRef = await ImageManipulator.manipulate(uri)
            .flip(FlipType.Horizontal)
            .renderAsync();
          const saved = await imageRef.saveAsync();
          uri = saved.uri;
        } catch {}
      }
      setCapturedUri(uri);
      setShowPreview(true);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleCapture = async () => {
    if (timerDuration > 0) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
      setCountdown(timerDuration);
      let remaining = timerDuration;
      intervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setCountdown(null);
          doCapture();
        } else {
          setCountdown(remaining);
        }
      }, 1000);
    } else {
      await doCapture();
    }
  };

  const handleFlip = () => {
    setFacing(prev => prev === 'front' ? 'back' : 'front');
    setIsMirrored(settings.mirrorSelfies);
  };
  const handleMirrorToggle = () => setIsMirrored(prev => !prev);
  const handleTimerToggle = () => setShowTimer(prev => !prev);
  const handleFaceGuideToggle = () => setShowFaceGuide(prev => !prev);

  const handleGhostOpacity = useCallback((value: number) => {
    setGhostOpacity(value);
  }, []);

  const handleSave = (caption: string, savedUri: string) => {
    const doSave = () => {
      const newPhoto: PhotoEntry = {
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        albumId: albumId,
        date: today,
        imageUri: savedUri,
        caption,
        capturedAt: new Date().toISOString(),
        cameraDirection: facing,
      };
      addPhoto(newPhoto);
      setShowPreview(false);
      setCapturedUri('');
      router.replace({ pathname: '/album/[id]', params: { id: albumId } });
    };

    if (todayPhoto) {
      Alert.alert(
        'Replace Photo',
        "You've already captured today. Replace it with this one?",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: doSave },
        ],
      );
    } else {
      doSave();
    }
  };

  const handleRetake = () => {
    setShowPreview(false);
    setCapturedUri('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Viewfinder
        ref={cameraRef}
        ghostImageUri={mostRecentPhoto?.imageUri ?? null}
        facing={facing}
        ghostOpacity={ghostOpacity}
        onGhostOpacityChange={handleGhostOpacity}
        isMirrored={isMirrored}
      />

      {showFaceGuide ? <FaceGuide /> : null}

      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={() => { haptics.tap(); canGoBack ? router.back() : router.replace('/'); }}
            style={styles.backBtn}
            hitSlop={12}
            activeOpacity={0.7}
          >
            <CaretLeft size={20} color={Colors.textPrimary} weight="regular" />
          </TouchableOpacity>
          <Text style={styles.albumLabel}>{albumName}</Text>
          <TouchableOpacity
            onPress={handleFaceGuideToggle}
            style={styles.backBtn}
            hitSlop={12}
            activeOpacity={0.7}
          >
            <UserFocus
              size={20}
              color={showFaceGuide ? Colors.accent : Colors.textSecondary}
              weight="light"
            />
          </TouchableOpacity>
        </View>
        <Text style={[Typography.sectionLabel, styles.dateLabel]}>{dateLabel}</Text>

        {countdown !== null ? (
          <Text style={[Typography.bigNumber, styles.countdown]}>{countdown}</Text>
        ) : null}

        <CameraControls
          onCapture={handleCapture}
          onFlip={handleFlip}
          onTimerToggle={handleTimerToggle}
          onMirrorToggle={handleMirrorToggle}
          isMirrored={isMirrored}
          isFrontCamera={facing === 'front'}
        />

        {showTimer && (
          <TimerSelector
            selectedDuration={timerDuration}
            onSelect={setTimerDuration}
            visible={showTimer}
          />
        )}
      </View>

      <CapturePreview
        visible={showPreview}
        imageUri={capturedUri}
        onSave={handleSave}
        onRetake={handleRetake}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  content: {
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumLabel: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.accent,
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'lowercase',
  },
  dateLabel: {
    color: Colors.textTertiary,
    textAlign: 'center',
    letterSpacing: 2,
  },
  countdown: {
    color: Colors.accent,
  },
});
