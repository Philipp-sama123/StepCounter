import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AnimatedPressable } from '../../../components/AnimatedPressable';
import { MetricCard } from '../../../components/ui/MetricCard';
import { COLORS } from '../../../constants';
import { addLocalDays, parseLocalDate } from '../../../shared/date/localDate';
import { getTodayString } from '../../../storage/stepStorage';
import { estimateWalkingCalories } from '../../../utils/calories';

import { styles } from './DashboardScreen.styles';

import type { UserBodyProfile } from '../../profile/domain/models';
import type { StepHistoryEntry } from '../../steps/domain/models';
import type { StyleProp, ViewStyle } from 'react-native';

const MIN_CALORIE_STEPS = 20;
type HeaderActionButtonProps = {
  accessibilityLabel: string;
  busy: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

const getCalorieMessage = (steps: number, calories: number, profile: UserBodyProfile | null): string => {
  if (steps < MIN_CALORIE_STEPS) {
    return 'Calories available after more steps';
  }

  if ((profile?.currentWeightKg ?? 0) <= 0) {
    return 'Add weight in Profile for calories';
  }

  return `${calories.toLocaleString()} kcal burned`;
};

const shiftDate = addLocalDays;

const clampDateToToday = (date: string): string => (date > getTodayString() ? getTodayString() : date);

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
    {busy ? (
      <ActivityIndicator color={COLORS.text} size="small" />
    ) : (
      <Ionicons color={COLORS.text} name={icon} size={19} />
    )}
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
  const recapMessage = getDailyRecapMessage(progress, remaining);

  return (
    <Modal animationType="fade" onShow={() => setAnimationKey((currentKey) => currentKey + 1)} transparent visible>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalBackdrop} />
      <View style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalDateHeader}>
            <View style={styles.modalDateCopy}>
              <Text style={styles.modalEyebrow}>{day.date === todayString ? 'Today' : getFullWeekday(day.date)}</Text>
              <Text style={styles.modalTitle}>{formatDisplayDate(day.date)}</Text>
            </View>
            <AnimatedPressable
              accessibilityLabel="Close day details"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.modalCloseIcon}
            >
              <Ionicons color={COLORS.text} name="close-outline" size={22} />
            </AnimatedPressable>
          </View>
          <View style={styles.modalHeroStat}>
            <View style={styles.modalHeroIcon}>
              <Ionicons color={COLORS.progressOverflowStart} name="footsteps-outline" size={28} />
            </View>
            <View style={styles.modalHeroCopy}>
              <Text style={styles.modalHeroValue}>{day.steps.toLocaleString()}</Text>
              <Text style={styles.modalHeroLabel}>steps logged</Text>
            </View>
          </View>
          <ModalProgressBar progress={progress} replayKey={`${day.date}-${animationKey}`} />
          <View style={styles.modalMotivation}>
            <Ionicons
              color={progress >= 1 ? COLORS.progressOverflowStart : COLORS.primary}
              name={progress >= 1 ? 'trophy-outline' : 'leaf-outline'}
              size={18}
            />
            <Text style={styles.modalMotivationText}>{recapMessage}</Text>
          </View>
          <View style={styles.modalRows}>
            <DetailRow icon="flag-outline" label="Goal" value={goal.toLocaleString()} />
            <DetailRow icon="sparkles-outline" label="Progress" value={progressPercent} />
            <DetailRow
              icon="checkmark-circle-outline"
              label="Remaining"
              value={remaining === 0 ? 'Done' : remaining.toLocaleString()}
            />
            <DetailRow
              icon="flame-outline"
              label="Burned"
              value={calories > 0 ? `${calories.toLocaleString()} kcal` : 'Add profile weight'}
            />
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
  const hasOverflow = progress > 1;

  return (
    <View style={styles.modalProgressWrap}>
      <Animated.View style={[styles.modalProgressOuter, { transform: [{ scale: rewardPulse }] }]}>
        <View style={styles.modalProgressHeader}>
          <Text style={styles.modalProgressLabel}>Goal progress</Text>
          <Text style={styles.modalProgressValue}>{formatPercent(Math.min(progress, 1))}</Text>
        </View>
        <View style={styles.modalProgressTrack}>
          <Animated.View style={[styles.modalProgressFill, { width }]}>
            <ProgressFillGradient
              gradientId="modalBaseProgressGradient"
              endColor={COLORS.progressOverflowEnd}
              startColor={COLORS.progressOverflowStart}
            />
          </Animated.View>
        </View>
        {hasOverflow ? (
          <View style={styles.modalOverflowBlock}>
            <View style={styles.modalProgressHeader}>
              <Text style={styles.modalOverflowLabel}>Extra after goal</Text>
              <Text style={styles.modalOverflowValue}>{`+${formatPercent(progress - 1)}`}</Text>
            </View>
            <View style={styles.modalProgressOverflowTrack}>
              <Animated.View style={[styles.modalProgressOverflowFill, { width: overflowWidth }]}>
                <ProgressFillGradient
                  gradientId="modalOverflowProgressGradient"
                  endColor={COLORS.progressDangerEnd}
                  startColor={COLORS.progressDangerStart}
                />
              </Animated.View>
            </View>
          </View>
        ) : null}
      </Animated.View>
      <View style={styles.modalProgressMeta}>
        <Text style={styles.modalProgressLabel}>Daily goal</Text>
        <Text style={styles.modalProgressText}>{formatPercent(progress)}</Text>
      </View>
    </View>
  );
};

const formatPercent = (ratio: number): string => `${(ratio * 100).toFixed(2)}%`;

const getDailyRecapMessage = (progress: number, remaining: number): string => {
  if (progress >= 1.1) {
    return 'You pushed past the goal. That extra lap counts.';
  }

  if (progress >= 1) {
    return 'Goal reached. Strong, clean day.';
  }

  if (progress >= 0.75) {
    return `${remaining.toLocaleString()} steps left. You were right there.`;
  }

  if (progress >= 0.35) {
    return 'A solid base day. Keep the rhythm building.';
  }

  return 'A light day is still data. Tomorrow gets a fresh start.';
};

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
  parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'long' });

const getShortWeekday = (date: string): string =>
  parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' });

const formatShortDate = (date: string): string =>
  parseLocalDate(date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });

const formatDisplayDate = (date: string): string =>
  parseLocalDate(date).toLocaleDateString(undefined, {
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
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

const DetailRow = ({ icon, label, value }: DetailRowProps) => (
  <View style={styles.detailRow}>
    <View style={styles.detailCopy}>
      <View style={styles.detailIcon}>
        <Ionicons color={COLORS.progressOverflowStart} name={icon} size={17} />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
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
export {
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
};
