import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

export interface FaceGuideProps {
  containerWidth: number;
  containerHeight: number;
  contourData?: SharedValue<number[]>;
}

const DOT_COUNT = 40;

function ContourDot({ index, contourData, containerWidth, containerHeight }: { index: number; contourData: SharedValue<number[]>; containerWidth: number; containerHeight: number }) {
  const dotStyle = useAnimatedStyle(() => {
    const pts = contourData.value;
    if (!pts || index * 2 + 1 >= pts.length) return { opacity: 0 };
    return {
      position: 'absolute',
      left: pts[index * 2] * containerWidth - 1.5,
      top: pts[index * 2 + 1] * containerHeight - 1.5,
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: 'rgba(245,245,240,0.5)',
      opacity: 1,
    };
  }, [index, containerWidth, containerHeight]);
  return <Animated.View style={dotStyle} />;
}

export default function FaceGuide({
  containerWidth,
  containerHeight,
  contourData,
}: FaceGuideProps) {
  const width = containerWidth || 1;
  const height = containerHeight || 1;

  if (!contourData) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: DOT_COUNT }).map((_, i) => (
        <ContourDot
          key={i}
          index={i}
          contourData={contourData}
          containerWidth={width}
          containerHeight={height}
        />
      ))}
    </View>
  );
}
