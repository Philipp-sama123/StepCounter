import { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { COLORS } from '../constants';
import { getBmi, UserBodyProfile, WeightEntry } from '../storage/profileStorage';

type WeightTrendChartProps = {
  animationKey?: number;
  entries: WeightEntry[];
  profile: UserBodyProfile | null;
};

const CHART_HEIGHT = 118;
const MIN_CHART_WIDTH = 300;
const POINT_WIDTH = 78;
const HORIZONTAL_PADDING = 18;
const TOP_PADDING = 16;
const BOTTOM_PADDING = 24;

export const WeightTrendChart = ({ animationKey = 0, entries, profile }: WeightTrendChartProps) => {
  const bmi = profile === null ? 0 : getBmi(profile.heightCm, profile.currentWeightKg);
  const bmiEntries = profile === null
    ? []
    : entries.map((entry) => ({
      date: entry.date,
      timestamp: entry.timestamp,
      value: getBmi(profile.heightCm, entry.weightKg),
    })).filter((entry) => entry.value > 0);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Body profile</Text>
          <Text style={styles.subtitle}>{profile?.weightTrackingEnabled ? 'Weight tracking enabled' : 'Weight tracking disabled'}</Text>
        </View>
        <View style={styles.bmiBadge}>
          <Text style={styles.bmiLabel}>BMI</Text>
          <Text style={styles.bmiValue}>{bmi > 0 ? bmi.toFixed(1) : '-'}</Text>
        </View>
      </View>

      {entries.length > 0 ? (
        <>
          <TrendGraph
            animationKey={animationKey}
            entries={entries.map((entry) => ({ date: entry.date, timestamp: entry.timestamp, value: entry.weightKg }))}
            formatValue={(value) => `${value.toLocaleString()} kg`}
            gradientId="weightArea"
            lineColor={COLORS.action}
            title="Weight history"
          />
          <TrendGraph
            animationKey={animationKey}
            entries={bmiEntries}
            formatValue={(value) => value.toFixed(1)}
            gradientId="bmiArea"
            lineColor={COLORS.primary}
            title="BMI history"
          />
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Add height and weight in your profile to start the graph.</Text>
        </View>
      )}
    </View>
  );
};

type TrendGraphProps = {
  animationKey: number;
  entries: Array<{ date: string; timestamp?: string; value: number }>;
  formatValue: (value: number) => string;
  gradientId: string;
  lineColor: string;
  title: string;
};

const TrendGraph = ({ animationKey, entries, formatValue, gradientId, lineColor, title }: TrendGraphProps) => {
  const revealAnimation = useRef(new Animated.Value(0)).current;
  const pointAnimation = useRef(new Animated.Value(0)).current;
  const chartWidth = Math.max(MIN_CHART_WIDTH, entries.length * POINT_WIDTH + HORIZONTAL_PADDING * 2);
  const plotWidth = chartWidth - HORIZONTAL_PADDING * 2;
  const plotHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;
  const values = entries.map((entry) => entry.value);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  const range = Math.max(1, maxValue - minValue);
  const pointSpacing = entries.length > 1 ? plotWidth / (entries.length - 1) : 0;
  const baseline = CHART_HEIGHT - BOTTOM_PADDING;
  const points = entries.map((entry, index) => ({
    x: HORIZONTAL_PADDING + pointSpacing * index,
    y: TOP_PADDING + plotHeight * (1 - (entry.value - minValue) / range),
  }));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = points.length === 0
    ? ''
    : `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
  const revealStyle = {
    width: revealAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, chartWidth],
    }),
  };

  useEffect(() => {
    revealAnimation.setValue(0);
    pointAnimation.setValue(0);
    Animated.parallel([
      Animated.timing(revealAnimation, {
        duration: 720,
        toValue: 1,
        useNativeDriver: false,
      }),
      Animated.timing(pointAnimation, {
        duration: Math.max(560, entries.length * 120),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animationKey, entries.length, pointAnimation, revealAnimation, title]);

  return (
    <View style={styles.graphBlock}>
      <Text style={styles.graphTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.chartCanvas, { width: chartWidth }]}>
          <View style={[styles.svgWindow, { width: chartWidth }]}>
            <Animated.View style={[styles.revealMask, revealStyle]}>
              <View style={{ width: chartWidth }}>
                <Svg height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`} width={chartWidth}>
                  <Defs>
                    <LinearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                      <Stop offset="0" stopColor={lineColor} stopOpacity="0.24" />
                      <Stop offset="1" stopColor={lineColor} stopOpacity="0.03" />
                    </LinearGradient>
                  </Defs>
                  <Path d={areaPath} fill={`url(#${gradientId})`} />
                  <Path d={linePath} fill="none" opacity={0.16} stroke={lineColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth={10} />
                  <Path d={linePath} fill="none" stroke={lineColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} />
                </Svg>
              </View>
            </Animated.View>
          </View>
          <View style={[styles.pointLayer, { width: chartWidth }]}>
            {points.map((point, index) => {
              const pointProgress = pointAnimation.interpolate({
                inputRange: [Math.min(0.9, index * 0.1), Math.min(1, index * 0.1 + 0.2)],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={`${title}-point-${entries[index].date}-${entries[index].timestamp ?? 'legacy'}-${index}`}
                  style={[
                    styles.pointDot,
                    {
                      borderColor: lineColor,
                      left: point.x - 5,
                      opacity: pointProgress,
                      top: point.y - 5,
                      transform: [{
                        scale: pointProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.4, 1],
                        }),
                      }],
                    },
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.axis}>
            {entries.map((entry, index) => (
              <Animated.View
                key={`${title}-axis-${entry.date}-${entry.timestamp ?? entry.value}-${entry.value}-${index}`}
                style={[
                  styles.axisItem,
                  {
                    opacity: pointAnimation.interpolate({
                      inputRange: [Math.min(0.9, index * 0.1), Math.min(1, index * 0.1 + 0.2)],
                      outputRange: [0, 1],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              >
                <Text style={styles.day}>{formatEntryLabel(entry)}</Text>
                <Text style={styles.time}>{formatEntryTime(entry)}</Text>
                <Text style={styles.weight}>{formatValue(entry.value)}</Text>
              </Animated.View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const formatEntryLabel = (entry: { date: string; timestamp?: string }): string => {
  const value = entry.timestamp ?? entry.date;
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
};

const formatEntryTime = (entry: { date: string; timestamp?: string }): string => {
  const value = entry.timestamp ?? new Date(`${entry.date}T12:00:00`).toISOString();

  return new Date(value).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const styles = StyleSheet.create({
  panel: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '900',
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  bmiBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bmiLabel: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  bmiValue: {
    color: COLORS.action,
    fontSize: 20,
    fontWeight: '900',
  },
  chartCanvas: {
    gap: 8,
    position: 'relative',
  },
  svgWindow: {
    overflow: 'hidden',
  },
  revealMask: {
    overflow: 'hidden',
  },
  graphBlock: {
    gap: 8,
  },
  graphTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
  },
  pointLayer: {
    height: CHART_HEIGHT,
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
  },
  pointDot: {
    backgroundColor: COLORS.surface,
    borderRadius: 5,
    borderWidth: 3,
    height: 10,
    position: 'absolute',
    width: 10,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisItem: {
    alignItems: 'center',
    minWidth: POINT_WIDTH,
    gap: 3,
  },
  day: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '800',
  },
  weight: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '900',
  },
  time: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  emptyState: {
    backgroundColor: COLORS.stoppedSoft,
    borderRadius: 8,
    padding: 14,
  },
  emptyText: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
});
