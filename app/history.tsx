import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StepTrendChart } from '../src/components/StepTrendChart';
import { COLORS, DEFAULT_GOAL } from '../src/constants';
import { readGoal, readLastSevenDays, readChallengeSessions, StepHistoryEntry } from '../src/storage/stepStorage';

export default function HistoryScreen() {
  const [history, setHistory] = useState<StepHistoryEntry[]>([]);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [sessionSums, setSessionSums] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadHistory = async (): Promise<void> => {
        const [entries, storedGoal] = await Promise.all([readLastSevenDays(), readGoal()]);

        if (!isActive) return;

        // Load challenge session sums for each date in parallel
        const sessionPromises = entries.map((e) => readChallengeSessions(e.date));
        const sessionResults = await Promise.all(sessionPromises);
        const sums: Record<string, number> = {};
        sessionResults.forEach((arr, idx) => {
          const total = arr.reduce((t, s) => t + s.steps, 0);
          sums[entries[idx].date] = total;
        });

        if (isActive) {
          setHistory(entries);
          setGoal(storedGoal);
          setSessionSums(sums);
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
  const goalDays = history.filter((entry) => entry.steps >= goal).length;
  const activeDays = history.filter((entry) => entry.steps > 0).length;
  const consistency = history.length > 0 ? Math.round((activeDays / history.length) * 100) : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Statistics</Text>
          <Text style={styles.subtitle}>Last 7 days</Text>
        </View>

        <View style={styles.chartSurface}>
          <StepTrendChart goal={goal} history={history} />
        </View>

        <View style={styles.metricGrid}>
          <MetricCard label="Weekly total" value={weeklyTotal.toLocaleString()} />
          <MetricCard label="Daily average" value={average.toLocaleString()} />
          <MetricCard label="Goal days" value={`${goalDays}/${history.length}`} />
          <MetricCard label="Consistency" value={`${consistency}%`} />
        </View>

        <View style={styles.insight}>
          <Text style={styles.insightLabel}>Best day</Text>
          <Text style={styles.insightValue}>
            {bestDay === null || bestDay.steps === 0 ? 'No steps yet' : `${bestDay.dayName} · ${bestDay.steps.toLocaleString()} steps`}
          </Text>
        </View>

        <View style={styles.list}>
          {history.map((entry) => {
            const progress = Math.min(1, entry.steps / goal);
            const reachedGoal = entry.steps >= goal;

            return (
              <View key={entry.date} style={styles.dayRow}>
                <View style={styles.dayCopy}>
                  <Text style={styles.dayName}>{entry.dayName}</Text>
                  <Text style={styles.dayDate}>{entry.date}</Text>
                </View>
                <View style={styles.dayProgress}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, reachedGoal ? styles.successFill : null, { width: `${progress * 100}%` }]} />
                  </View>
                  <Text style={styles.daySteps}>{entry.steps.toLocaleString()}</Text>
                  {sessionSums[entry.date] > 0 ? (
                    <Text style={styles.sessionNote}>{`+${sessionSums[entry.date].toLocaleString()} from sessions`}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
};

const MetricCard = ({ label, value }: MetricCardProps) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 18,
  },
  header: {
    gap: 4,
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: 14,
    fontWeight: '800',
  },
  chartSurface: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    minHeight: 86,
    borderRadius: 8,
    padding: 14,
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricLabel: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
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
  list: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  dayRow: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dayCopy: {
    width: 74,
    gap: 3,
  },
  dayName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  dayDate: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '700',
  },
  dayProgress: {
    flex: 1,
    gap: 7,
  },
  progressTrack: {
    height: 9,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: COLORS.barSoft,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: COLORS.bar,
  },
  successFill: {
    backgroundColor: COLORS.success,
  },
  daySteps: {
    color: COLORS.text,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '900',
  },
  sessionNote: {
    color: COLORS.mutedText,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '700',
  },
});
