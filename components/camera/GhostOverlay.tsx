import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Stack } from 'phosphor-react-native';
import Slider from '@/components/ui/OpacitySlider';
import { Colors, Fonts } from '@/constants/theme';

interface GhostOverlayProps {
  imageUri: string;
  opacity: number;
  onOpacityChange: (value: number) => void;
}

export default function GhostOverlay({ imageUri, opacity, onOpacityChange }: GhostOverlayProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Image
        source={{ uri: imageUri }}
        style={[StyleSheet.absoluteFill, { opacity }]}
        contentFit="cover"
        pointerEvents="none"
      />
      <View style={styles.controls} pointerEvents="box-none">
        <View style={styles.badge}>
          <Stack size={12} color={Colors.textPrimary} weight="light" />
          <Text style={styles.badgeText}>{Math.round(opacity * 100)}%</Text>
        </View>
        <View style={styles.sliderWrap}>
          <Slider value={opacity} onValueChange={onOpacityChange} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A1A1C99',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 10,
    color: Colors.textPrimary,
  },
  sliderWrap: {
    flex: 1,
    maxWidth: 120,
  },
});
