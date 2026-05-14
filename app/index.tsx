import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthContext';
import { AnimatedPressable } from '../src/components/AnimatedPressable';
import { AnimatedStepCount } from '../src/components/AnimatedStepCount';
import { ProgressRing } from '../src/components/ProgressRing';
import { RevealView } from '../src/components/RevealView';
import { StatusBadge } from '../src/components/StatusBadge';
import { ToastMessageItem, ToastStack } from '../src/components/ToastMessage';
import { COLORS, DEFAULT_GOAL } from '../src/constants';
import {
  getDailyChallengeStats,
  readDailyStepsFromFirestore,
  syncDailySteps,
} from '../src/firebase/stepsSync';
import { StepDataSource } from '../src/health/types';
import { useStepCounter } from '../src/hooks/useStepCounter';
import { getTodayString, readChallengeSessions, readGoal } from '../src/storage/stepStorage';

export default function HomeScreen() {
  const {
    debugMessage,
    isAvailable,
    isRefreshing,
    isSystemTotalAvailable,
    lastSyncedAt,
    refreshSteps,
    source,
    status,
    todaySteps,
  } = useStepCounter('combined');
  const { user } = useAuth();
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [progressResetKey, setProgressResetKey] = useState(0);
  const [stepReplayKey, setStepReplayKey] = useState(0);
  const [toastMessages, setToastMessages] = useState<ToastMessageItem[]>([]);
  const [serverToastMessages, setServerToastMessages] = useState<ToastMessageItem[]>([]);
  const [isSavingToFirestore, setIsSavingToFirestore] = useState(false);
  const hasSyncedOnOpenRef = useRef(false);
  const latestSyncSnapshotRef = useRef<DailySyncSnapshot>({
    goal,
    source,
    steps: todaySteps,
    userId: user?.uid ?? null,
  });

  useEffect(() => {
    latestSyncSnapshotRef.current = {
      goal,
      source,
      steps: todaySteps,
      userId: user?.uid ?? null,
    };
  }, [goal, source, todaySteps, user]);

  const syncDailySnapshotToFirestore = useCallback(async (
    snapshot: DailySyncSnapshot,
    options: { notify: boolean; showNoChanges?: boolean } = { notify: false },
  ): Promise<void> => {
    if (snapshot.userId === null || snapshot.steps === 0) {
      if (options.notify) {
        showServerToast(snapshot.userId === null ? 'Sign in before saving to Firestore.' : 'No steps to save yet.', 'error');
      }
      return;
    }

    const today = getTodayString();
    const sessions = await readChallengeSessions(today);
    const challengeStats = getDailyChallengeStats(sessions);
    const existingDailySteps = await readDailyStepsFromFirestore(snapshot.userId, [today]);
    const existing = existingDailySteps[today];

    if (existing !== undefined && hasNoDailyStepChanges(existing, {
      ...challengeStats,
      goal: snapshot.goal,
      source: snapshot.source,
      steps: snapshot.steps,
    })) {
      if (options.notify && options.showNoChanges) {
        showServerToast('No changes to save.', 'standard');
      }
      return;
    }

    const result = await syncDailySteps({
      ...challengeStats,
      date: today,
      goal: snapshot.goal,
      source: snapshot.source,
      steps: snapshot.steps,
      userId: snapshot.userId,
    });

    if (options.notify) {
      showServerToast(result.message, result.ok ? 'standard' : 'error');
    }
  }, []);

  useEffect(() => {
    if (hasSyncedOnOpenRef.current || user === null || todaySteps === 0) {
      return;
    }

    hasSyncedOnOpenRef.current = true;
    void syncDailySnapshotToFirestore(latestSyncSnapshotRef.current);
  }, [syncDailySnapshotToFirestore, todaySteps, user]);

  useEffect(() => {
    let appState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const wasBackgrounded = appState === 'background' || appState === 'inactive';
      const willBackground = nextAppState === 'background' || nextAppState === 'inactive';

      if ((wasBackgrounded && nextAppState === 'active') || willBackground) {
        void syncDailySnapshotToFirestore(latestSyncSnapshotRef.current);
      }

      appState = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [syncDailySnapshotToFirestore]);

  const handleRefreshSteps = async (): Promise<void> => {
    const message = await refreshSteps();
    showToast(message, 'success');
    setProgressResetKey((currentKey) => currentKey + 1);
    setStepReplayKey((currentKey) => currentKey + 1);
  };

  const handleSaveToFirestore = async (): Promise<void> => {
    setIsSavingToFirestore(true);
    await syncDailySnapshotToFirestore(latestSyncSnapshotRef.current, { notify: true, showNoChanges: true });
    setIsSavingToFirestore(false);
  };

  const showToast = (message: string, variant: ToastMessageItem['variant'] = 'success'): void => {
    setToastMessages((currentMessages) => [...currentMessages, { id: Date.now() + currentMessages.length, message, variant }]);
  };

  const showServerToast = (message: string, variant: ToastMessageItem['variant'] = 'standard'): void => {
    setServerToastMessages((currentMessages) => [...currentMessages, { id: Date.now() + currentMessages.length, message, variant }]);
  };

  const hideToast = (id: number): void => {
    setToastMessages((currentMessages) => currentMessages.filter((message) => message.id !== id));
  };

  const hideServerToast = (id: number): void => {
    setServerToastMessages((currentMessages) => currentMessages.filter((message) => message.id !== id));
  };

  useFocusEffect(
    useCallback(() => {
      const loadGoal = async (): Promise<void> => {
        setGoal(await readGoal());
      };

      void loadGoal();
      setProgressResetKey((currentKey) => currentKey + 1);
      setStepReplayKey((currentKey) => currentKey + 1);
    }, []),
  );

  const hasReachedGoal = todaySteps >= goal;
  const remainingSteps = Math.max(0, goal - todaySteps);
  const rawPercent = goal > 0 ? (todaySteps / goal) * 100 : 0;
  const progressPercent = Math.min(100, rawPercent);
  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'there';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>Combined Mode</Text>
            <Text style={styles.appName}>{displayName}</Text>
          </View>
        </View>

        <RevealView replayKey={stepReplayKey} style={styles.hero}>
          <ProgressRing goal={goal} resetAnimationKey={progressResetKey} steps={todaySteps} />
          <View style={styles.stepBlock}>
            <AnimatedStepCount replayKey={stepReplayKey} steps={todaySteps} style={styles.stepCount} />
            <Text style={styles.stepLabel}>steps today</Text>
          </View>
          <Text style={styles.goalText}>Goal {goal.toLocaleString()}</Text>

          <View style={styles.statusRow}>
            {isAvailable ? <StatusBadge status={status} /> : <Text style={styles.unsupported}>Waiting for step data</Text>}
          </View>

          <AnimatedPressable
            accessibilityLabel="Refresh Google Fit step data"
            accessibilityRole="button"
            disabled={isRefreshing}
            onPress={() => {
              void handleRefreshSteps();
            }}
            style={({ pressed }) => [styles.refreshButton, isRefreshing ? styles.refreshing : null, pressed ? styles.pressed : null]}
          >
            {isRefreshing ? <ActivityIndicator color={COLORS.surface} /> : <Ionicons color={COLORS.surface} name="refresh-outline" size={18} />}
            <Text style={styles.refreshButtonText}>{isRefreshing ? 'Refreshing' : 'Refresh steps'}</Text>
          </AnimatedPressable>

          <AnimatedPressable
            accessibilityLabel="Save current step data to Firestore"
            accessibilityRole="button"
            disabled={isSavingToFirestore}
            onPress={() => {
              void handleSaveToFirestore();
            }}
            style={({ pressed }) => [styles.saveButton, isSavingToFirestore ? styles.refreshing : null, pressed ? styles.pressed : null]}
          >
            {isSavingToFirestore ? <ActivityIndicator color={COLORS.surface} /> : <Ionicons color={COLORS.surface} name="server-outline" size={18} />}
            <Text style={styles.refreshButtonText}>{isSavingToFirestore ? 'Saving' : 'Save to Firestore'}</Text>
          </AnimatedPressable>

          {hasReachedGoal ? (
            <View style={styles.goalBanner}>
              <Text style={styles.goalBannerText}>Daily goal reached. Beautiful work.</Text>
            </View>
          ) : null}
        </RevealView>

        <RevealView delay={80} replayKey={stepReplayKey} style={styles.statsGrid}>
          <StatCard label="Progress" value={`${progressPercent.toFixed(2)}%`} />
          <StatCard label="Remaining" value={remainingSteps === 0 ? 'Done' : remainingSteps.toLocaleString()} />
          <StatCard label="Source" value={getSourceLabel(source)} />
          <StatCard label="Synced" value={formatSyncTime(lastSyncedAt)} />
        </RevealView>

        <RevealView delay={140} replayKey={stepReplayKey} style={styles.syncPanel}>
          <View style={styles.syncIcon}>
            <Ionicons color={COLORS.primary} name={isSystemTotalAvailable ? 'fitness-outline' : 'cloud-download-outline'} size={20} />
          </View>
          <View style={styles.syncCopy}>
            <Text style={styles.syncTitle}>{isSystemTotalAvailable ? 'Health data connected' : 'Google Fit sync'}</Text>
            <Text style={styles.syncText}>{debugMessage}</Text>
          </View>
        </RevealView>

        <RevealView delay={190} replayKey={stepReplayKey} style={styles.sourcePanel}>
          <View style={styles.sourceHeader}>
            <Text style={styles.sourceTitle}>Health data source</Text>
            <Text style={styles.sourceSubtitle}>Combined view uses the best available source without starting duplicate health readers.</Text>
          </View>
          <View style={styles.sourceGrid}>
            <StatCard label="Combined" value={todaySteps.toLocaleString()} />
            <StatCard label="Health total" value={isSystemTotalAvailable ? todaySteps.toLocaleString() : 'No data'} />
            <StatCard label="Health source" value={getSourceLabel(source)} />
            <StatCard label="Health synced" value={formatSyncTime(lastSyncedAt)} />
          </View>
          <View style={styles.sourceStatus}>
            <Ionicons color={COLORS.primary} name={isSystemTotalAvailable ? 'pulse-outline' : 'warning-outline'} size={18} />
            <Text style={styles.sourceStatusText}>
              {debugMessage}
            </Text>
          </View>
        </RevealView>
      </ScrollView>
      <ToastStack messages={toastMessages} onHide={hideToast} />
      <ToastStack messages={serverToastMessages} onHide={hideServerToast} placement="center" />
    </SafeAreaView>
  );
}

type StatCardProps = {
  label: string;
  value: string;
};

const StatCard = ({ label, value }: StatCardProps) => (
  <View style={styles.statCard}>
    <Text style={styles.statLabel}>{label}</Text>
    <FormattedStatValue value={value} />
  </View>
);

type FormattedStatValueProps = {
  value: string;
};

const FormattedStatValue = ({ value }: FormattedStatValueProps) => {
  const match = value.match(/^(\d+)\.(\d+)(%?)$/);

  if (match === null) {
    return <Text style={styles.statValue}>{value}</Text>;
  }

  return (
    <Text style={styles.statValue}>
      {match[1]}
      <Text style={styles.statValueDecimal}>{`.${match[2]}`}</Text>
      <Text style={styles.statValueSuffix}>{match[3]}</Text>
    </Text>
  );
};

const getSourceLabel = (source: StepDataSource): string => {
  if (source === 'apple-health') {
    return 'Apple Health';
  }

  if (source === 'health-connect') {
    return 'Health Connect';
  }

  if (source === 'live-sensor') {
    return 'Live sensor';
  }

  return 'Local';
};

const formatSyncTime = (lastSyncedAt: string | null): string => {
  if (lastSyncedAt === null) {
    return 'Not yet';
  }

  return new Date(lastSyncedAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
};

type ExistingDailySteps = Awaited<ReturnType<typeof readDailyStepsFromFirestore>>[string];

type DailySyncSnapshot = {
  goal: number;
  source: StepDataSource;
  steps: number;
  userId: string | null;
};

type ComparableDailySteps = {
  challengeSessionCount: number;
  firstChallengeAt: string | null;
  goal: number;
  lastChallengeAt: string | null;
  paceStepsPerMinute: number;
  source: StepDataSource;
  steps: number;
  walkingTimeMs: number;
};

const hasNoDailyStepChanges = (existing: ExistingDailySteps, next: ComparableDailySteps): boolean =>
  existing.steps === Math.max(0, Math.floor(next.steps))
  && (existing.goal ?? 0) === next.goal
  && existing.source === next.source
  && (existing.challengeSessionCount ?? 0) === next.challengeSessionCount
  && (existing.firstChallengeAt ?? null) === next.firstChallengeAt
  && (existing.lastChallengeAt ?? null) === next.lastChallengeAt
  && (existing.paceStepsPerMinute ?? 0) === Math.max(0, Math.floor(next.paceStepsPerMinute))
  && (existing.walkingTimeMs ?? 0) === Math.max(0, Math.floor(next.walkingTimeMs));

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appName: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    marginBottom: 4,
    color: COLORS.mutedText,
    fontSize: 14,
    fontWeight: '700',
  },
  hero: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 8,
  },
  stepBlock: {
    alignItems: 'center',
    gap: 4,
  },
  stepCount: {
    color: COLORS.action,
    fontSize: 56,
    fontWeight: '900',
  },
  stepLabel: {
    color: COLORS.mutedText,
    fontSize: 16,
    fontWeight: '700',
  },
  goalText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  statusRow: {
    minHeight: 38,
    justifyContent: 'center',
  },
  unsupported: {
    color: COLORS.warning,
    fontSize: 14,
    fontWeight: '800',
  },
  refreshButton: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.action,
  },
  saveButton: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.stopped,
  },
  refreshButtonText: {
    color: COLORS.surface,
    fontSize: 15,
    fontWeight: '900',
  },
  goalBanner: {
    width: '100%',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.successSoft,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  goalBannerText: {
    color: COLORS.success,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48%',
    minHeight: 82,
    borderRadius: 8,
    padding: 14,
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  statValue: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '900',
  },
  statValueDecimal: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '900',
  },
  statValueSuffix: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '900',
  },
  syncPanel: {
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  syncIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  syncCopy: {
    flex: 1,
    gap: 4,
  },
  syncTitle: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  syncText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  sourcePanel: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  sourceHeader: {
    gap: 3,
  },
  sourceTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sourceSubtitle: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  sourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sourceStatus: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  sourceStatusText: {
    color: COLORS.text,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  refreshing: {
    opacity: 0.9,
  },
  pressed: {
    opacity: 0.84,
  },
});
