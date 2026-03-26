import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Colors } from '@/constants/theme';

export default function FaceGuide() {
  const { width } = useWindowDimensions();
  const ovalWidth = Math.round(width * 0.57);
  const ovalHeight = Math.round(ovalWidth / 0.75);
  const crosshairSize = 12;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.center}>
        <View
          style={[
            styles.oval,
            {
              width: ovalWidth,
              height: ovalHeight,
              borderRadius: ovalWidth / 2,
            },
          ]}
        >
          {/* Horizontal crosshair */}
          <View
            style={[
              styles.crosshairH,
              { width: crosshairSize },
            ]}
          />
          {/* Vertical crosshair */}
          <View
            style={[
              styles.crosshairV,
              { height: crosshairSize },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  oval: {
    borderWidth: 1,
    borderColor: Colors.textTertiary,
    borderStyle: 'dashed',
    opacity: 0.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairH: {
    height: 1,
    backgroundColor: Colors.textTertiary,
    opacity: 0.5,
    position: 'absolute',
  },
  crosshairV: {
    width: 1,
    backgroundColor: Colors.textTertiary,
    opacity: 0.5,
    position: 'absolute',
  },
});
