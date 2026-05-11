import { StyleSheet, Text, View } from 'react-native';

import { BAR_MAX_HEIGHT, BAR_MIN_HEIGHT, COLORS } from '../constants';
import { StepHistoryEntry } from '../storage/stepStorage';

type HistoryBarsProps = {
  history: StepHistoryEntry[];
};

const getBarStyle = (height: number) =>
  StyleSheet.create({
    bar: {
      height,
    },
  }).bar;

export const HistoryBars = ({ history }: HistoryBarsProps) => {
  const maxSteps = Math.max(...history.map((entry) => entry.steps), 1);

  return (
    <View style={styles.chart}>
      {history.map((entry) => {
        const height = Math.max(BAR_MIN_HEIGHT, (entry.steps / maxSteps) * BAR_MAX_HEIGHT);

        return (
          <View key={entry.date} style={styles.column}>
            <Text style={styles.steps}>{entry.steps.toLocaleString()}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.bar, getBarStyle(height)]} />
            </View>
            <Text style={styles.day}>{entry.dayName}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  chart: {
    minHeight: 250,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  steps: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '700',
  },
  barTrack: {
    height: BAR_MAX_HEIGHT,
    width: '100%',
    borderRadius: 8,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.barSoft,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: COLORS.bar,
  },
  day: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '700',
  },
});
