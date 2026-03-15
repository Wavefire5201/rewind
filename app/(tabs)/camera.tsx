import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView } from 'expo-camera';
import { Colors, Typography } from '@/constants/theme';
import { usePhotos } from '@/hooks/usePhotos';
import { useGreeting } from '@/hooks/useGreeting';
import { getToday, formatDateLabel } from '@/utils/dates';
import Viewfinder from '@/components/camera/Viewfinder';
import CameraControls from '@/components/camera/CameraControls';
import TimerSelector from '@/components/camera/TimerSelector';
import CapturePreview from '@/components/camera/CapturePreview';
import type { PhotoEntry } from '@/types';

export default function CameraScreen() {
  const { mostRecentPhoto, addPhoto } = usePhotos();
  const { dayNumber } = useGreeting();

  const cameraRef = useRef<CameraView>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [ghostOpacity, setGhostOpacity] = useState(0.3);
  const [showTimer, setShowTimer] = useState(false);
  const [timerDuration, setTimerDuration] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [capturedUri, setCapturedUri] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);

  const today = getToday();
  const dateLabel = `${formatDateLabel(today)} — day ${dayNumber}`;

  const doCapture = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
    if (photo?.uri) {
      setCapturedUri(photo.uri);
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

  const handleFlip = () => setFacing(prev => prev === 'front' ? 'back' : 'front');
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
