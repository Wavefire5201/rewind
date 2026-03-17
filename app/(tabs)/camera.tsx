import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView } from 'expo-camera';
import { ImageManipulator, FlipType } from 'expo-image-manipulator';
import { Colors, Typography } from '@/constants/theme';
import { usePhotos } from '@/hooks/usePhotos';
import { useGreeting } from '@/hooks/useGreeting';
import { useAppContext } from '@/context/AppContext';
import { getToday, formatDateLabel } from '@/utils/dates';
import Viewfinder from '@/components/camera/Viewfinder';
import CameraControls from '@/components/camera/CameraControls';
import TimerSelector from '@/components/camera/TimerSelector';
import CapturePreview from '@/components/camera/CapturePreview';
import type { PhotoEntry } from '@/types';

const QUALITY_MAP: Record<string, number> = { low: 0.5, medium: 0.7, high: 1.0 };

export default function CameraScreen() {
  const { mostRecentPhoto, addPhoto } = usePhotos();
  const { dayNumber } = useGreeting();
  const { settings } = useAppContext();

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

  const handleGhostOpacity = useCallback((value: number) => {
    setGhostOpacity(value);
  }, []);

  const handleSave = (caption: string, savedUri: string) => {
    const newPhoto: PhotoEntry = {
      id: Date.now().toString(),
      date: today,
      imageUri: savedUri,
      caption,
      capturedAt: new Date().toISOString(),
      cameraDirection: facing,
    };
    addPhoto(newPhoto);
    setShowPreview(false);
    setCapturedUri('');
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

      <View style={styles.content}>
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
    paddingBottom: 100,
    alignItems: 'center',
    gap: 12,
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
