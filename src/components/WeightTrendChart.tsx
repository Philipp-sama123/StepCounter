import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { COLORS } from '../constants';
import { getBmi, UserBodyProfile, WeightEntry } from '../storage/profileStorage';

type WeightTrendChartProps = {
  entries: WeightEntry[];
  profile: UserBodyProfile | null;
};

const CHART_HEIGHT = 118;
const MIN_CHART_WIDTH = 300;
const POINT_WIDTH = 58;
const HORIZONTAL_PADDING = 18;
const TOP_PADDING = 16;
const BOTTOM_PADDING = 24;

export const WeightTrendChart = ({ entries, profile }: WeightTrendChartProps) => {
  const bmi = profile === null ? 0 : getBmi(profile.heightCm, profile.currentWeightKg);
  const chartWidth = Math.max(MIN_CHART_WIDTH, entries.length * POINT_WIDTH);
  const plotWidth = chartWidth - HORIZONTAL_PADDING * 2;
  const plotHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;
  const weights = [
    ...entries.map((entry) => entry.weightKg),
    ...(profile !== null && profile.currentWeightKg > 0 ? [profile.currentWeightKg] : []),
  ];
  const minWeight = weights.length > 0 ? Math.min(...weights) : 0;
  const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;
  const range = Math.max(1, maxWeight - minWeight);
  const pointSpacing = entries.length > 1 ? plotWidth / (entries.length - 1) : 0;
  const points = entries.map((entry, index) => ({
    x: HORIZONTAL_PADDING + pointSpacing * index,
    y: TOP_PADDING + plotHeight * (1 - (entry.weightKg - minWeight) / range),
  }));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[styles.chartCanvas, { width: chartWidth }]}>
            <Svg height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`} width={chartWidth}>
              <Path d={linePath} fill="none" stroke={COLORS.action} strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} />
              {points.map((point, index) => (
                <Circle
                  cx={point.x}
                  cy={point.y}
                  fill={COLORS.surface}
                  key={entries[index].date}
                  r={5}
                  stroke={COLORS.action}
                  strokeWidth={3}
                />
              ))}
            </Svg>
            <View style={styles.axis}>
              {entries.map((entry) => (
                <View key={entry.date} style={styles.axisItem}>
                  <Text style={styles.day}>{formatShortDate(entry.date)}</Text>
                  <Text style={styles.weight}>{`${entry.weightKg.toLocaleString()} kg`}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Add height and weight in your profile to start the graph.</Text>
        </View>
      )}
    </View>
  );
};

const formatShortDate = (date: string): string => new Date(date).toLocaleDateString(undefined, {
  day: 'numeric',
  month: 'short',
});

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
