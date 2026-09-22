import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { useAuth } from '../../../auth/AuthContext';
import { AppScreen } from '../../../components/layout/AppScreen';
import { PageHeader } from '../../../components/layout/PageHeader';
import { RevealView } from '../../../components/RevealView';
import { SegmentedTabs } from '../../../components/SegmentedTabs';
import { AppButton } from '../../../components/ui/AppButton';
import { MetricCard } from '../../../components/ui/MetricCard';
import { SurfacePanel } from '../../../components/ui/SurfacePanel';
import { loadStepHistory } from '../../steps/application/historyService';
import { syncTodayAndBackfill } from '../../steps/application/stepSyncService';
import { getTodayString } from '../../steps/infrastructure/localStepRepository';
import { StepTrendChart } from '../../steps/presentation/components/StepTrendChart';

import { styles } from './HistoryScreen.styles';

import type { StepHistorySource } from '../../steps/application/historyService';
import type { StepHistoryEntry } from '../../steps/domain/models';

type HistoryRange = 'month' | 'week';

const DAYS_BY_RANGE: Record<HistoryRange, number> = { month: 30, week: 7 };

export default function HistoryScreen() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<StepHistoryEntry[]>([]);
  const [goal, setGoal] = useState(10000);
  const [range, setRange] = useState<HistoryRange>('week');
  const [source, setSource] = useState<StepHistorySource>('local-cache');
  const [selectedDay, setSelectedDay] = useState<StepHistoryEntry | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async (): Promise<void> => {
    const snapshot = await loadStepHistory({ dayCount: DAYS_BY_RANGE[range], userId: user?.uid ?? null });
    setEntries(snapshot.entries);
    setGoal(snapshot.goal);
    setSource(snapshot.source);
  }, [range, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, reloadKey]),
  );

  const summary = useMemo(() => {
    const total = entries.reduce((value, entry) => value + entry.steps, 0);
    const bestDay = entries.reduce<StepHistoryEntry | null>(
      (best, entry) => (best === null || entry.steps > best.steps ? entry : best),
      null,
    );
    const goalDays = entries.filter((entry) => entry.steps >= goal).length;

    return { average: entries.length === 0 ? 0 : Math.round(total / entries.length), bestDay, goalDays, total };
  }, [entries, goal]);

  const handleSync = async (): Promise<void> => {
    setIsSyncing(true);
    try {
      const result = await syncTodayAndBackfill({ userId: user?.uid ?? null });
      setSyncMessage(result.message);
      setReloadKey((currentKey) => currentKey + 1);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <AppScreen
      contentStyle={styles.container}
      overlays={<DayDetailModal day={selectedDay} goal={goal} onClose={() => setSelectedDay(null)} />}
    >
      <PageHeader
        accessory={
          <AppButton
            accessibilityLabel="Sync step history"
            busy={isSyncing}
            icon="sync-outline"
            label="Sync"
            onPress={() => void handleSync()}
            style={styles.syncButton}
            variant="warning"
          />
        }
        subtitle={getSourceLabel(source)}
        title="History"
      />
      {syncMessage === null ? null : <Text style={styles.syncMessage}>{syncMessage}</Text>}

      <SegmentedTabs
        onChange={setRange}
        options={[
          { label: 'Week', value: 'week' },
          { label: 'Month', value: 'month' },
        ]}
        value={range}
      />

      <RevealView style={styles.metricGrid}>
        <MetricCard label="Total steps" value={summary.total.toLocaleString()} />
        <MetricCard label="Daily average" value={summary.average.toLocaleString()} />
        <MetricCard label="Goal days" value={`${summary.goalDays}/${entries.length}`} />
        <MetricCard label="Best day" value={summary.bestDay?.steps.toLocaleString() ?? '—'} />
      </RevealView>

      <RevealView delay={90}>
        <SurfacePanel style={styles.chartPanel}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Daily steps</Text>
              <Text style={styles.sectionSubtitle}>{`Goal: ${goal.toLocaleString()} steps`}</Text>
            </View>
            <Text style={styles.goalDays}>{`${summary.goalDays} goal days`}</Text>
          </View>
          <StepTrendChart animationKey={reloadKey} goal={goal} history={entries} onEntryPress={setSelectedDay} />
        </SurfacePanel>
      </RevealView>

      <RevealView delay={150} style={styles.list}>
        {entries
          .slice()
          .reverse()
          .map((entry) => (
            <Pressable key={entry.date} onPress={() => setSelectedDay(entry)} style={styles.dayRow}>
              <View>
                <Text style={styles.dayName}>{entry.date === getTodayString() ? 'Today' : entry.dayName}</Text>
                <Text style={styles.dayDate}>{entry.date}</Text>
              </View>
              <View style={styles.dayValue}>
                <Text style={styles.daySteps}>{entry.steps.toLocaleString()}</Text>
                <Text
                  style={styles.dayProgress}
                >{`${Math.round((entry.steps / Math.max(1, goal)) * 100)}% of goal`}</Text>
              </View>
            </Pressable>
          ))}
      </RevealView>
    </AppScreen>
  );
}

const getSourceLabel = (source: StepHistorySource): string => {
  switch (source) {
    case 'device-health':
      return 'Updated from device health';
    case 'firestore':
      return 'Synced from your account';
    case 'merged':
      return 'Device health and account synced';
    default:
      return 'Stored on this device';
  }
};

const DayDetailModal = ({
  day,
  goal,
  onClose,
}: {
  day: StepHistoryEntry | null;
  goal: number;
  onClose: () => void;
}) => (
  <Modal animationType="fade" transparent visible={day !== null} onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalBackdrop} />
      <View style={styles.modalCard}>
        <Text style={styles.modalEyebrow}>{day?.date === getTodayString() ? 'Today' : day?.dayName}</Text>
        <Text style={styles.modalValue}>{day?.steps.toLocaleString() ?? '0'}</Text>
        <Text style={styles.modalLabel}>steps</Text>
        <Text
          style={styles.modalProgress}
        >{`${Math.round(((day?.steps ?? 0) / Math.max(1, goal)) * 100)}% of your ${goal.toLocaleString()} goal`}</Text>
        <AppButton accessibilityLabel="Close day details" label="Close" onPress={onClose} />
      </View>
    </View>
  </Modal>
);
