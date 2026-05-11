import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { HistoryBars } from '../src/components/HistoryBars';
import { COLORS } from '../src/constants';
import { readLastSevenDays, StepHistoryEntry } from '../src/storage/stepStorage';

export default function HistoryScreen() {
  const [history, setHistory] = useState<StepHistoryEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadHistory = async (): Promise<void> => {
        const entries = await readLastSevenDays();
        if (isActive) {
          setHistory(entries);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Text style={styles.title}>Last 7 Days</Text>
        <View style={styles.chartSurface}>
          <HistoryBars history={history} />
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    gap: 22,
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '900',
  },
  chartSurface: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 18,
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
});
