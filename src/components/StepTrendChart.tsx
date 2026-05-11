import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { COLORS } from '../constants';
import { StepHistoryEntry } from '../storage/stepStorage';

type StepTrendChartProps = {
  goal: number;
  history: StepHistoryEntry[];
};

const CHART_HEIGHT = 190;
const CHART_WIDTH = 320;
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

export const StepTrendChart = ({ goal, history }: StepTrendChartProps) => {
  const maxSteps = Math.max(goal, ...history.map((entry) => entry.steps), 1);
  const chartRange = Math.max(maxSteps * 1.15, 1);
  const plotWidth = CHART_WIDTH - HORIZONTAL_PADDING * 2;
  const plotHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;
  const pointSpacing = history.length > 1 ? plotWidth / (history.length - 1) : 0;
  const points = history.map((entry, index) => ({
    x: HORIZONTAL_PADDING + pointSpacing * index,
    y: TOP_PADDING + plotHeight * (1 - Math.min(entry.steps / chartRange, 1)),
  }));
  const goalY = TOP_PADDING + plotHeight * (1 - Math.min(goal / chartRange, 1));
  const linePath = createLinePath(points);
  const areaPath = createAreaPath(points);

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.title}>Step trend</Text>
        <Text style={styles.goal}>{formatCompactSteps(goal)} goal</Text>
      </View>

      <View style={styles.chartFrame}>
        <Svg height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} width="100%">
          <Defs>
            <LinearGradient id="stepArea" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor={COLORS.primary} stopOpacity="0.24" />
              <Stop offset="1" stopColor={COLORS.primary} stopOpacity="0.03" />
            </LinearGradient>
          </Defs>
          <Line
            stroke={COLORS.border}
            strokeDasharray="5 7"
            strokeWidth={1.5}
            x1={HORIZONTAL_PADDING}
            x2={CHART_WIDTH - HORIZONTAL_PADDING}
            y1={goalY}
            y2={goalY}
          />
          <Path d={areaPath} fill="url(#stepArea)" />
          <Path d={linePath} fill="none" stroke={COLORS.primary} strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} />
          {points.map((point, index) => {
            const entry = history[index];
            const reachedGoal = entry.steps >= goal;

            return (
              <Circle
                cx={point.x}
                cy={point.y}
                fill={reachedGoal ? COLORS.success : COLORS.surface}
                key={entry.date}
                r={5}
                stroke={reachedGoal ? COLORS.success : COLORS.primary}
                strokeWidth={3}
              />
            );
          })}
        </Svg>
      </View>

      <View style={styles.axis}>
        {history.map((entry) => (
          <View key={entry.date} style={styles.axisItem}>
            <Text style={styles.day}>{entry.dayName}</Text>
            <Text style={styles.steps}>{formatCompactSteps(entry.steps)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

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
  goal: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  chartFrame: {
    minHeight: CHART_HEIGHT,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  axisItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
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
});
