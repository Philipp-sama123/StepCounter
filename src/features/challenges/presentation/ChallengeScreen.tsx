import { useIsFocused } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';

import { useAuth } from '../../../auth/AuthContext';
import { AnimatedPressable } from '../../../components/AnimatedPressable';
import { AnimatedStepCount } from '../../../components/AnimatedStepCount';
import { DashboardAvatar } from '../../../components/avatar/DashboardAvatar';
import { GoalModal } from '../../../components/GoalModal';
import { AppScreen } from '../../../components/layout/AppScreen';
import { HeaderIconButton } from '../../../components/layout/HeaderIconButton';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProgressRing } from '../../../components/ProgressRing';
import { SegmentedTabs } from '../../../components/SegmentedTabs';
import { StatusBadge } from '../../../components/StatusBadge';
import { ToastStack } from '../../../components/ToastMessage';
import { MetricCard } from '../../../components/ui/MetricCard';
import { SurfacePanel } from '../../../components/ui/SurfacePanel';
import { COLORS, DEFAULT_GOAL } from '../../../constants';
import { syncChallengeSession } from '../../../firebase/stepsSync';
import { publishOwnSharedProfileSnapshot } from '../../../services/sharedProfilePublish';
import { parseLocalDate } from '../../../shared/date/localDate';
import { formatLongDuration as formatDuration } from '../../../shared/format/metrics';
import {
  getTodayString,
  readAllChallengeSessions,
  readChallengeGoal,
  readChallengeSessions,
  readChallengeSessionsForRecentDays,
  readDailyChallengeGoal,
  readGoal,
  saveChallengeGoal,
  saveChallengeSession,
  saveDailyChallengeGoal,
} from '../../../storage/stepStorage';
import { triggerErrorHaptic, triggerSuccessHaptic } from '../../../utils/haptics';
import { appendToastMessage } from '../../../utils/toastQueue';
import { getAvatarStateForMotion } from '../domain/motionActivity';

import { styles } from './ChallengeScreen.styles';
import { ChallengeRewardOverlay } from './components/ChallengeRewardOverlay';
import { MotionDebugPanel } from './components/MotionDebugPanel';
import { useMotionChallengeCounter } from './useMotionChallengeCounter';

import type { ChallengeReward } from './components/ChallengeRewardOverlay';
import type { ToastMessageItem } from '../../../components/ToastMessage';
import type { AvatarAnimationKey } from '../../../config/avatarSprites';
import type { ChallengeSession } from '../domain/models';

type ChallengeHistoryRange = 'day' | 'week' | 'all';

export default function ChallengeScreen() {
  const isFocused = useIsFocused();
  const { signOutUser, user } = useAuth();
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [challengeGoal, setChallengeGoal] = useState(DEFAULT_GOAL);
  const [dailyChallengeGoal, setDailyChallengeGoal] = useState(DEFAULT_GOAL);
  const [recentSessions, setRecentSessions] = useState<(ChallengeSession & { date: string })[]>([]);
  const [challengeHistoryRange, setChallengeHistoryRange] = useState<ChallengeHistoryRange>('day');
  const [todayChallengeSteps, setTodayChallengeSteps] = useState(0);
  const [goalModalMode, setGoalModalMode] = useState<'daily-challenge' | 'session-challenge'>('session-challenge');
  const [isGoalModalVisible, setIsGoalModalVisible] = useState(false);
  const [isChallengeActive, setIsChallengeActive] = useState(false);
  const [activeChallengeGoal, setActiveChallengeGoal] = useState<number | null>(null);
  const [challengeStartAt, setChallengeStartAt] = useState<number | null>(null);
  const [progressResetKey, setProgressResetKey] = useState(0);
  const [stepReplayKey, setStepReplayKey] = useState(0);
  const [sessionClock, setSessionClock] = useState(Date.now());
  const [sessionToastMessages, setSessionToastMessages] = useState<ToastMessageItem[]>([]);
  const [serverToastMessages, setServerToastMessages] = useState<ToastMessageItem[]>([]);
  const [challengeReward, setChallengeReward] = useState<ChallengeReward | null>(null);
  const [isMotionDebugVisible, setIsMotionDebugVisible] = useState(false);
  const sessionOpacity = useRef(new Animated.Value(1)).current;
  const motionCounter = useMotionChallengeCounter({
    active: isChallengeActive,
    debugEnabled: isMotionDebugVisible,
    enabled: isFocused,
  });

  useEffect(() => {
    const loadGoal = async (): Promise<void> => {
      const [storedGoal, storedChallengeGoal, storedDailyChallengeGoal, todaySessions, storedRecentSessions] =
        await Promise.all([
          readGoal(),
          readChallengeGoal(),
          readDailyChallengeGoal(),
          readChallengeSessions(getTodayString()),
          readChallengeSessionsForRange(challengeHistoryRange),
        ]);
      setGoal(storedGoal);
      setChallengeGoal(storedChallengeGoal);
      setDailyChallengeGoal(storedDailyChallengeGoal);
      setTodayChallengeSteps(sumSessionSteps(todaySessions));
      setRecentSessions(storedRecentSessions);
    };

    void loadGoal();
  }, [challengeHistoryRange]);

  const handleSaveGoal = async (nextGoal: number): Promise<void> => {
    if (goalModalMode === 'daily-challenge') {
      setDailyChallengeGoal(nextGoal);
      await saveDailyChallengeGoal(nextGoal);
    } else {
      setChallengeGoal(nextGoal);
      await saveChallengeGoal(nextGoal);
    }

    setIsGoalModalVisible(false);
  };

  const showSessionToast = (message: string): void => {
    setSessionToastMessages((currentMessages) => appendToastMessage(currentMessages, { message, variant: 'standard' }));
  };

  const showServerToast = (message: string, variant: ToastMessageItem['variant'] = 'standard'): void => {
    if (variant === 'error') {
      triggerErrorHaptic();
    } else {
      triggerSuccessHaptic();
    }

    setServerToastMessages((currentMessages) => appendToastMessage(currentMessages, { message, variant }));
  };

  const hideSessionToast = (id: number): void => {
    setSessionToastMessages((currentMessages) => currentMessages.filter((message) => message.id !== id));
  };

  const hideServerToast = (id: number): void => {
    setServerToastMessages((currentMessages) => currentMessages.filter((message) => message.id !== id));
  };

  const hideChallengeReward = useCallback((): void => {
    setChallengeReward(null);
  }, []);

  useEffect(() => {
    if (!isChallengeActive) {
      sessionOpacity.setValue(1);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sessionOpacity, {
          duration: 520,
          toValue: 0.48,
          useNativeDriver: true,
        }),
        Animated.timing(sessionOpacity, {
          duration: 520,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [isChallengeActive, sessionOpacity]);

  useEffect(() => {
    if (!isChallengeActive || !isFocused) {
      return undefined;
    }

    const timer = setInterval(() => {
      setSessionClock(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [isChallengeActive, isFocused]);

  useFocusEffect(
    useCallback(() => {
      const loadTodayChallengeSteps = async (): Promise<void> => {
        const [todaySessions, storedRecentSessions] = await Promise.all([
          readChallengeSessions(getTodayString()),
          readChallengeSessionsForRange(challengeHistoryRange),
        ]);
        setTodayChallengeSteps(sumSessionSteps(todaySessions));
        setRecentSessions(storedRecentSessions);
      };

      void loadTodayChallengeSteps();
      setProgressResetKey((currentKey) => currentKey + 1);
      setStepReplayKey((currentKey) => currentKey + 1);
    }, [challengeHistoryRange]),
  );

  const hasReachedGoal = todayChallengeSteps + motionCounter.steps >= goal;
  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'there';

  const currentChallengeDelta = isChallengeActive ? motionCounter.steps : 0;
  const currentChallengeGoal = activeChallengeGoal ?? challengeGoal;
  const idleChallengeSteps = todayChallengeSteps;
  const ringSteps = isChallengeActive ? currentChallengeDelta : idleChallengeSteps;
  const ringGoal = isChallengeActive ? currentChallengeGoal : dailyChallengeGoal;
  const sessionDurationMs =
    isChallengeActive && challengeStartAt !== null ? Math.max(0, sessionClock - challengeStartAt) : 0;
  const sessionMinutes = Math.max(1, sessionDurationMs / 60000);
  const sessionPace = isChallengeActive ? Math.round(currentChallengeDelta / sessionMinutes) : 0;
  const modeHint = 'Live motion counting is active during a challenge, so steps appear as you move.';
  const challengeAvatarState: AvatarAnimationKey = getAvatarStateForMotion(motionCounter.activity);

  return (
    <AppScreen
      contentStyle={styles.container}
      overlays={
        <>
          <GoalModal
            currentGoal={goalModalMode === 'daily-challenge' ? dailyChallengeGoal : challengeGoal}
            helperText={
              goalModalMode === 'daily-challenge'
                ? 'Choose how many challenge-session steps you want to collect today.'
                : 'Choose a target for each individual challenge session.'
            }
            isVisible={isGoalModalVisible}
            onClose={() => setIsGoalModalVisible(false)}
            onSave={(nextGoal) => {
              void handleSaveGoal(nextGoal);
            }}
            title={goalModalMode === 'daily-challenge' ? 'Daily challenge goal' : 'Session challenge goal'}
          />
          <ToastStack messages={sessionToastMessages} onHide={hideSessionToast} placement="bottom" />
          <ToastStack messages={serverToastMessages} onHide={hideServerToast} placement="center" />
          <ChallengeRewardOverlay onDone={hideChallengeReward} reward={challengeReward} />
        </>
      }
    >
      <PageHeader
        accessory={
          <>
            <HeaderIconButton
              accessibilityLabel="Edit challenge goal"
              icon="settings-outline"
              onPress={() => {
                setGoalModalMode('session-challenge');
                setIsGoalModalVisible(true);
              }}
            />
            <HeaderIconButton
              accessibilityLabel="Sign out"
              icon="log-out-outline"
              onPress={() => {
                void signOutUser();
              }}
            />
          </>
        }
        subtitle="Challenge Mode"
        title={displayName}
      />

      <View style={styles.hero}>
        <View style={styles.challengeAvatarPanel}>
          <DashboardAvatar
            caption={getChallengeAvatarCaption(challengeAvatarState, isChallengeActive)}
            speed={motionCounter.speed}
            state={challengeAvatarState}
          />
        </View>

        <ProgressRing
          caption={isChallengeActive ? 'of challenge goal' : 'of daily challenge goal'}
          completeColor={COLORS.challenge}
          goal={ringGoal}
          progressColor={COLORS.challenge}
          resetAnimationKey={progressResetKey}
          steps={ringSteps}
        />
        <View style={styles.stepBlock}>
          {isChallengeActive ? (
            <Animated.View style={[styles.sessionStepsPanel, { opacity: sessionOpacity }]}>
              <AnimatedStepCount
                replayKey={stepReplayKey}
                steps={currentChallengeDelta}
                style={styles.sessionStepCount}
              />
              <Text style={styles.sessionStepLabel}>session steps</Text>
            </Animated.View>
          ) : (
            <>
              <AnimatedStepCount replayKey={stepReplayKey} steps={idleChallengeSteps} style={styles.stepCount} />
              <Text style={styles.stepLabel}>challenge steps today</Text>
            </>
          )}
        </View>
        <Text style={styles.goalText}>
          {isChallengeActive
            ? `Challenge goal ${currentChallengeGoal.toLocaleString()}`
            : `Daily challenge goal ${dailyChallengeGoal.toLocaleString()} · Session goal ${challengeGoal.toLocaleString()}`}
        </Text>
        <Text style={styles.modeHint}>{modeHint}</Text>

        {!isChallengeActive ? (
          <View style={styles.goalButtons}>
            <AnimatedPressable
              accessibilityLabel="Edit daily challenge goal"
              accessibilityRole="button"
              onPress={() => {
                setGoalModalMode('daily-challenge');
                setIsGoalModalVisible(true);
              }}
              style={styles.goalPill}
            >
              <Text style={styles.goalPillText}>Daily goal</Text>
            </AnimatedPressable>
            <AnimatedPressable
              accessibilityLabel="Edit session challenge goal"
              accessibilityRole="button"
              onPress={() => {
                setGoalModalMode('session-challenge');
                setIsGoalModalVisible(true);
              }}
              style={styles.goalPill}
            >
              <Text style={styles.goalPillText}>Session goal</Text>
            </AnimatedPressable>
          </View>
        ) : null}

        <View style={styles.statusRow}>
          <StatusBadge attention={isChallengeActive} status={motionCounter.status} />
          {!motionCounter.isAvailable && (
            <View style={styles.permissionContainer}>
              <Text style={styles.unsupported}>Motion sensors are unavailable on this device.</Text>
            </View>
          )}
        </View>

        <AnimatedPressable
          accessibilityLabel={isMotionDebugVisible ? 'Hide motion debug data' : 'Show motion debug data'}
          accessibilityRole="switch"
          accessibilityState={{ checked: isMotionDebugVisible }}
          onPress={() => setIsMotionDebugVisible((isVisible) => !isVisible)}
          style={[styles.motionDebugToggle, isMotionDebugVisible ? styles.motionDebugToggleActive : null]}
        >
          <Text style={styles.motionDebugToggleText}>
            {isMotionDebugVisible ? 'Hide motion debug' : 'Motion debug'}
          </Text>
        </AnimatedPressable>

        {isMotionDebugVisible ? <MotionDebugPanel active={isChallengeActive} debug={motionCounter.debug} /> : null}

        {hasReachedGoal ? (
          <View style={styles.goalBanner}>
            <Text style={styles.goalBannerText}>Daily goal reached. Beautiful work.</Text>
          </View>
        ) : null}

        <View style={styles.challengeAction}>
          <AnimatedPressable
            activePulse={isChallengeActive}
            accessibilityLabel={isChallengeActive ? 'Pause challenge' : 'Start challenge'}
            accessibilityRole="button"
            onPress={async () => {
              if (!isChallengeActive) {
                setActiveChallengeGoal(challengeGoal);
                setIsChallengeActive(true);
                const startedAt = Date.now();
                setChallengeStartAt(startedAt);
                setSessionClock(startedAt);
                setProgressResetKey((currentKey) => currentKey + 1);
                setStepReplayKey((currentKey) => currentKey + 1);
                return;
              }

              // Pausing/stopping the active challenge session
              setIsChallengeActive(false);
              const endAt = Date.now();
              const startAt = challengeStartAt ?? endAt;
              const sessionChallengeGoal = activeChallengeGoal ?? challengeGoal;
              const delta = motionCounter.steps;

              if (delta > 0) {
                const today = getTodayString();
                try {
                  const session = {
                    startedAt: new Date(startAt).toISOString(),
                    endedAt: new Date(endAt).toISOString(),
                    challengeGoal: sessionChallengeGoal,
                    steps: delta,
                    durationMs: endAt - startAt,
                    source: 'live-sensor' as const,
                  };
                  await saveChallengeSession(today, session);
                  setTodayChallengeSteps((currentSteps) => currentSteps + delta);
                  setRecentSessions(await readChallengeSessionsForRange(challengeHistoryRange));
                  setChallengeReward({
                    durationMs: session.durationMs,
                    goalPercent: sessionChallengeGoal > 0 ? Math.min(100, (delta / sessionChallengeGoal) * 100) : 0,
                    steps: delta,
                  });
                  if (user !== null) {
                    const result = await syncChallengeSession({
                      date: today,
                      session,
                      source: 'live-sensor',
                      userId: user.uid,
                    });
                    if (!result.ok) {
                      showServerToast(result.message, 'error');
                    } else {
                      await publishOwnSharedProfileSnapshot({
                        displayName,
                        userId: user.uid,
                      });
                    }
                  }
                  showSessionToast(`+${delta.toLocaleString()} session steps added`);
                  triggerSuccessHaptic();
                } catch (error) {
                  console.warn('Unable to save challenge session', error);
                  showServerToast('Challenge session did not save.', 'error');
                }
              } else {
                showSessionToast('No session steps added');
              }

              setChallengeStartAt(null);
              setActiveChallengeGoal(null);
              setProgressResetKey((currentKey) => currentKey + 1);
              setStepReplayKey((currentKey) => currentKey + 1);
            }}
            style={[
              styles.challengeButton,
              isChallengeActive ? styles.challengeStopButton : styles.challengeStartButton,
            ]}
          >
            <Text style={[styles.challengeButtonText, isChallengeActive ? { color: COLORS.onDanger } : null]}>
              {isChallengeActive ? 'Pause Challenge' : 'Start Challenge'}
            </Text>
          </AnimatedPressable>
        </View>
      </View>

      <View style={styles.historyMetrics}>
        <MetricCard label="Session" style={styles.historyMetricCard} value={currentChallengeDelta.toLocaleString()} />
        <MetricCard label="Pace" style={styles.historyMetricCard} value={`${sessionPace.toLocaleString()}/min`} />
        <MetricCard label="Duration" style={styles.historyMetricCard} value={formatDuration(sessionDurationMs)} />
        <MetricCard
          label="Source"
          style={styles.historyMetricCard}
          value={motionCounter.isAvailable ? 'Motion' : '-'}
        />
      </View>

      <ChallengeHistoryPanel
        challengeGoal={challengeGoal}
        range={challengeHistoryRange}
        onRangeChange={(nextRange) => {
          setChallengeHistoryRange(nextRange);
          void readChallengeSessionsForRange(nextRange).then(setRecentSessions);
        }}
        sessions={recentSessions}
      />
    </AppScreen>
  );
}

const sumSessionSteps = (sessions: { steps: number }[]): number =>
  sessions.reduce((total, session) => total + Math.max(0, Math.floor(session.steps)), 0);

const readChallengeSessionsForRange = async (
  range: ChallengeHistoryRange,
): Promise<(ChallengeSession & { date: string })[]> => {
  if (range === 'day') {
    const date = getTodayString();
    const sessions = await readChallengeSessions(date);
    return sessions
      .map((session) => ({ ...session, date }))
      .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
  }

  if (range === 'week') {
    return readChallengeSessionsForRecentDays(7);
  }

  return readAllChallengeSessions();
};

const getChallengeAvatarCaption = (state: AvatarAnimationKey, isChallengeActive: boolean): string => {
  if (state === 'move') {
    return 'Phone movement detected';
  }

  if (state === 'run') {
    return isChallengeActive ? 'Running detected' : 'Fast movement detected';
  }

  if (state === 'walk') {
    return 'Walking detected';
  }

  return isChallengeActive ? 'Listening for movement' : 'Ready to move';
};

type DailyChallengeTotal = {
  date: string;
  sessions: number;
  steps: number;
};

const getDailyChallengeTotals = (sessions: (ChallengeSession & { date: string })[]): DailyChallengeTotal[] => {
  const totalsByDate = new Map<string, DailyChallengeTotal>();

  sessions.forEach((session) => {
    const current = totalsByDate.get(session.date) ?? { date: session.date, sessions: 0, steps: 0 };
    current.sessions += 1;
    current.steps += Math.max(0, Math.floor(session.steps));
    totalsByDate.set(session.date, current);
  });

  return Array.from(totalsByDate.values()).sort(
    (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
  );
};

const getChallengeHistoryTitle = (range: ChallengeHistoryRange): string => {
  if (range === 'day') {
    return "Today's challenges";
  }

  if (range === 'week') {
    return 'Weekly challenge history';
  }

  return 'All challenge history';
};

const getChallengeHistorySubtitle = (range: ChallengeHistoryRange): string => {
  if (range === 'day') {
    return 'Every challenge session saved today.';
  }

  if (range === 'week') {
    return 'Challenge sessions from the last seven days.';
  }

  return 'All locally saved challenge sessions.';
};

const getRelativeHeight = (steps: number, maxSteps: number): number =>
  Math.max(5, Math.min(100, (steps / Math.max(1, maxSteps)) * 100));

const formatCompactSteps = (steps: number): string => {
  if (steps >= 1000) {
    return `${Math.round(steps / 100) / 10}k`;
  }

  return String(steps);
};

const formatChallengeDateLabel = (date: string, range: ChallengeHistoryRange): string => {
  if (range === 'day') {
    return 'Today';
  }

  return parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

type ChallengeHistoryPanelProps = {
  challengeGoal: number;
  onRangeChange: (range: ChallengeHistoryRange) => void;
  range: ChallengeHistoryRange;
  sessions: (ChallengeSession & { date: string })[];
};

const ChallengeHistoryPanel = ({ challengeGoal, onRangeChange, range, sessions }: ChallengeHistoryPanelProps) => {
  const visibleSessions = sessions;
  const totalSteps = sessions.reduce((total, session) => total + Math.max(0, Math.floor(session.steps)), 0);
  const totalDuration = sessions.reduce((total, session) => total + Math.max(0, session.durationMs), 0);
  const bestSession = sessions.reduce<ChallengeHistoryPanelProps['sessions'][number] | null>(
    (best, session) => (best === null || session.steps > best.steps ? session : best),
    null,
  );
  const dailyTotals = getDailyChallengeTotals(sessions);
  const maxDailySteps = Math.max(1, ...dailyTotals.map((entry) => entry.steps));

  return (
    <SurfacePanel style={styles.historyPanel}>
      <View style={styles.historyHeader}>
        <View>
          <Text style={styles.historyTitle}>{getChallengeHistoryTitle(range)}</Text>
          <Text style={styles.historySubtitle}>{getChallengeHistorySubtitle(range)}</Text>
        </View>
        <Text style={styles.historyGoal}>{`${challengeGoal.toLocaleString()} goal`}</Text>
      </View>
      <SegmentedTabs
        onChange={onRangeChange}
        options={[
          { icon: 'calendar-outline', label: 'Day', value: 'day' },
          { icon: 'stats-chart-outline', label: 'Week', value: 'week' },
          { icon: 'albums-outline', label: 'All', value: 'all' },
        ]}
        value={range}
      />
      <View style={styles.historyMetrics}>
        <MetricCard label="Sessions" style={styles.historyMetricCard} value={sessions.length.toLocaleString()} />
        <MetricCard label="Steps" style={styles.historyMetricCard} value={totalSteps.toLocaleString()} />
        <MetricCard label="Time" style={styles.historyMetricCard} value={formatDuration(totalDuration)} />
        <MetricCard
          label="Best"
          style={styles.historyMetricCard}
          value={bestSession === null ? '0' : bestSession.steps.toLocaleString()}
        />
      </View>
      <View style={styles.challengeGraphPanel}>
        <View style={styles.challengeGraphHeader}>
          <Text style={styles.challengeGraphTitle}>{range === 'day' ? 'Sessions today' : 'Steps by day'}</Text>
          <Text style={styles.challengeGraphHint}>
            {dailyTotals.length === 0 ? 'empty' : `${dailyTotals.length} ${dailyTotals.length === 1 ? 'day' : 'days'}`}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.challengeGraph}>
            {dailyTotals.length === 0 ? (
              <View style={styles.emptyGraphBar} />
            ) : (
              dailyTotals.map((entry) => (
                <View key={entry.date} style={styles.challengeGraphColumn}>
                  <View style={styles.challengeGraphTrack}>
                    <View
                      style={[
                        styles.challengeGraphFill,
                        { height: `${getRelativeHeight(entry.steps, maxDailySteps)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.challengeGraphLabel}>{formatChallengeDateLabel(entry.date, range)}</Text>
                  <Text style={styles.challengeGraphValue}>{formatCompactSteps(entry.steps)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
      <View style={styles.historyList}>
        {visibleSessions.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyHistoryTitle}>No challenge sessions yet</Text>
            <Text style={styles.emptyHistoryText}>
              {range === 'day'
                ? 'Start and pause a challenge to save a session today.'
                : 'Start and pause a challenge to save your first session.'}
            </Text>
          </View>
        ) : (
          visibleSessions.map((session) => (
            <ChallengeHistoryRow key={`${session.date}-${session.startedAt}`} session={session} />
          ))
        )}
      </View>
    </SurfacePanel>
  );
};

type ChallengeHistoryRowProps = {
  session: ChallengeSession & { date: string };
};

const ChallengeHistoryRow = ({ session }: ChallengeHistoryRowProps) => {
  const progress = Math.min(
    1,
    session.challengeGoal === undefined ? 0 : session.steps / Math.max(1, session.challengeGoal),
  );

  return (
    <View style={styles.historyRow}>
      <View style={styles.historyDateBlock}>
        <Text style={styles.historyDay}>{formatSessionDay(session.startedAt)}</Text>
        <Text style={styles.historyTime}>{formatSessionTime(session.startedAt)}</Text>
      </View>
      <View style={styles.historyBody}>
        <View style={styles.historyTopLine}>
          <Text style={styles.historySteps}>{`${session.steps.toLocaleString()} steps`}</Text>
          <Text style={styles.historyPace}>{`${getSessionPace(session).toLocaleString()}/min`}</Text>
        </View>
        <View style={styles.historyTrack}>
          <View style={[styles.historyFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text
          style={styles.historyMeta}
        >{`${formatDuration(session.durationMs)} · ${session.source ?? 'live-sensor'}`}</Text>
      </View>
    </View>
  );
};

const getSessionPace = (session: ChallengeSession): number =>
  session.durationMs <= 0 ? 0 : Math.round(session.steps / Math.max(1, session.durationMs / 60000));

const formatSessionDay = (timestamp: string): string =>
  new Date(timestamp).toLocaleDateString(undefined, { weekday: 'short' });

const formatSessionTime = (timestamp: string): string =>
  new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
