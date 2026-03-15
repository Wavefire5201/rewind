import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function GridOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.horizontalLine1} />
      <View style={styles.horizontalLine2} />
      <View style={styles.verticalLine1} />
      <View style={styles.verticalLine2} />
    </View>
  );
}

const styles = StyleSheet.create({
  horizontalLine1: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '33.33%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  horizontalLine2: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '66.66%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  verticalLine1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '33.33%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  verticalLine2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '66.66%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
