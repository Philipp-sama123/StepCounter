import { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { COLORS } from '../constants';
import { StepHistoryEntry } from '../storage/stepStorage';

type StepTrendChartProps = {
  goal: number;
  history: StepHistoryEntry[];
  metric?: 'pace' | 'steps';
  paceByDate?: Record<string, number>;
  sessionSums?: Record<string, number>;
};

const CHART_HEIGHT = 190;
const CHART_WIDTH = 320;
const POINT_WIDTH = 54;
const POINT_GAP = 10;
const HORIZONTAL_PADDING = 18;
const TOP_PADDING = 16;
const BOTTOM_PADDING = 24;

const formatCompactSteps = (steps: number): string => {
  if (steps >= 1000) {
    return `${Math.round(steps / 100) / 10}k`;
  }

  return String(steps);
};

const createLinePath = (points: { x: number; y: number }[]): string =>
  points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

const createAreaPath = (points: { x: number; y: number }[]): string => {
  if (points.length === 0) {
    return '';
  }

  const baseline = CHART_HEIGHT - BOTTOM_PADDING;
  return `${createLinePath(points)} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
};

export const StepTrendChart = ({ goal, history, metric = 'steps', paceByDate = {}, sessionSums = {} }: StepTrendChartProps) => {
  const entryAnimation = useRef(new Animated.Value(0)).current;
  const values = history.map((entry) => getEntryValue(entry, metric, paceByDate));
  const maxSteps = Math.max(metric === 'steps' ? goal : 0, ...values, 1);
  const chartRange = Math.max(maxSteps * 1.15, 1);
  const chartWidth = Math.max(CHART_WIDTH, history.length * (POINT_WIDTH + POINT_GAP) + HORIZONTAL_PADDING * 2);
  const plotWidth = chartWidth - HORIZONTAL_PADDING * 2;
  const plotHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;
  const baseline = CHART_HEIGHT - BOTTOM_PADDING;
  const pointSpacing = history.length > 1 ? plotWidth / (history.length - 1) : 0;
  const points = history.map((entry, index) => ({
    x: HORIZONTAL_PADDING + pointSpacing * index,
    y: TOP_PADDING + plotHeight * (1 - Math.min(getEntryValue(entry, metric, paceByDate) / chartRange, 1)),
  }));
  const goalY = TOP_PADDING + plotHeight * (1 - Math.min(goal / chartRange, 1));
  const linePath = createLinePath(points);
  const areaPath = createAreaPath(points);

  useEffect(() => {
    entryAnimation.setValue(0);
    Animated.spring(entryAnimation, {
      friction: 8,
      tension: 68,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [entryAnimation, history.length, metric]);

  const animatedChartStyle = {
    opacity: entryAnimation,
    transform: [
      {
        translateY: entryAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
      {
        scale: entryAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.98, 1],
        }),
      },
    ],
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Daily step trend</Text>
          <Text style={styles.subtitle}>{metric === 'steps' ? 'Orange bars show logged challenge sessions' : 'Steps per minute from walking sessions'}</Text>
        </View>
        <Text style={styles.goal}>{metric === 'steps' ? `${formatCompactSteps(goal)} goal` : 'pace'}</Text>
      </View>

      <View style={styles.chartFrame}>
        <ScrollView contentContainerStyle={styles.scrollContent} horizontal showsHorizontalScrollIndicator={false}>
          <Animated.View style={[styles.chartCanvas, { width: chartWidth }, animatedChartStyle]}>
            <Svg height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`} width={chartWidth}>
              <Defs>
                <LinearGradient id="stepArea" x1="0" x2="0" y1="0" y2="1">
                  <Stop offset="0" stopColor={COLORS.action} stopOpacity="0.32" />
                  <Stop offset="0.62" stopColor={COLORS.primary} stopOpacity="0.14" />
                  <Stop offset="1" stopColor={COLORS.primary} stopOpacity="0.02" />
                </LinearGradient>
              </Defs>
              {[0.25, 0.5, 0.75].map((ratio) => (
                <Line
                  key={ratio}
                  opacity={0.52}
                  stroke={COLORS.border}
                  strokeWidth={1}
                  x1={HORIZONTAL_PADDING}
                  x2={chartWidth - HORIZONTAL_PADDING}
                  y1={TOP_PADDING + plotHeight * ratio}
                  y2={TOP_PADDING + plotHeight * ratio}
                />
              ))}
              {metric === 'steps' ? (
                <Line
                  stroke={COLORS.border}
                  strokeDasharray="5 7"
                  strokeWidth={1.5}
                  x1={HORIZONTAL_PADDING}
                  x2={chartWidth - HORIZONTAL_PADDING}
                  y1={goalY}
                  y2={goalY}
                />
              ) : null}
              {points.map((point, index) => {
                const entry = history[index];
                const sessionSteps = sessionSums[entry.date] ?? 0;
                const height = Math.max(sessionSteps > 0 ? 4 : 0, plotHeight * Math.min(sessionSteps / chartRange, 1));

                if (sessionSteps <= 0) {
                  return null;
                }

                return (
                  <Rect
                    fill={COLORS.challenge}
                    key={`${entry.date}-session`}
                    opacity={0.78}
                    rx={3}
                    width={8}
                    x={point.x - 4}
                    y={baseline - height}
                    height={height}
                  />
                );
              })}
              <Path d={areaPath} fill="url(#stepArea)" />
              <Path d={linePath} fill="none" opacity={0.16} stroke={COLORS.action} strokeLinecap="round" strokeLinejoin="round" strokeWidth={12} />
              <Path d={linePath} fill="none" stroke={COLORS.action} strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} />
              {points.map((point, index) => {
                const entry = history[index];
                const reachedGoal = metric === 'steps' && entry.steps >= goal;

                return (
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    fill={reachedGoal ? COLORS.success : COLORS.surface}
                    key={entry.date}
                    r={5}
                    stroke={reachedGoal ? COLORS.success : COLORS.action}
                    strokeWidth={3}
                  />
                );
              })}
            </Svg>

            <View style={styles.axis}>
              {history.map((entry) => (
                <View key={entry.date} style={styles.axisItem}>
                  <Text style={styles.day}>{entry.dayName}</Text>
                  <Text style={styles.steps}>{formatCompactSteps(getEntryValue(entry, metric, paceByDate))}</Text>
                  {(sessionSums[entry.date] ?? 0) > 0 ? (
                    <Text style={styles.sessionSteps}>{formatCompactSteps(sessionSums[entry.date])}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    </View>
  );
};

const getEntryValue = (entry: StepHistoryEntry, metric: 'pace' | 'steps', paceByDate: Record<string, number>): number =>
  metric === 'steps' ? entry.steps : (paceByDate[entry.date] ?? 0);

const styles = StyleSheet.create({
  wrapper: {
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '900',
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  goal: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  chartFrame: {
    minHeight: CHART_HEIGHT,
    overflow: 'visible',
  },
  scrollContent: {
    paddingRight: 4,
  },
  chartCanvas: {
    gap: 8,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: POINT_GAP,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  axisItem: {
    alignItems: 'center',
    gap: 4,
    minWidth: POINT_WIDTH,
  },
  day: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  steps: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '700',
  },
  sessionSteps: {
    color: COLORS.challenge,
    fontSize: 10,
    fontWeight: '800',
  },
});
