import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/auth/AuthContext';
import { AnimatedStepCount } from '../src/components/AnimatedStepCount';
import { AppScreen } from '../src/components/layout/AppScreen';
import { PageHeader } from '../src/components/layout/PageHeader';
import { ProgressRing } from '../src/components/ProgressRing';
import { RevealView } from '../src/components/RevealView';
import { StatusBadge } from '../src/components/StatusBadge';
import { ToastMessageItem, ToastStack } from '../src/components/ToastMessage';
import { AppButton } from '../src/components/ui/AppButton';
import { MetricCard } from '../src/components/ui/MetricCard';
import { SurfacePanel } from '../src/components/ui/SurfacePanel';
import { COLORS, DEFAULT_GOAL } from '../src/constants';
import { useDailyStepSync } from '../src/hooks/useDailyStepSync';
import { useStepCounter } from '../src/hooks/useStepCounter';
import { readGoal } from '../src/storage/stepStorage';
import { getStepSourceLabel } from '../src/utils/stepSource';
import { formatNullableTime } from '../src/utils/timeFormat';
import { appendToastMessage } from '../src/utils/toastQueue';

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
  const showServerToast = useCallback((message: string, variant: ToastMessageItem['variant'] = 'standard'): void => {
    setServerToastMessages((currentMessages) => appendToastMessage(currentMessages, { message, variant }));
  }, []);
  const { isSyncing: isSavingToFirestore, syncNow: saveDailyStepsToFirestore } = useDailyStepSync({
    goal,
    onMessage: showServerToast,
    source,
    steps: todaySteps,
    userId: user?.uid ?? null,
  });

  const handleRefreshSteps = async (): Promise<void> => {
    const message = await refreshSteps();
    showToast(message, 'success');
    setProgressResetKey((currentKey) => currentKey + 1);
    setStepReplayKey((currentKey) => currentKey + 1);
  };

  const handleSaveToFirestore = async (): Promise<void> => {
    await saveDailyStepsToFirestore();
  };

  const showToast = (message: string, variant: ToastMessageItem['variant'] = 'success'): void => {
    setToastMessages((currentMessages) => appendToastMessage(currentMessages, { message, variant }));
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
    <AppScreen
      contentStyle={styles.container}
      overlays={(
        <>
          <ToastStack messages={toastMessages} onHide={hideToast} />
          <ToastStack messages={serverToastMessages} onHide={hideServerToast} placement="center" />
        </>
      )}
    >
        <PageHeader subtitle="Combined Mode" title={displayName} />

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

          <AppButton
            accessibilityLabel="Refresh Google Fit step data"
            busy={isRefreshing}
            icon="refresh-outline"
            label="Refresh steps"
            onPress={() => {
              void handleRefreshSteps();
            }}
          />

          <AppButton
            accessibilityLabel="Save current step data to Firestore"
            busy={isSavingToFirestore}
            icon="server-outline"
            label="Save to Firestore"
            onPress={() => {
              void handleSaveToFirestore();
            }}
            variant="secondary"
          />

          {hasReachedGoal ? (
            <View style={styles.goalBanner}>
              <Text style={styles.goalBannerText}>Daily goal reached. Beautiful work.</Text>
            </View>
          ) : null}
        </RevealView>

        <RevealView delay={80} replayKey={stepReplayKey} style={styles.statsGrid}>
          <StatCard label="Progress" value={`${progressPercent.toFixed(2)}%`} />
          <StatCard label="Remaining" value={remainingSteps === 0 ? 'Done' : remainingSteps.toLocaleString()} />
          <StatCard label="Source" value={getStepSourceLabel(source)} />
          <StatCard label="Synced" value={formatNullableTime(lastSyncedAt)} />
        </RevealView>

        <RevealView delay={140} replayKey={stepReplayKey}>
        <SurfacePanel style={styles.syncPanel} tone="primary">
          <View style={styles.syncIcon}>
            <Ionicons color={COLORS.primary} name={isSystemTotalAvailable ? 'fitness-outline' : 'cloud-download-outline'} size={20} />
          </View>
          <View style={styles.syncCopy}>
            <Text style={styles.syncTitle}>{isSystemTotalAvailable ? 'Health data connected' : 'Google Fit sync'}</Text>
            <Text style={styles.syncText}>{debugMessage}</Text>
          </View>
        </SurfacePanel>
        </RevealView>

        <RevealView delay={190} replayKey={stepReplayKey}>
        <SurfacePanel>
          <View style={styles.sourceHeader}>
            <Text style={styles.sourceTitle}>Health data source</Text>
            <Text style={styles.sourceSubtitle}>Combined view uses the best available source without starting duplicate health readers.</Text>
          </View>
          <View style={styles.sourceGrid}>
            <StatCard label="Combined" value={todaySteps.toLocaleString()} />
            <StatCard label="Health total" value={isSystemTotalAvailable ? todaySteps.toLocaleString() : 'No data'} />
            <StatCard label="Health source" value={getStepSourceLabel(source)} />
            <StatCard label="Health synced" value={formatNullableTime(lastSyncedAt)} />
          </View>
          <View style={styles.sourceStatus}>
            <Ionicons color={COLORS.primary} name={isSystemTotalAvailable ? 'pulse-outline' : 'warning-outline'} size={18} />
            <Text style={styles.sourceStatusText}>
              {debugMessage}
            </Text>
          </View>
        </SurfacePanel>
        </RevealView>
    </AppScreen>
  );
}

type StatCardProps = {
  label: string;
  value: string;
};

const StatCard = ({ label, value }: StatCardProps) => (
  <MetricCard label={label} style={styles.statCard} value={value}>
    <FormattedStatValue value={value} />
  </MetricCard>
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

const styles = StyleSheet.create({
  container: {
    gap: 18,
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
    minHeight: 82,
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
    flexDirection: 'row',
    gap: 12,
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
});
