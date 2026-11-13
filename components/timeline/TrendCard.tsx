import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';
import {
  comparableCount, faceHeadline, trendDomain, trendGeometry, MIN_COMPARABLE, type FaceTrend, type TrendPhoto,
} from '@/utils/faceTrend';
import {
  formatChange, formatWeight, unionDomain, weightDomain, weightGeometry, weightReadout,
} from '@/utils/weight';
import type { WeightEntry, WeightUnit, WeightValue } from '@/types';
import type { FaceScanProgress } from '@/hooks/useFaceScanBackfill';

/** Each strip's height: the two together are about the face chart's old 120. */
const STRIP_HEIGHT = 64;

export interface FaceSection {
  photos: TrendPhoto[];
  /** The album's trend (built once by the screen, which also feeds the photo readout). */
  trend: FaceTrend | null;
  /** Photos are still waiting to be measured (e.g. while the q95 pass runs first). */
  waiting: boolean;
  progress: FaceScanProgress;
}

interface TrendCardProps {
  /** The face strip; null where face scanning isn't available. */
  face: FaceSection | null;
  /** This album's weights, by date. */
  weights: readonly WeightEntry[];
  unit: WeightUnit;
  goal?: WeightValue;
  onSelectDate: (date: string) => void;
  onCompare: () => void;
  /** Opens the weight sheet: on `date` from a tap on the chart, else on today. */
  onLogWeight: (date?: string) => void;
}

// One path of zero-length round-capped segments: a dot per point without a node per point.
const dotsPath = (dots: { x: number; y: number }[]) => dots.map((d) => `M${d.x.toFixed(1)},${d.y.toFixed(1)}h0.01`).join('');

function nearest<T extends { x: number }>(dots: T[], x: number): T {
  let best = dots[0];
  for (const d of dots) if (Math.abs(d.x - x) < Math.abs(best.x - x)) best = d;
  return best;
}

/**
 * Face width and weight over time, one strip above the other on the same date axis. Each keeps
 * its own scale: the strips line up by day, not by value.
 */
export default function TrendCard({ face, weights, unit, goal, onSelectDate, onCompare, onLogWeight }: TrendCardProps) {
  const { fonts } = useFont();
  const [width, setWidth] = useState(0);
  const trend = face?.trend ?? null;
  const domain = useMemo(() => unionDomain(trend ? trendDomain(trend) : null, weightDomain(weights)), [trend, weights]);
  const faceGeometry = useMemo(
    () => (trend && domain && width > 0 ? trendGeometry(trend, width, STRIP_HEIGHT, domain) : null),
    [trend, domain, width],
  );
  const weightGeo = useMemo(
    () => (weights.length > 0 && domain && width > 0 ? weightGeometry(weights, unit, width, STRIP_HEIGHT, domain, goal) : null),
    [weights, unit, domain, width, goal],
  );
  const readout = useMemo(() => weightReadout(weights, unit, goal), [weights, unit, goal]);
  const headline = trend ? faceHeadline(trend) : null;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const handleFacePress = (e: GestureResponderEvent) => {
    if (!faceGeometry || faceGeometry.dots.length === 0) return;
    haptics.tap();
    onSelectDate(nearest(faceGeometry.dots, e.nativeEvent.locationX).date);
  };

  const handleWeightPress = (e: GestureResponderEvent) => {
    if (!weightGeo || weightGeo.dots.length === 0) return;
    haptics.tap();
    onLogWeight(nearest(weightGeo.dots, e.nativeEvent.locationX).date);
  };

  const faceNote = !face || trend
    ? null
    : face.progress.scanning
      ? null
      : face.waiting
        ? 'measuring soon'
        : `needs ${MIN_COMPARABLE} comparable photos (${comparableCount(face.photos)} so far)`;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.label, { fontFamily: fonts.regular }]}>{face ? 'face width · weight' : 'weight'}</Text>
        <View style={styles.links}>
          {trend ? (
            <Pressable onPress={() => { haptics.tap(); onCompare(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel="Compare two days">
              <Text style={[styles.link, { fontFamily: fonts.regular }]}>compare</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => { haptics.tap(); onLogWeight(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel="Log weight">
            <Text style={[styles.link, { fontFamily: fonts.regular }]}>+ log</Text>
          </Pressable>
        </View>
      </View>

      {face ? (
        <>
          {face.progress.scanning ? (
            <Text style={[styles.note, { fontFamily: fonts.regular }]}>measuring {face.progress.done}/{face.progress.total}</Text>
          ) : null}
          {trend ? (
            <>
              {headline ? <Text style={[styles.headline, { fontFamily: fonts.regular }]}>{headline}</Text> : null}
              <Pressable
                testID="face-chart"
                style={styles.chart}
                onLayout={onLayout}
                onPress={handleFacePress}
                accessibilityLabel="Face width chart. Tap a day to open its photo."
              >
                {faceGeometry ? (
                  <Svg width={width} height={STRIP_HEIGHT}>
                    <Line x1={0} x2={width} y1={STRIP_HEIGHT / 2} y2={STRIP_HEIGHT / 2} stroke={Colors.borderDivider} strokeWidth={1} />
                    <Path testID="face-chart-dots" d={dotsPath(faceGeometry.dots)} stroke={Colors.textTertiary} strokeWidth={3} strokeLinecap="round" fill="none" />
                    <Path d={faceGeometry.line} stroke={Colors.accent} strokeWidth={2} fill="none" />
                  </Svg>
                ) : null}
              </Pressable>
            </>
          ) : faceNote ? (
            <Text style={[styles.note, { fontFamily: fonts.regular }]}>{faceNote}</Text>
          ) : null}
          <View style={styles.divider} />
        </>
      ) : null}

      {readout ? (
        <>
          <Text style={[styles.headline, { fontFamily: fonts.regular }]}>
            {formatWeight(readout.latest, unit)}
            {readout.toGoal === null ? '' : readout.toGoal === 0 ? ' · goal reached' : ` · ${readout.toGoal.toFixed(1)} ${unit} to goal`}
          </Text>
          {readout.deltas.length > 0 ? (
            <Text style={[styles.note, { fontFamily: fonts.regular }]}>
              {readout.deltas.map((d) => `${d.days}d ${formatChange(d.change)}`).join(' · ')}
            </Text>
          ) : null}
          <Pressable
            testID="weight-chart"
            style={styles.chart}
            onLayout={onLayout}
            onPress={handleWeightPress}
            accessibilityLabel="Weight chart. Tap a day to edit its weight."
          >
            {weightGeo ? (
              <Svg width={width} height={STRIP_HEIGHT}>
                {weightGeo.goalY !== null ? (
                  <Line
                    testID="weight-goal-line"
                    x1={0}
                    x2={width}
                    y1={weightGeo.goalY}
                    y2={weightGeo.goalY}
                    stroke={Colors.textTertiary}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                ) : null}
                <Path testID="weight-chart-dots" d={dotsPath(weightGeo.dots)} stroke={Colors.streak} strokeWidth={3} strokeLinecap="round" fill="none" />
                <Path testID="weight-chart-line" d={weightGeo.line} stroke={Colors.streak} strokeWidth={1.5} strokeOpacity={0.6} fill="none" />
              </Svg>
            ) : null}
          </Pressable>
        </>
      ) : (
        <Text style={[styles.note, { fontFamily: fonts.regular }]}>no weights yet. tap + log to add one.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.bgCard, padding: Spacing.lg, gap: Spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  links: { flexDirection: 'row', gap: Spacing.lg },
  label: { fontFamily: Fonts.mono.regular, fontSize: 10, letterSpacing: 2, color: Colors.textSecondary },
  link: { fontFamily: Fonts.mono.regular, fontSize: 12, color: Colors.accent },
  headline: { fontFamily: Fonts.mono.regular, fontSize: 14, color: Colors.textPrimary },
  note: { fontFamily: Fonts.mono.regular, fontSize: 12, color: Colors.textTertiary },
  chart: { height: STRIP_HEIGHT },
  divider: { height: 1, backgroundColor: Colors.borderDivider, marginVertical: Spacing.xs },
});
