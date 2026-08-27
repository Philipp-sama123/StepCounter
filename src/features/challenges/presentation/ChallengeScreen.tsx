import { useIsFocused } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';

import { useAuth } from '../../../auth/AuthContext';
import { AnimatedPressable } from '../../../components/AnimatedPressable';
import { AnimatedStepCount } from '../../../components/AnimatedStepCount';
import { DashboardAvatar } from '../../../components/avatar/DashboardAvatar';
import { ChallengeRewardOverlay } from '../../../components/challenge/ChallengeRewardOverlay';
import { ChallengeSourceTabs } from '../../../components/challenge/ChallengeSourceTabs';
import { MovementInsightPanel } from '../../../components/challenge/MovementInsightPanel';
import { GoalModal } from '../../../components/GoalModal';
import { AppScreen } from '../../../components/layout/AppScreen';
import { HeaderIconButton } from '../../../components/layout/HeaderIconButton';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProgressRing } from '../../../components/ProgressRing';
import { SegmentedTabs } from '../../../components/SegmentedTabs';
import { StatusBadge } from '../../../components/StatusBadge';
import { ToastStack } from '../../../components/ToastMessage';
import { AppButton } from '../../../components/ui/AppButton';
import { MetricCard } from '../../../components/ui/MetricCard';
import { SurfacePanel } from '../../../components/ui/SurfacePanel';
import { COLORS, DEFAULT_GOAL, STATUS_STOPPED_DELAY_MS } from '../../../constants';
import { syncChallengeSession } from '../../../firebase/stepsSync';
import { useCalculatedStepCounter } from '../../../hooks/useCalculatedStepCounter';
import { useStepCounter } from '../../../hooks/useStepCounter';
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
import {
  formatAxis,
  getAccelerationMagnitude,
  getRollingAverages,
  getVectorMagnitude,
} from '../../../utils/challengeMetrics';
import { triggerErrorHaptic, triggerSuccessHaptic } from '../../../utils/haptics';
import { appendToastMessage } from '../../../utils/toastQueue';

import { styles } from './ChallengeScreen.styles';

import type { ChallengeReward } from '../../../components/challenge/ChallengeRewardOverlay';
import type { ChallengeTrackingMode } from '../../../components/challenge/ChallengeSourceTabs';
import type { ToastMessageItem } from '../../../components/ToastMessage';
import type { AvatarAnimationKey } from '../../../config/avatarSprites';
import type { StepDataSource } from '../../../health/types';
import type { WalkingStatus } from '../../../hooks/useStepCounter';
import type { AccelerometerSample, GenericSensorSample } from '../../../utils/challengeMetrics';
import type { ChallengeSession } from '../domain/models';

type ChallengeHistoryRange = 'day' | 'week' | 'all';

export default function ChallengeScreen() {
  const [trackingMode, setTrackingMode] = useState<ChallengeTrackingMode>('live');
  const isFocused = useIsFocused();
  const isLiveMode = trackingMode === 'live';
  const systemStepCounter = useStepCounter('system', isFocused && !isLiveMode);
  const calculatedStepCounter = useCalculatedStepCounter(isFocused && isLiveMode);
  const debugMessage = isLiveMode ? calculatedStepCounter.debugMessage : systemStepCounter.debugMessage;
  const isAvailable = isLiveMode ? calculatedStepCounter.isAvailable : systemStepCounter.isAvailable;
  const isRefreshing = isLiveMode ? false : systemStepCounter.isRefreshing;
  const refreshSteps = systemStepCounter.refreshSteps;
  const requestPermissions = systemStepCounter.requestPermissions;
  const source: StepDataSource = isLiveMode ? 'live-sensor' : systemStepCounter.source;
  const status: WalkingStatus = isLiveMode
    ? getCalculatedWalkingStatus(calculatedStepCounter.detectorDecision, calculatedStepCounter.elapsedMsSinceStep)
    : systemStepCounter.status;
  const todaySteps = isLiveMode ? calculatedStepCounter.steps : systemStepCounter.todaySteps;
  const canRefresh = !isLiveMode && systemStepCounter.canRefresh;
  const sensorLog = isLiveMode ? getCalculatedSensorLog(calculatedStepCounter.log) : systemStepCounter.sensorLog;
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
  const [challengeStartSteps, setChallengeStartSteps] = useState<number | null>(null);
  const [challengeStartAt, setChallengeStartAt] = useState<number | null>(null);
  const [progressResetKey, setProgressResetKey] = useState(0);
  const [stepReplayKey, setStepReplayKey] = useState(0);
  const [sessionClock, setSessionClock] = useState(Date.now());
  const [toastMessages, setToastMessages] = useState<ToastMessageItem[]>([]);
  const [sessionToastMessages, setSessionToastMessages] = useState<ToastMessageItem[]>([]);
  const [serverToastMessages, setServerToastMessages] = useState<ToastMessageItem[]>([]);
  const [challengeReward, setChallengeReward] = useState<ChallengeReward | null>(null);
  const [, setAccelerometerAvailable] = useState<boolean | null>(null);
  const [accelerometerLog, setAccelerometerLog] = useState<AccelerometerSample[]>([]);
  const [, setGyroscopeAvailable] = useState<boolean | null>(null);
  const [gyroscopeLog, setGyroscopeLog] = useState<GenericSensorSample[]>([]);
  const sessionOpacity = useRef(new Animated.Value(1)).current;

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

  const handleRefreshSteps = async (): Promise<void> => {
    const message = await refreshSteps();
    showToast(message);
    setRecentSessions(await readChallengeSessionsForRange(challengeHistoryRange));
    setProgressResetKey((currentKey) => currentKey + 1);
    setStepReplayKey((currentKey) => currentKey + 1);
  };

  const showToast = (message: string): void => {
    setToastMessages((currentMessages) => appendToastMessage(currentMessages, { message }));
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

  const hideToast = (id: number): void => {
    setToastMessages((currentMessages) => currentMessages.filter((message) => message.id !== id));
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

  useEffect(() => {
    if (!isChallengeActive || !isFocused || isLiveMode) {
      setAccelerometerAvailable(null);
      setAccelerometerLog([]);
      return undefined;
    }

    let isMounted = true;
    let subscription: ReturnType<typeof Accelerometer.addListener> | null = null;

    const startAccelerometer = async (): Promise<void> => {
      try {
        const available = await Accelerometer.isAvailableAsync();
        if (!isMounted) {
          return;
        }

        setAccelerometerAvailable(available);
        if (!available) {
          return;
        }

        Accelerometer.setUpdateInterval(650);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          const sample = {
            magnitude: getAccelerationMagnitude(x, y, z),
            timestamp: new Date().toISOString(),
            x,
            y,
            z,
          };
          setAccelerometerLog((currentLog) => [sample, ...currentLog].slice(0, 120));
        });
      } catch (error) {
        console.warn('Unable to read accelerometer data.', error);
        if (isMounted) {
          setAccelerometerAvailable(false);
        }
      }
    };

    void startAccelerometer();

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, [isChallengeActive, isFocused, isLiveMode]);

  useEffect(() => {
    if (!isChallengeActive || !isFocused || isLiveMode) {
      setGyroscopeAvailable(null);
      setGyroscopeLog([]);
      return undefined;
    }

    let isMounted = true;
    let gyroscopeSubscription: ReturnType<typeof Gyroscope.addListener> | null = null;

    const startMotionSensors = async (): Promise<void> => {
      try {
        const hasGyroscope = await Gyroscope.isAvailableAsync();

        if (!isMounted) {
          return;
        }

        setGyroscopeAvailable(hasGyroscope);

        if (hasGyroscope) {
          Gyroscope.setUpdateInterval(650);
          gyroscopeSubscription = Gyroscope.addListener(({ x, y, z }) => {
            const magnitude = getVectorMagnitude(x, y, z);
            setGyroscopeLog((currentLog) =>
              [
                {
                  headline: `${formatAxis(magnitude)} rad/s`,
                  line: `x ${formatAxis(x)}  y ${formatAxis(y)}  z ${formatAxis(z)}`,
                  timestamp: new Date().toISOString(),
                },
                ...currentLog,
              ].slice(0, 120),
            );
          });
        }
      } catch (error) {
        console.warn('Unable to read motion sensor data.', error);
        if (isMounted) {
          setGyroscopeAvailable(false);
        }
      }
    };

    void startMotionSensors();

    return () => {
      isMounted = false;
      gyroscopeSubscription?.remove();
    };
  }, [isChallengeActive, isFocused, isLiveMode]);

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

  const hasReachedGoal = todaySteps >= goal;
  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'there';

  const currentChallengeDelta = challengeStartSteps !== null ? Math.max(0, todaySteps - challengeStartSteps) : 0;
  const currentChallengeGoal = activeChallengeGoal ?? challengeGoal;
  const idleChallengeSteps = todayChallengeSteps;
  const ringSteps = isChallengeActive ? currentChallengeDelta : idleChallengeSteps;
  const ringGoal = isChallengeActive ? currentChallengeGoal : dailyChallengeGoal;
  const sessionDurationMs =
    isChallengeActive && challengeStartAt !== null ? Math.max(0, sessionClock - challengeStartAt) : 0;
  const sessionMinutes = Math.max(1, sessionDurationMs / 60000);
  const sessionPace = isChallengeActive ? Math.round(currentChallengeDelta / sessionMinutes) : 0;
  const dailyChallengeGoalPercent =
    dailyChallengeGoal > 0 ? Math.min(100, (idleChallengeSteps / dailyChallengeGoal) * 100) : 0;
  const rollingAverages = getRollingAverages({
    accelerometerLog: isLiveMode ? getCalculatedAccelerometerLog(calculatedStepCounter.samples) : accelerometerLog,
    gyroscopeLog: isLiveMode ? getCalculatedGyroscopeLog(calculatedStepCounter.samples) : gyroscopeLog,
    nowMs: sessionClock,
    sensorLog,
  });
  const modeHint = isLiveMode
    ? 'Live mode uses the same calculated detector as Debug: acceleration peaks, rotation filtering, cadence, and confidence.'
    : 'Health data mode reads the system total. Best for comparing against Google Fit / Health Connect.';
  const challengeAvatarState = getChallengeAvatarState({
    detectorDecision: calculatedStepCounter.detectorDecision,
    isChallengeActive,
    isLiveMode,
    status,
  });

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
          <ToastStack messages={toastMessages} onHide={hideToast} />
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
        <ChallengeSourceTabs
          disabled={isChallengeActive}
          onChange={(nextMode) => {
            setTrackingMode(nextMode);
            setProgressResetKey((currentKey) => currentKey + 1);
            setStepReplayKey((currentKey) => currentKey + 1);
            showToast(`Challenge source changed to ${nextMode === 'live' ? 'Live sensor' : 'Health data'}.`);
          }}
          style={styles.modeTabs}
          value={trackingMode}
        />

        <View style={styles.challengeAvatarPanel}>
          <DashboardAvatar
            caption={getChallengeAvatarCaption(challengeAvatarState, isChallengeActive, isLiveMode)}
            state={challengeAvatarState}
            userId={user?.uid ?? null}
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
          <StatusBadge attention={isChallengeActive} status={status} />
          {!isAvailable && (
            <View style={styles.permissionContainer}>
              <Text style={styles.unsupported}>
                {isLiveMode ? 'Accelerometer unavailable on this device' : 'Permissions required for step tracking'}
              </Text>
              {!isLiveMode ? (
                <AnimatedPressable
                  accessibilityLabel="Request pedometer permissions"
                  accessibilityRole="button"
                  onPress={() => {
                    void requestPermissions();
                  }}
                  style={({ pressed }) => [styles.permissionButton, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.permissionButtonText}>Request Permissions</Text>
                </AnimatedPressable>
              ) : null}
            </View>
          )}
        </View>

        {canRefresh && (
          <AppButton
            accessibilityLabel={isLiveMode ? 'Refresh sensor step data' : 'Refresh health step data'}
            busy={isRefreshing}
            icon="refresh-outline"
            label={isLiveMode ? 'Refresh live' : 'Refresh health'}
            onPress={() => {
              void handleRefreshSteps();
            }}
            style={styles.refreshButton}
          />
        )}

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
                setChallengeStartSteps(todaySteps);
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
              const startSteps = challengeStartSteps ?? todaySteps;
              const sessionChallengeGoal = activeChallengeGoal ?? challengeGoal;
              const delta = Math.max(0, todaySteps - startSteps);

              if (delta > 0) {
                const today = getTodayString();
                try {
                  const session = {
                    startedAt: new Date(startAt).toISOString(),
                    endedAt: new Date(endAt).toISOString(),
                    challengeGoal: sessionChallengeGoal,
                    steps: delta,
                    durationMs: endAt - startAt,
                    source,
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
                      source,
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

              setChallengeStartSteps(null);
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

      <MovementInsightPanel
        currentChallengeDelta={currentChallengeDelta}
        currentChallengeGoal={currentChallengeGoal}
        dailyChallengeGoal={dailyChallengeGoal}
        dailyChallengeGoalPercent={dailyChallengeGoalPercent}
        debugMessage={debugMessage}
        isChallengeActive={isChallengeActive}
        rollingAverages={rollingAverages}
        sessionDurationMs={sessionDurationMs}
        sessionPace={sessionPace}
        source={source}
      />

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

const getCalculatedWalkingStatus = (decision: string, elapsedMsSinceStep: number | null): WalkingStatus => {
  if (decision === 'accepted') {
    return 'walking';
  }

  if (elapsedMsSinceStep !== null && elapsedMsSinceStep < STATUS_STOPPED_DELAY_MS) {
    return 'walking';
  }

  if (decision === 'rejected') {
    return 'stopped';
  }

  return 'unknown';
};

const getCalculatedSensorLog = (log: { steps: number; timestamp: string }[]) =>
  log.map((entry) => ({
    delta: 1,
    rawSteps: entry.steps,
    timestamp: entry.timestamp,
    totalSteps: entry.steps,
  }));

const getCalculatedAccelerometerLog = (samples: { motionG: number; timestamp: string }[]): AccelerometerSample[] =>
  samples.map((sample) => ({
    magnitude: sample.motionG,
    timestamp: sample.timestamp,
    x: sample.motionG,
    y: 0,
    z: 0,
  }));

const getCalculatedGyroscopeLog = (
  samples: { rotationRadPerSecond: number; timestamp: string }[],
): GenericSensorSample[] =>
  samples.map((sample) => ({
    headline: `${formatAxis(sample.rotationRadPerSecond)} rad/s`,
    line: `rotation ${formatAxis(sample.rotationRadPerSecond)} rad/s`,
    timestamp: sample.timestamp,
  }));

const getChallengeAvatarState = ({
  detectorDecision,
  isChallengeActive,
  isLiveMode,
  status,
}: {
  detectorDecision: string;
  isChallengeActive: boolean;
  isLiveMode: boolean;
  status: WalkingStatus;
}): AvatarAnimationKey => {
  if (isLiveMode && detectorDecision === 'accepted') {
    return 'run';
  }

  if (status === 'walking') {
    return isChallengeActive ? 'run' : 'walk';
  }

  return 'idle';
};

const getChallengeAvatarCaption = (
  state: AvatarAnimationKey,
  isChallengeActive: boolean,
  isLiveMode: boolean,
): string => {
  const sourceLabel = isLiveMode ? 'live sensor' : 'health data';

  if (state === 'run') {
    return isChallengeActive ? `${sourceLabel} challenge sprint` : `${sourceLabel} burst detected`;
  }

  if (state === 'walk') {
    return `${sourceLabel} walking`;
  }

  return isChallengeActive ? `${sourceLabel} listening` : `${sourceLabel} ready`;
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
