import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';

import { useAuth } from '../../../auth/AuthContext';
import { AnimatedPressable } from '../../../components/AnimatedPressable';
import { AnimatedStepCount } from '../../../components/AnimatedStepCount';
import { DashboardAvatar } from '../../../components/avatar/DashboardAvatar';
import { AppScreen } from '../../../components/layout/AppScreen';
import { RevealView } from '../../../components/RevealView';
import { SegmentedTabs } from '../../../components/SegmentedTabs';
import { ToastStack } from '../../../components/ToastMessage';
import { SurfacePanel } from '../../../components/ui/SurfacePanel';
import { COLORS, DEFAULT_GOAL } from '../../../constants';
import { userScopedStorage as AsyncStorage } from '../../../platform/storage/userScopedStorage';
import { estimateWalkingCalories } from '../../../utils/calories';
import { triggerErrorHaptic, triggerSuccessHaptic } from '../../../utils/haptics';
import { appendToastMessage } from '../../../utils/toastQueue';
import { getAvatarStateForMotion } from '../../challenges/domain/motionActivity';
import { useMotionChallengeCounter } from '../../challenges/presentation/useMotionChallengeCounter';
import { getTodayString, readStepsForDate } from '../../steps/infrastructure/localStepRepository';
import { ProgressRing } from '../../steps/presentation/components/ProgressRing';
import { StatusBadge } from '../../steps/presentation/components/StatusBadge';
import { StepTrendChart } from '../../steps/presentation/components/StepTrendChart';
import { useDailyStepSync } from '../../steps/presentation/useDailyStepSync';
import { useStepCounter } from '../../steps/presentation/useStepCounter';
import {
  loadDashboardSnapshot,
  readDashboardGraph,
  readDashboardRecentHistory,
  readDashboardRangeTotals,
} from '../application/dashboardQueries';

import {
  DayDetailModal,
  HeaderActionButton,
  HeroDayButton,
  HistoryDayRow,
  RangeTotalCard,
  StatCard,
  TooltipCalcRow,
  clampDateToToday,
  formatShortDate,
  getCalorieMessage,
  getShortWeekday,
  shiftDate,
} from './DashboardScreen.components';
import { styles } from './DashboardScreen.styles';

import type { ToastMessageItem } from '../../../components/ToastMessage';
import type { UserBodyProfile } from '../../profile/domain/models';
import type { StepHistoryEntry } from '../../steps/domain/models';
import type { DashboardRange, DashboardRangeTotals as RangeTotals } from '../application/dashboardQueries';
const DASHBOARD_AVATAR_VISIBLE_KEY = 'dashboard:avatar-visible';

export default function HomeScreen() {
  const isFocused = useIsFocused();
  const { isAvailable, isRefreshing, isSystemTotalAvailable, refreshSteps, source, status, statusMessage, todaySteps } =
    useStepCounter('combined');
  const { user } = useAuth();
  const [bodyProfile, setBodyProfile] = useState<UserBodyProfile | null>(null);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [graphRange, setGraphRange] = useState<DashboardRange>('week');
  const [graphReplayKey, setGraphReplayKey] = useState(0);
  const [graphHistory, setGraphHistory] = useState<StepHistoryEntry[]>([]);
  const [history, setHistory] = useState<StepHistoryEntry[]>([]);
  const [rangeTotals, setRangeTotals] = useState<RangeTotals>({ month: 0, week: 0, year: 0 });
  const [isCalorieTooltipVisible, setIsCalorieTooltipVisible] = useState(false);
  const [progressResetKey, setProgressResetKey] = useState(0);
  const [isDashboardAvatarVisible, setIsDashboardAvatarVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<StepHistoryEntry | null>(null);
  const [selectedHeroDate, setSelectedHeroDate] = useState(getTodayString());
  const [selectedHeroSteps, setSelectedHeroSteps] = useState(0);
  const [stepReplayKey, setStepReplayKey] = useState(0);
  const [toastMessages, setToastMessages] = useState<ToastMessageItem[]>([]);
  const [serverToastMessages, setServerToastMessages] = useState<ToastMessageItem[]>([]);
  const graphRangeRef = useRef<DashboardRange>(graphRange);
  const todayStepsRef = useRef(todaySteps);
  const avatarMotion = useMotionChallengeCounter({
    active: false,
    debugEnabled: false,
    enabled: isFocused && isDashboardAvatarVisible,
  });
  const showServerToast = useCallback((message: string, variant: ToastMessageItem['variant'] = 'standard'): void => {
    if (variant === 'error') {
      triggerErrorHaptic();
    } else {
      triggerSuccessHaptic();
    }

    setServerToastMessages((currentMessages) => appendToastMessage(currentMessages, { message, variant }));
  }, []);
  const { isSyncing: isSavingToFirestore, syncNow: saveDailyStepsToFirestore } = useDailyStepSync({
    goal,
    onMessage: showServerToast,
    source,
    steps: todaySteps,
    userId: user?.uid ?? null,
  });

  const reloadRecentHistory = useCallback(async (): Promise<void> => {
    setHistory(await readDashboardRecentHistory());
  }, []);

  const reloadGraphHistory = useCallback(async (range: DashboardRange): Promise<void> => {
    setGraphHistory(await readDashboardGraph(range));
    setGraphReplayKey((currentKey) => currentKey + 1);
  }, []);

  const reloadRangeTotals = useCallback(async (): Promise<void> => {
    setRangeTotals(await readDashboardRangeTotals());
  }, []);

  const handleRefreshSteps = async (): Promise<void> => {
    const message = await refreshSteps();
    showToast(message, 'success');
    await Promise.all([reloadRecentHistory(), reloadGraphHistory(graphRange), reloadRangeTotals()]);
    setProgressResetKey((currentKey) => currentKey + 1);
    setStepReplayKey((currentKey) => currentKey + 1);
  };

  const handleSaveToFirestore = async (): Promise<void> => {
    await saveDailyStepsToFirestore();
    await Promise.all([reloadRecentHistory(), reloadGraphHistory(graphRange), reloadRangeTotals()]);
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

  const toggleDashboardAvatar = useCallback((): void => {
    setIsDashboardAvatarVisible((isVisible) => {
      const nextValue = !isVisible;
      void AsyncStorage.setItem(DASHBOARD_AVATAR_VISIBLE_KEY, nextValue ? 'true' : 'false');
      return nextValue;
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadAvatarVisibility = async (): Promise<void> => {
      const storedValue = await AsyncStorage.getItem(DASHBOARD_AVATAR_VISIBLE_KEY);
      if (isMounted) {
        setIsDashboardAvatarVisible(storedValue === 'true');
      }
    };

    void loadAvatarVisibility();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    todayStepsRef.current = todaySteps;
    if (selectedHeroDate === getTodayString()) {
      setSelectedHeroSteps(todaySteps);
    }
  }, [selectedHeroDate, todaySteps]);

  const loadSelectedHeroDay = useCallback(async (date: string): Promise<void> => {
    const nextSteps = date === getTodayString() ? todayStepsRef.current : await readStepsForDate(date);
    setSelectedHeroDate(date);
    setSelectedHeroSteps(nextSteps);
    setProgressResetKey((currentKey) => currentKey + 1);
    setStepReplayKey((currentKey) => currentKey + 1);
  }, []);

  const moveSelectedHeroDay = useCallback(
    (dayDelta: number): void => {
      const nextDate = clampDateToToday(shiftDate(selectedHeroDate, dayDelta));
      void loadSelectedHeroDay(nextDate);
    },
    [loadSelectedHeroDay, selectedHeroDate],
  );

  const progressPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 18 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.25,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > 54) {
            moveSelectedHeroDay(-1);
          } else if (gestureState.dx < -54) {
            moveSelectedHeroDay(1);
          }
        },
      }),
    [moveSelectedHeroDay],
  );

  useFocusEffect(
    useCallback(() => {
      const loadDashboardData = async (): Promise<void> => {
        const snapshot = await loadDashboardSnapshot(graphRangeRef.current);
        setBodyProfile(snapshot.bodyProfile);
        setGoal(snapshot.goal);
        setGraphHistory(snapshot.graphHistory);
        setHistory(snapshot.recentHistory);
        setRangeTotals(snapshot.totals);
        setGraphReplayKey((currentKey) => currentKey + 1);
      };

      void loadDashboardData();
      void loadSelectedHeroDay(selectedHeroDate);
      setProgressResetKey((currentKey) => currentKey + 1);
      setStepReplayKey((currentKey) => currentKey + 1);
    }, [loadSelectedHeroDay, reloadGraphHistory, reloadRangeTotals, reloadRecentHistory, selectedHeroDate]),
  );

  const todayString = getTodayString();
  const isHeroToday = selectedHeroDate === todayString;
  const heroSteps = isHeroToday ? todaySteps : selectedHeroSteps;
  const hasReachedGoal = heroSteps >= goal;
  const remainingSteps = Math.max(0, goal - heroSteps);
  const progressPercent = goal > 0 ? (heroSteps / goal) * 100 : 0;
  const heroCalories = estimateWalkingCalories(heroSteps, bodyProfile);
  const calorieMessage = getCalorieMessage(heroSteps, heroCalories, bodyProfile);
  const recentHistory = history.map((entry) =>
    entry.date === todayString ? { ...entry, steps: Math.max(entry.steps, todaySteps) } : entry,
  );
  const chartHistory = graphHistory.map((entry) =>
    entry.date === todayString ? { ...entry, steps: Math.max(entry.steps, todaySteps) } : entry,
  );

  return (
    <AppScreen
      contentStyle={styles.container}
      overlays={
        <>
          <ToastStack messages={toastMessages} onHide={hideToast} />
          <ToastStack messages={serverToastMessages} onHide={hideServerToast} placement="center" />
          <DayDetailModal
            day={selectedDay}
            goal={goal}
            profile={bodyProfile}
            onClose={() => setSelectedDay(null)}
            todayString={todayString}
          />
        </>
      }
    >
      <RevealView replayKey={stepReplayKey} style={styles.hero}>
        <View style={styles.dayJumpHeader}>
          <HeroDayButton
            accessibilityLabel="Previous week"
            icon="play-skip-back-outline"
            onPress={() => moveSelectedHeroDay(-7)}
          />
          <HeroDayButton
            accessibilityLabel="Previous day"
            icon="chevron-back-outline"
            onPress={() => moveSelectedHeroDay(-1)}
          />
          <View style={styles.heroDateBadge}>
            <Text style={styles.heroDateLabel}>{isHeroToday ? 'Today' : getShortWeekday(selectedHeroDate)}</Text>
            <Text style={styles.heroDateText}>{formatShortDate(selectedHeroDate)}</Text>
          </View>
          <HeroDayButton
            accessibilityLabel="Next day"
            disabled={isHeroToday}
            icon="chevron-forward-outline"
            onPress={() => moveSelectedHeroDay(1)}
          />
          <HeroDayButton
            accessibilityLabel="Next week"
            disabled={isHeroToday}
            icon="play-skip-forward-outline"
            onPress={() => moveSelectedHeroDay(7)}
          />
        </View>

        <View style={styles.progressSwipeArea} {...progressPanResponder.panHandlers}>
          <ProgressRing goal={goal} resetAnimationKey={progressResetKey} size={314} steps={heroSteps} />
        </View>
        <View style={styles.stepBlock}>
          <AnimatedStepCount replayKey={stepReplayKey} steps={heroSteps} style={styles.stepCount} />
          <Text style={styles.stepLabel}>{isHeroToday ? 'steps today' : 'saved steps'}</Text>
        </View>
        <Text style={styles.goalText}>Goal {goal.toLocaleString()}</Text>

        {isHeroToday && isDashboardAvatarVisible ? (
          <DashboardAvatar
            caption={`Detected: ${avatarMotion.activity}`}
            speed={avatarMotion.speed}
            state={getAvatarStateForMotion(avatarMotion.activity)}
          />
        ) : null}
        {isHeroToday ? (
          <AnimatedPressable
            accessibilityLabel={isDashboardAvatarVisible ? 'Hide dashboard avatar' : 'Show dashboard avatar'}
            accessibilityRole="switch"
            accessibilityState={{ checked: isDashboardAvatarVisible }}
            onPress={toggleDashboardAvatar}
            style={[styles.avatarToggle, isDashboardAvatarVisible ? styles.avatarToggleActive : null]}
          >
            <Ionicons color={COLORS.text} name="paw-outline" size={17} />
            <Text style={[styles.avatarToggleText, isDashboardAvatarVisible ? styles.avatarToggleTextActive : null]}>
              {isDashboardAvatarVisible ? 'Avatar on' : 'Avatar'}
            </Text>
          </AnimatedPressable>
        ) : null}
        <View style={styles.statusRow}>
          {isAvailable ? (
            <StatusBadge status={status} />
          ) : (
            <Text style={styles.unsupported}>Waiting for step data</Text>
          )}
        </View>
        <View style={styles.calorieRow}>
          <View style={styles.caloriePill}>
            <Ionicons color={COLORS.challenge} name="flame-outline" size={17} />
            <Text style={styles.calorieText}>{calorieMessage}</Text>
            <AnimatedPressable
              accessibilityLabel="Show calorie calculation"
              accessibilityRole="button"
              onPress={() => setIsCalorieTooltipVisible((isVisible) => !isVisible)}
              style={styles.calorieInfoButton}
            >
              <Ionicons color={COLORS.challenge} name="information-circle-outline" size={18} />
            </AnimatedPressable>
          </View>
          <View style={styles.calorieActions}>
            <HeaderActionButton
              accessibilityLabel="Refresh steps"
              busy={isRefreshing}
              icon="refresh-outline"
              onPress={() => {
                void handleRefreshSteps();
              }}
            />
            <HeaderActionButton
              accessibilityLabel="Save current step data to Firestore"
              busy={isSavingToFirestore}
              icon="server-outline"
              onPress={() => {
                void handleSaveToFirestore();
              }}
            />
          </View>
        </View>
        {isCalorieTooltipVisible ? (
          <View style={styles.calorieTooltip}>
            <Text style={styles.calorieTooltipTitle}>Calorie estimate</Text>
            <TooltipCalcRow
              label="1. Steps"
              value={isHeroToday ? "Today's step count" : 'Saved steps for the selected day'}
            />
            <TooltipCalcRow label="2. Step length" value="height x 0.414, or 0.75 m fallback" />
            <TooltipCalcRow label="3. Distance" value="steps x step length / 1000" />
            <TooltipCalcRow label="4. Calories" value="distance km x weight kg x 0.57" />
            <Text style={styles.calorieTooltipText}>
              Add weight in Profile to enable the estimate. Add height to improve the distance estimate.
            </Text>
          </View>
        ) : null}

        {hasReachedGoal ? (
          <View style={styles.goalBanner}>
            <Text style={styles.goalBannerText}>Daily goal reached. Beautiful work.</Text>
          </View>
        ) : null}
      </RevealView>

      <RevealView delay={80} replayKey={stepReplayKey} style={styles.statsGrid}>
        <StatCard label="Progress" value={`${progressPercent.toFixed(2)}%`} />
        <StatCard label="Remaining" value={remainingSteps === 0 ? 'Done' : remainingSteps.toLocaleString()} />
      </RevealView>

      <RevealView delay={140} replayKey={stepReplayKey}>
        <SurfacePanel style={styles.historyPanel}>
          <View style={styles.historyHeader}>
            <View>
              <Text style={styles.sourceTitle}>Recent history</Text>
              <Text style={styles.sourceSubtitle}>Tap a day to inspect its progress.</Text>
            </View>
            <Text style={styles.historyGoal}>{`${goal.toLocaleString()} goal`}</Text>
          </View>
          <SegmentedTabs
            onChange={(nextRange) => {
              graphRangeRef.current = nextRange;
              setGraphRange(nextRange);
              void reloadGraphHistory(nextRange);
            }}
            options={[
              { label: 'Week', value: 'week' },
              { label: 'Month', value: 'month' },
              { label: 'Year', value: 'year' },
            ]}
            value={graphRange}
          />
          <View style={styles.rangeTotalsGrid}>
            <RangeTotalCard label="Week" value={rangeTotals.week} />
            <RangeTotalCard label="Month" value={rangeTotals.month} />
            <RangeTotalCard label="Year" value={rangeTotals.year} />
          </View>
          <View style={styles.historyChart}>
            <StepTrendChart
              animationKey={graphReplayKey}
              goal={goal}
              history={chartHistory}
              onEntryPress={setSelectedDay}
            />
          </View>
          <View style={styles.historyList}>
            {recentHistory.map((entry) => (
              <HistoryDayRow
                entry={entry}
                goal={goal}
                key={entry.date}
                onPress={() => setSelectedDay(entry)}
                todayString={todayString}
              />
            ))}
          </View>
        </SurfacePanel>
      </RevealView>

      <RevealView delay={190} replayKey={stepReplayKey}>
        <SurfacePanel style={styles.syncPanel} tone="primary">
          <View style={styles.syncIcon}>
            <Ionicons
              color={COLORS.primary}
              name={isSystemTotalAvailable ? 'fitness-outline' : 'cloud-download-outline'}
              size={20}
            />
          </View>
          <View style={styles.syncCopy}>
            <Text style={styles.syncTitle}>{isSystemTotalAvailable ? 'Health data connected' : 'Google Fit sync'}</Text>
            <Text style={styles.syncText}>{statusMessage}</Text>
          </View>
        </SurfacePanel>
      </RevealView>
    </AppScreen>
  );
}
