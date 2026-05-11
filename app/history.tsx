import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { StepTrendChart } from '../src/components/StepTrendChart';
import { COLORS, DEFAULT_GOAL } from '../src/constants';
import { readGoal, readLastSevenDays, StepHistoryEntry } from '../src/storage/stepStorage';

export default function HistoryScreen() {
  const [history, setHistory] = useState<StepHistoryEntry[]>([]);
  const [goal, setGoal] = useState(DEFAULT_GOAL);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadHistory = async (): Promise<void> => {
        const [entries, storedGoal] = await Promise.all([readLastSevenDays(), readGoal()]);
        if (isActive) {
          setHistory(entries);
          setGoal(storedGoal);
        }
      };

      void loadHistory();

      return () => {
        isActive = false;
      };
    }, []),
  );

  const weeklyTotal = history.reduce((total, entry) => total + entry.steps, 0);
  const average = history.length > 0 ? Math.round(weeklyTotal / history.length) : 0;
  const bestDay = history.reduce<StepHistoryEntry | null>(
    (bestEntry, entry) => (bestEntry === null || entry.steps > bestEntry.steps ? entry : bestEntry),
    null,
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Last 7 Days</Text>
        <View style={styles.chartSurface}>
          <StepTrendChart goal={goal} history={history} />
        </View>
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Weekly total</Text>
            <Text style={styles.summaryValue}>{weeklyTotal.toLocaleString()}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Daily average</Text>
            <Text style={styles.summaryValue}>{average.toLocaleString()}</Text>
          </View>
        </View>
        <View style={styles.insight}>
          <Text style={styles.insightLabel}>Best day</Text>
          <Text style={styles.insightValue}>
            {bestDay === null ? 'No steps yet' : `${bestDay.dayName} · ${bestDay.steps.toLocaleString()} steps`}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 22,
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '900',
  },
  chartSurface: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summary: {
    borderRadius: 8,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryItem: {
    flex: 1,
    gap: 6,
  },
  summaryLabel: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '900',
  },
  divider: {
    width: 1,
    height: 44,
    marginHorizontal: 16,
    backgroundColor: COLORS.border,
  },
  insight: {
    borderRadius: 8,
    padding: 18,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 6,
  },
  insightLabel: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  insightValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
  },
});
