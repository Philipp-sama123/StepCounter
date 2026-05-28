import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, PanResponder, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useAuth } from '../src/auth/AuthContext';
import { AnimatedStepCount } from '../src/components/AnimatedStepCount';
import { AnimatedPressable } from '../src/components/AnimatedPressable';
import { AppScreen } from '../src/components/layout/AppScreen';
import { ProgressRing } from '../src/components/ProgressRing';
import { RevealView } from '../src/components/RevealView';
import { SegmentedTabs } from '../src/components/SegmentedTabs';
import { StatusBadge } from '../src/components/StatusBadge';
import { StepTrendChart } from '../src/components/StepTrendChart';
import { ToastMessageItem, ToastStack } from '../src/components/ToastMessage';
import { MetricCard } from '../src/components/ui/MetricCard';
import { SurfacePanel } from '../src/components/ui/SurfacePanel';
import { COLORS, DEFAULT_GOAL } from '../src/constants';
import { useDailyStepSync } from '../src/hooks/useDailyStepSync';
import { useStepCounter } from '../src/hooks/useStepCounter';
import { readBodyProfile, UserBodyProfile } from '../src/storage/profileStorage';
import { getTodayString, readGoal, readLastSevenDays, readRecentDays, readStepsForDate, StepHistoryEntry } from '../src/storage/stepStorage';
import { estimateWalkingCalories } from '../src/utils/calories';
import { triggerErrorHaptic, triggerSuccessHaptic } from '../src/utils/haptics';
import { appendToastMessage } from '../src/utils/toastQueue';

type DashboardRange = 'month' | 'week' | 'year';
type RangeTotals = Record<DashboardRange, number>;
const MIN_CALORIE_STEPS = 20;

export default function HomeScreen() {
  const {
    debugMessage,
    isAvailable,
    isRefreshing,
    isSystemTotalAvailable,
    refreshSteps,
    source,
    status,
    todaySteps,
  } = useStepCounter('combined');
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
  const [selectedDay, setSelectedDay] = useState<StepHistoryEntry | null>(null);
  const [selectedHeroDate, setSelectedHeroDate] = useState(getTodayString());
  const [selectedHeroSteps, setSelectedHeroSteps] = useState(0);
  const [stepReplayKey, setStepReplayKey] = useState(0);
  const [toastMessages, setToastMessages] = useState<ToastMessageItem[]>([]);
  const [serverToastMessages, setServerToastMessages] = useState<ToastMessageItem[]>([]);
  const graphRangeRef = useRef<DashboardRange>(graphRange);
  const todayStepsRef = useRef(todaySteps);
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
    setHistory(await readLastSevenDays());
  }, []);

  const reloadGraphHistory = useCallback(async (range: DashboardRange): Promise<void> => {
    setGraphHistory(await readRecentDays(getRangeDayCount(range)));
    setGraphReplayKey((currentKey) => currentKey + 1);
  }, []);

  const reloadRangeTotals = useCallback(async (): Promise<void> => {
    const [weekEntries, monthEntries, yearEntries] = await Promise.all([
      readRecentDays(7),
      readRecentDays(30),
      readRecentDays(365),
    ]);
    setRangeTotals({
      week: sumSteps(weekEntries),
      month: sumSteps(monthEntries),
      year: sumSteps(yearEntries),
    });
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

  const moveSelectedHeroDay = useCallback((dayDelta: number): void => {
    const nextDate = clampDateToToday(shiftDate(selectedHeroDate, dayDelta));
    void loadSelectedHeroDay(nextDate);
  }, [loadSelectedHeroDay, selectedHeroDate]);

  const progressPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) =>
      Math.abs(gestureState.dx) > 18 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.25,
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx > 54) {
        moveSelectedHeroDay(-1);
      } else if (gestureState.dx < -54) {
        moveSelectedHeroDay(1);
      }
    },
  }), [moveSelectedHeroDay]);

  useFocusEffect(
    useCallback(() => {
      const loadDashboardData = async (): Promise<void> => {
        const [storedGoal] = await Promise.all([
          readGoal(),
          readBodyProfile().then(setBodyProfile),
          reloadRecentHistory(),
          reloadGraphHistory(graphRangeRef.current),
          reloadRangeTotals(),
        ]);
        setGoal(storedGoal);
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
  const recentHistory = history.map((entry) => (entry.date === todayString ? { ...entry, steps: Math.max(entry.steps, todaySteps) } : entry));
  const chartHistory = graphHistory.map((entry) => (entry.date === todayString ? { ...entry, steps: Math.max(entry.steps, todaySteps) } : entry));

  return (
    <AppScreen
      contentStyle={styles.container}
      overlays={(
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
      )}
    >
        <RevealView replayKey={stepReplayKey} style={styles.hero}>
          <View style={styles.dayJumpHeader}>
            <HeroDayButton accessibilityLabel="Previous week" icon="play-skip-back-outline" onPress={() => moveSelectedHeroDay(-7)} />
            <HeroDayButton accessibilityLabel="Previous day" icon="chevron-back-outline" onPress={() => moveSelectedHeroDay(-1)} />
            <View style={styles.heroDateBadge}>
              <Text style={styles.heroDateLabel}>{isHeroToday ? 'Today' : getShortWeekday(selectedHeroDate)}</Text>
              <Text style={styles.heroDateText}>{formatShortDate(selectedHeroDate)}</Text>
            </View>
            <HeroDayButton accessibilityLabel="Next day" disabled={isHeroToday} icon="chevron-forward-outline" onPress={() => moveSelectedHeroDay(1)} />
            <HeroDayButton accessibilityLabel="Next week" disabled={isHeroToday} icon="play-skip-forward-outline" onPress={() => moveSelectedHeroDay(7)} />
          </View>

          <View style={styles.progressSwipeArea} {...progressPanResponder.panHandlers}>
            <ProgressRing goal={goal} resetAnimationKey={progressResetKey} size={314} steps={heroSteps} />
          </View>
          <View style={styles.stepBlock}>
            <AnimatedStepCount replayKey={stepReplayKey} steps={heroSteps} style={styles.stepCount} />
            <Text style={styles.stepLabel}>{isHeroToday ? 'steps today' : 'saved steps'}</Text>
          </View>
          <Text style={styles.goalText}>Goal {goal.toLocaleString()}</Text>

          <View style={styles.statusRow}>
            {isAvailable ? <StatusBadge status={status} /> : <Text style={styles.unsupported}>Waiting for step data</Text>}
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
              <TooltipCalcRow label="1. Steps" value={isHeroToday ? "Today's step count" : 'Saved steps for the selected day'} />
              <TooltipCalcRow label="2. Step length" value="height x 0.414, or 0.75 m fallback" />
              <TooltipCalcRow label="3. Distance" value="steps x step length / 1000" />
              <TooltipCalcRow label="4. Calories" value="distance km x weight kg x 0.57" />
              <Text style={styles.calorieTooltipText}>Add weight in Profile to enable the estimate. Add height to improve the distance estimate.</Text>
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
            <Ionicons color={COLORS.primary} name={isSystemTotalAvailable ? 'fitness-outline' : 'cloud-download-outline'} size={20} />
          </View>
          <View style={styles.syncCopy}>
            <Text style={styles.syncTitle}>{isSystemTotalAvailable ? 'Health data connected' : 'Google Fit sync'}</Text>
            <Text style={styles.syncText}>{debugMessage}</Text>
          </View>
        </SurfacePanel>
        </RevealView>
    </AppScreen>
  );
}

type HeaderActionButtonProps = {
  accessibilityLabel: string;
  busy: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

const getRangeDayCount = (range: DashboardRange): number => {
  if (range === 'month') {
    return 30;
  }

  if (range === 'year') {
    return 365;
  }

  return 7;
};

const sumSteps = (entries: StepHistoryEntry[]): number =>
  entries.reduce((total, entry) => total + Math.max(0, Math.floor(entry.steps)), 0);

const getCalorieMessage = (steps: number, calories: number, profile: UserBodyProfile | null): string => {
  if (steps < MIN_CALORIE_STEPS) {
    return 'Calories available after more steps';
  }

  if ((profile?.currentWeightKg ?? 0) <= 0) {
    return 'Add weight in Profile for calories';
  }

  return `${calories.toLocaleString()} kcal burned`;
};

const shiftDate = (date: string, dayDelta: number): string => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + dayDelta);
  return toLocalDateString(nextDate);
};

const clampDateToToday = (date: string): string =>
  new Date(date).getTime() > new Date(getTodayString()).getTime() ? getTodayString() : date;

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type RangeTotalCardProps = {
  label: string;
  value: number;
};

const RangeTotalCard = ({ label, value }: RangeTotalCardProps) => (
  <View style={styles.rangeTotalCard}>
    <Text style={styles.rangeTotalLabel}>{label}</Text>
    <Text style={styles.rangeTotalValue}>{value.toLocaleString()}</Text>
  </View>
);

const HeaderActionButton = ({ accessibilityLabel, busy, icon, onPress }: HeaderActionButtonProps) => (
  <AnimatedPressable
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    disabled={busy}
    onPress={onPress}
    style={[styles.headerAction, busy ? styles.headerActionBusy : null]}
  >
    {busy ? <ActivityIndicator color={COLORS.text} size="small" /> : <Ionicons color={COLORS.text} name={icon} size={19} />}
  </AnimatedPressable>
);

type HeroDayButtonProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const HeroDayButton = ({ accessibilityLabel, disabled = false, icon, onPress, style }: HeroDayButtonProps) => (
  <AnimatedPressable
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    style={[styles.heroDayButton, style, disabled ? styles.heroDayButtonDisabled : null]}
  >
    <Ionicons color={disabled ? COLORS.stopped : COLORS.text} name={icon} size={17} />
  </AnimatedPressable>
);

type HistoryDayRowProps = {
  entry: StepHistoryEntry;
  goal: number;
  onPress: () => void;
  todayString: string;
};

const HistoryDayRow = ({ entry, goal, onPress, todayString }: HistoryDayRowProps) => {
  const rawProgress = entry.steps / Math.max(1, goal);
  const progress = Math.min(1, rawProgress);
  const isToday = entry.date === todayString;

  return (
    <AnimatedPressable accessibilityRole="button" onPress={onPress} style={styles.historyRow}>
      <View style={styles.historyDay}>
        <Text style={styles.historyDayName}>{isToday ? 'Today' : entry.dayName}</Text>
        <Text style={styles.historyDate}>{entry.date}</Text>
      </View>
      <View style={styles.historyProgress}>
        <View style={styles.historyProgressTrack}>
          <View style={[styles.historyProgressFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.historyMetaRow}>
          <Text style={styles.historySteps}>{`${entry.steps.toLocaleString()} steps`}</Text>
          <Text style={styles.historyPercent}>{formatPercent(rawProgress)}</Text>
        </View>
      </View>
    </AnimatedPressable>
  );
};

type DayDetailModalProps = {
  day: StepHistoryEntry | null;
  goal: number;
  onClose: () => void;
  profile: UserBodyProfile | null;
  todayString: string;
};

const DayDetailModal = ({ day, goal, onClose, profile, todayString }: DayDetailModalProps) => {
  const [animationKey, setAnimationKey] = useState(0);

  if (day === null) {
    return null;
  }

  const progress = day.steps / Math.max(1, goal);
  const progressPercent = formatPercent(progress);
  const remaining = Math.max(0, goal - day.steps);
  const calories = estimateWalkingCalories(day.steps, profile);

  return (
    <Modal
      animationType="fade"
      onShow={() => setAnimationKey((currentKey) => currentKey + 1)}
      transparent
      visible
    >
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalBackdrop} />
      <View style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalDateHeader}>
            <Text style={styles.modalEyebrow}>{day.date === todayString ? 'Today' : getFullWeekday(day.date)}</Text>
            <Text style={styles.modalTitle}>{formatDisplayDate(day.date)}</Text>
          </View>
          <ModalProgressBar progress={progress} replayKey={`${day.date}-${animationKey}`} />
          <View style={styles.modalRows}>
            <DetailRow label="Steps" value={day.steps.toLocaleString()} />
            <DetailRow label="Goal" value={goal.toLocaleString()} />
            <DetailRow label="Progress" value={progressPercent} />
            <DetailRow label="Remaining" value={remaining === 0 ? 'Done' : remaining.toLocaleString()} />
            <DetailRow label="Burned" value={calories > 0 ? `${calories.toLocaleString()} kcal` : 'Add profile weight'} />
          </View>
          <AnimatedPressable accessibilityRole="button" onPress={onClose} style={styles.modalButton}>
            <Text style={styles.modalButtonText}>Close</Text>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
};

type ModalProgressBarProps = {
  progress: number;
  replayKey: string;
};

const ModalProgressBar = ({ progress, replayKey }: ModalProgressBarProps) => {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const animatedOverflowProgress = useRef(new Animated.Value(0)).current;
  const rewardPulse = useRef(new Animated.Value(1)).current;
  const baseProgress = Math.min(1, progress);
  const overflowProgress = progress > 1 ? (progress - 1) % 1 || 1 : 0;

  useEffect(() => {
    animatedProgress.setValue(0);
    animatedOverflowProgress.setValue(0);
    rewardPulse.setValue(1);

    const rewardAnimation = Animated.sequence([
      Animated.timing(rewardPulse, {
        duration: 90,
        toValue: 1.06,
        useNativeDriver: true,
      }),
      Animated.timing(rewardPulse, {
        duration: 110,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);

    Animated.sequence([
      Animated.delay(120),
      Animated.spring(animatedProgress, {
        damping: 18,
        stiffness: 110,
        toValue: baseProgress,
        useNativeDriver: false,
      }),
      ...(progress >= 1 ? [rewardAnimation] : []),
      ...(progress > 1
        ? [
            Animated.timing(animatedOverflowProgress, {
              duration: 360,
              toValue: overflowProgress,
              useNativeDriver: false,
            }),
          ]
        : []),
    ]).start();
  }, [animatedOverflowProgress, animatedProgress, baseProgress, overflowProgress, progress, replayKey, rewardPulse]);

  const width = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const overflowWidth = animatedOverflowProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.modalProgressWrap}>
      <Animated.View style={[styles.modalProgressOuter, { transform: [{ scale: rewardPulse }] }]}>
        <View style={styles.modalProgressTrack}>
          <Animated.View style={[styles.modalProgressFill, { width }]}>
            <ProgressFillGradient gradientId="modalBaseProgressGradient" endColor={COLORS.challenge} startColor={COLORS.action} />
          </Animated.View>
        </View>
        {progress > 1 ? (
          <Animated.View style={[styles.modalProgressOverflowFill, { width: overflowWidth }]}>
            <ProgressFillGradient gradientId="modalOverflowProgressGradient" endColor={COLORS.danger} startColor={COLORS.challenge} />
          </Animated.View>
        ) : null}
      </Animated.View>
      <Text style={styles.modalProgressText}>{`${formatPercent(progress)} of daily goal`}</Text>
    </View>
  );
};

const formatPercent = (ratio: number): string => `${(ratio * 100).toFixed(2)}%`;

type ProgressFillGradientProps = {
  endColor: string;
  gradientId: string;
  startColor: string;
};

const ProgressFillGradient = ({ endColor, gradientId, startColor }: ProgressFillGradientProps) => (
  <Svg height="100%" width="100%">
    <Defs>
      <LinearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
        <Stop offset="0" stopColor={startColor} />
        <Stop offset="1" stopColor={endColor} />
      </LinearGradient>
    </Defs>
    <Rect fill={`url(#${gradientId})`} height="100%" width="100%" x="0" y="0" />
  </Svg>
);

const getFullWeekday = (date: string): string =>
  new Date(date).toLocaleDateString(undefined, { weekday: 'long' });

const getShortWeekday = (date: string): string =>
  new Date(date).toLocaleDateString(undefined, { weekday: 'short' });

const formatShortDate = (date: string): string =>
  new Date(date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });

const formatDisplayDate = (date: string): string =>
  new Date(date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

type TooltipCalcRowProps = {
  label: string;
  value: string;
};

const TooltipCalcRow = ({ label, value }: TooltipCalcRowProps) => (
  <View style={styles.tooltipCalcRow}>
    <Text style={styles.tooltipCalcLabel}>{label}</Text>
    <Text style={styles.tooltipCalcValue}>{value}</Text>
  </View>
);

type DetailRowProps = {
  label: string;
  value: string;
};

const DetailRow = ({ label, value }: DetailRowProps) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

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
  dayJumpHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    width: '100%',
  },
  progressSwipeArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 324,
    width: '100%',
  },
  heroDayButton: {
    alignItems: 'center',
    backgroundColor: COLORS.button,
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  heroDayButtonDisabled: {
    backgroundColor: COLORS.stoppedSoft,
    opacity: 0.72,
  },
  heroDateBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroDateLabel: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroDateText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },
  headerAction: {
    alignItems: 'center',
    backgroundColor: COLORS.button,
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerActionBusy: {
    opacity: 0.78,
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
  calorieRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  caloriePill: {
    alignItems: 'center',
    backgroundColor: COLORS.challengeSoft,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  calorieActions: {
    flexDirection: 'row',
    gap: 8,
  },
  calorieText: {
    color: COLORS.text,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  calorieInfoButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  calorieTooltip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    maxWidth: 330,
    padding: 12,
  },
  calorieTooltipTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  calorieTooltipText: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  tooltipCalcRow: {
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    gap: 3,
    paddingTop: 8,
  },
  tooltipCalcLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },
  tooltipCalcValue: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
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
  historyPanel: {
    gap: 14,
  },
  historyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyGoal: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  historyList: {
    gap: 10,
  },
  historyChart: {
    marginTop: 2,
  },
  rangeTotalsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  rangeTotalCard: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minHeight: 62,
    padding: 10,
  },
  rangeTotalLabel: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '900',
  },
  rangeTotalValue: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '900',
  },
  historyRow: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  historyDay: {
    width: 76,
  },
  historyDayName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
  },
  historyDate: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  historyProgress: {
    flex: 1,
    gap: 7,
    justifyContent: 'center',
  },
  historyProgressTrack: {
    backgroundColor: COLORS.border,
    borderRadius: 999,
    height: 9,
    overflow: 'hidden',
  },
  historyProgressFill: {
    backgroundColor: COLORS.action,
    borderRadius: 999,
    height: '100%',
  },
  historyMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historySteps: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },
  historyPercent: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlaySoft,
  },
  modalWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  modalDateHeader: {
    backgroundColor: COLORS.action,
    borderRadius: 8,
    gap: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalEyebrow: {
    color: COLORS.onAccent,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  modalTitle: {
    color: COLORS.onAccent,
    fontSize: 24,
    fontWeight: '900',
  },
  modalProgressWrap: {
    gap: 8,
  },
  modalProgressOuter: {
    height: 22,
    justifyContent: 'center',
    overflow: 'visible',
  },
  modalProgressTrack: {
    backgroundColor: COLORS.border,
    borderRadius: 999,
    height: 14,
    overflow: 'hidden',
  },
  modalProgressFill: {
    backgroundColor: COLORS.action,
    borderRadius: 999,
    height: '100%',
    overflow: 'hidden',
  },
  modalProgressOverflowFill: {
    backgroundColor: COLORS.challenge,
    borderRadius: 999,
    height: 16,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 3,
  },
  modalProgressText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  modalRows: {
    gap: 9,
  },
  detailRow: {
    alignItems: 'center',
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  detailLabel: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '700',
  },
  detailValue: {
    color: COLORS.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  modalButton: {
    alignItems: 'center',
    backgroundColor: COLORS.button,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  modalButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
  },
});
