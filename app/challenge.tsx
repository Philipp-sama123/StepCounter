import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/auth/AuthContext';
import { AnimatedPressable } from '../src/components/AnimatedPressable';
import { AnimatedStepCount } from '../src/components/AnimatedStepCount';
import { ChallengeReward, ChallengeRewardOverlay } from '../src/components/challenge/ChallengeRewardOverlay';
import { ChallengeSourceTabs, ChallengeTrackingMode } from '../src/components/challenge/ChallengeSourceTabs';
import { MovementInsightPanel } from '../src/components/challenge/MovementInsightPanel';
import { GoalModal } from '../src/components/GoalModal';
import { AppScreen } from '../src/components/layout/AppScreen';
import { HeaderIconButton } from '../src/components/layout/HeaderIconButton';
import { PageHeader } from '../src/components/layout/PageHeader';
import { ProgressRing } from '../src/components/ProgressRing';
import { StatusBadge } from '../src/components/StatusBadge';
import { ToastMessageItem, ToastStack } from '../src/components/ToastMessage';
import { AppButton } from '../src/components/ui/AppButton';
import { MetricCard } from '../src/components/ui/MetricCard';
import { SurfacePanel } from '../src/components/ui/SurfacePanel';
import { COLORS, DEFAULT_GOAL, STATUS_STOPPED_DELAY_MS } from '../src/constants';
import { syncChallengeSession } from '../src/firebase/stepsSync';
import { StepDataSource } from '../src/health/types';
import { publishOwnSharedProfileSnapshot } from '../src/services/sharedProfilePublish';
import { useCalculatedStepCounter } from '../src/hooks/useCalculatedStepCounter';
import { useStepCounter, WalkingStatus } from '../src/hooks/useStepCounter';
import {
    getTodayString,
    readChallengeGoal,
    readChallengeSessions,
    readRecentChallengeSessions,
    readDailyChallengeGoal,
    readGoal,
    saveChallengeGoal,
    saveChallengeSession,
    saveDailyChallengeGoal,
    ChallengeSession,
} from '../src/storage/stepStorage';
import { appendToastMessage } from '../src/utils/toastQueue';
import {
    AccelerometerSample,
    formatAxis,
    getAccelerationMagnitude,
    getRollingAverages,
    getVectorMagnitude,
    GenericSensorSample,
} from '../src/utils/challengeMetrics';
import { triggerErrorHaptic, triggerSuccessHaptic } from '../src/utils/haptics';

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
    const [recentSessions, setRecentSessions] = useState<Array<ChallengeSession & { date: string }>>([]);
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
    const [accelerometerAvailable, setAccelerometerAvailable] = useState<boolean | null>(null);
    const [accelerometerLog, setAccelerometerLog] = useState<AccelerometerSample[]>([]);
    const [gyroscopeAvailable, setGyroscopeAvailable] = useState<boolean | null>(null);
    const [gyroscopeLog, setGyroscopeLog] = useState<GenericSensorSample[]>([]);
    const sessionOpacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const loadGoal = async (): Promise<void> => {
            const [storedGoal, storedChallengeGoal, storedDailyChallengeGoal, todaySessions, storedRecentSessions] = await Promise.all([
                readGoal(),
                readChallengeGoal(),
                readDailyChallengeGoal(),
                readChallengeSessions(getTodayString()),
                readRecentChallengeSessions(),
            ]);
            setGoal(storedGoal);
            setChallengeGoal(storedChallengeGoal);
            setDailyChallengeGoal(storedDailyChallengeGoal);
            setTodayChallengeSteps(sumSessionSteps(todaySessions));
            setRecentSessions(storedRecentSessions);
        };

        void loadGoal();
    }, []);

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
        setRecentSessions(await readRecentChallengeSessions());
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
                        setGyroscopeLog((currentLog) => [
                            {
                                headline: `${formatAxis(magnitude)} rad/s`,
                                line: `x ${formatAxis(x)}  y ${formatAxis(y)}  z ${formatAxis(z)}`,
                                timestamp: new Date().toISOString(),
                            },
                            ...currentLog,
                        ].slice(0, 120));
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
                    readRecentChallengeSessions(),
                ]);
                setTodayChallengeSteps(sumSessionSteps(todaySessions));
                setRecentSessions(storedRecentSessions);
            };

            void loadTodayChallengeSteps();
            setProgressResetKey((currentKey) => currentKey + 1);
            setStepReplayKey((currentKey) => currentKey + 1);
        }, []),
    );

    const hasReachedGoal = todaySteps >= goal;
    const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'there';

    const currentChallengeDelta = challengeStartSteps !== null ? Math.max(0, todaySteps - challengeStartSteps) : 0;
    const currentChallengeGoal = activeChallengeGoal ?? challengeGoal;
    const idleChallengeSteps = todayChallengeSteps;
    const ringSteps = isChallengeActive ? currentChallengeDelta : idleChallengeSteps;
    const ringGoal = isChallengeActive ? currentChallengeGoal : dailyChallengeGoal;
    const sessionDurationMs = isChallengeActive && challengeStartAt !== null ? Math.max(0, sessionClock - challengeStartAt) : 0;
    const sessionMinutes = Math.max(1, sessionDurationMs / 60000);
    const sessionPace = isChallengeActive ? Math.round(currentChallengeDelta / sessionMinutes) : 0;
    const dailyChallengeGoalPercent = dailyChallengeGoal > 0 ? Math.min(100, (idleChallengeSteps / dailyChallengeGoal) * 100) : 0;
    const rollingAverages = getRollingAverages({
        accelerometerLog: isLiveMode ? getCalculatedAccelerometerLog(calculatedStepCounter.samples) : accelerometerLog,
        gyroscopeLog: isLiveMode ? getCalculatedGyroscopeLog(calculatedStepCounter.samples) : gyroscopeLog,
        nowMs: sessionClock,
        sensorLog,
    });
    const modeHint = isLiveMode
        ? 'Live mode uses the same calculated detector as Debug: acceleration peaks, rotation filtering, cadence, and confidence.'
        : 'Health data mode reads the system total. Best for comparing against Google Fit / Health Connect.';

    return (
        <AppScreen
            contentStyle={styles.container}
            overlays={(
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
                    <ChallengeRewardOverlay
                        onDone={hideChallengeReward}
                        reward={challengeReward}
                    />
                </>
            )}
        >
                <PageHeader
                    accessory={(
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
                    )}
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
                                <AnimatedStepCount replayKey={stepReplayKey} steps={currentChallengeDelta} style={styles.sessionStepCount} />
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
                    <Text style={styles.modeHint}>
                        {modeHint}
                    </Text>

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
                                        setRecentSessions(await readRecentChallengeSessions());
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
                    sessions={recentSessions}
                />

        </AppScreen>
    );
}

const sumSessionSteps = (sessions: Array<{ steps: number }>): number =>
    sessions.reduce((total, session) => total + Math.max(0, Math.floor(session.steps)), 0);

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

const getCalculatedSensorLog = (log: Array<{ steps: number; timestamp: string }>) =>
    log.map((entry) => ({
        delta: 1,
        rawSteps: entry.steps,
        timestamp: entry.timestamp,
        totalSteps: entry.steps,
    }));

const getCalculatedAccelerometerLog = (samples: Array<{ motionG: number; timestamp: string }>): AccelerometerSample[] =>
    samples.map((sample) => ({
        magnitude: sample.motionG,
        timestamp: sample.timestamp,
        x: sample.motionG,
        y: 0,
        z: 0,
    }));

const getCalculatedGyroscopeLog = (samples: Array<{ rotationRadPerSecond: number; timestamp: string }>): GenericSensorSample[] =>
    samples.map((sample) => ({
        headline: `${formatAxis(sample.rotationRadPerSecond)} rad/s`,
        line: `rotation ${formatAxis(sample.rotationRadPerSecond)} rad/s`,
        timestamp: sample.timestamp,
    }));

type ChallengeHistoryPanelProps = {
    challengeGoal: number;
    sessions: Array<ChallengeSession & { date: string }>;
};

const ChallengeHistoryPanel = ({ challengeGoal, sessions }: ChallengeHistoryPanelProps) => {
    const visibleSessions = sessions.slice(0, 5);
    const totalSteps = sessions.reduce((total, session) => total + Math.max(0, Math.floor(session.steps)), 0);
    const bestSession = sessions.reduce<ChallengeHistoryPanelProps['sessions'][number] | null>(
        (best, session) => (best === null || session.steps > best.steps ? session : best),
        null,
    );

    return (
        <SurfacePanel style={styles.historyPanel}>
            <View style={styles.historyHeader}>
                <View>
                    <Text style={styles.historyTitle}>Challenge history</Text>
                    <Text style={styles.historySubtitle}>Recent sessions saved on this device.</Text>
                </View>
                <Text style={styles.historyGoal}>{`${challengeGoal.toLocaleString()} goal`}</Text>
            </View>
            <View style={styles.historyMetrics}>
                <MetricCard label="Sessions" style={styles.historyMetricCard} value={sessions.length.toLocaleString()} />
                <MetricCard label="Steps" style={styles.historyMetricCard} value={totalSteps.toLocaleString()} />
                <MetricCard label="Best" style={styles.historyMetricCard} value={bestSession === null ? '0' : bestSession.steps.toLocaleString()} />
            </View>
            <View style={styles.historyList}>
                {visibleSessions.length === 0 ? (
                    <View style={styles.emptyHistory}>
                        <Text style={styles.emptyHistoryTitle}>No challenge sessions yet</Text>
                        <Text style={styles.emptyHistoryText}>Start and pause a challenge to save your first session.</Text>
                    </View>
                ) : visibleSessions.map((session) => (
                    <ChallengeHistoryRow key={`${session.date}-${session.startedAt}`} session={session} />
                ))}
            </View>
        </SurfacePanel>
    );
};

type ChallengeHistoryRowProps = {
    session: ChallengeSession & { date: string };
};

const ChallengeHistoryRow = ({ session }: ChallengeHistoryRowProps) => {
    const progress = Math.min(1, session.challengeGoal === undefined ? 0 : session.steps / Math.max(1, session.challengeGoal));

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
                <Text style={styles.historyMeta}>{`${formatDuration(session.durationMs)} · ${session.source ?? 'live-sensor'}`}</Text>
            </View>
        </View>
    );
};

const getSessionPace = (session: ChallengeSession): number =>
    session.durationMs <= 0 ? 0 : Math.round(session.steps / Math.max(1, session.durationMs / 60000));

const formatDuration = (durationMs: number): string => {
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
};

const formatSessionDay = (timestamp: string): string =>
    new Date(timestamp).toLocaleDateString(undefined, { weekday: 'short' });

const formatSessionTime = (timestamp: string): string =>
    new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
    },
    hero: {
        alignItems: 'center',
        marginBottom: 32,
    },
    modeTabs: {
        marginBottom: 18,
    },
    stepBlock: {
        alignItems: 'center',
        marginBottom: 8,
    },
    stepCount: {
        color: COLORS.action,
        fontSize: 48,
        fontWeight: 'bold',
    },
    sessionStepsPanel: {
        alignItems: 'center',
        backgroundColor: COLORS.challengeSoft,
        borderColor: COLORS.challenge,
        borderRadius: 8,
        borderWidth: 1,
        minWidth: 190,
        paddingHorizontal: 18,
        paddingVertical: 10,
    },
    sessionStepCount: {
        color: COLORS.challenge,
        fontSize: 46,
        fontWeight: 'bold',
    },
    sessionStepLabel: {
        color: COLORS.challenge,
        fontSize: 14,
        fontWeight: '800',
    },
    stepLabel: {
        color: COLORS.text,
        fontSize: 16,
    },
    goalText: {
        color: COLORS.text,
        fontSize: 14,
        marginBottom: 6,
    },
    modeHint: {
        color: COLORS.mutedText,
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 17,
        marginBottom: 16,
        maxWidth: 310,
        textAlign: 'center',
    },
    goalButtons: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
    },
    goalPill: {
        backgroundColor: COLORS.challengeSoft,
        borderColor: COLORS.challenge,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    goalPillText: {
        color: COLORS.challenge,
        fontSize: 12,
        fontWeight: '900',
    },
    statusRow: {
        marginBottom: 16,
    },
    unsupported: {
        color: COLORS.stopped,
        fontSize: 14,
        textAlign: 'center',
    },
    permissionContainer: {
        alignItems: 'center',
        gap: 12,
    },
    permissionButton: {
        alignItems: 'center',
        backgroundColor: COLORS.button,
        borderRadius: 8,
        height: 36,
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    permissionButtonText: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: '600',
    },
    refreshButton: {
        height: 40,
        minHeight: 40,
    },
    pressed: {
        opacity: 0.8,
    },
    goalBanner: {
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        borderRadius: 8,
        marginTop: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    goalBannerText: {
        color: COLORS.onAccent,
        fontSize: 14,
        fontWeight: '600',
    },
    challengeAction: {
        alignItems: 'center',
        marginTop: 12,
    },
    challengeButton: {
        alignItems: 'center',
        borderRadius: 8,
        height: 44,
        justifyContent: 'center',
        paddingHorizontal: 18,
    },
    challengeStartButton: {
        backgroundColor: COLORS.button,
    },
    challengeStopButton: {
        backgroundColor: COLORS.danger,
    },
    challengeButtonText: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: '800',
    },
    historyPanel: {
        gap: 14,
    },
    historyHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    historyTitle: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '900',
    },
    historySubtitle: {
        color: COLORS.mutedText,
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 17,
        marginTop: 2,
    },
    historyGoal: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: '900',
    },
    historyMetrics: {
        flexDirection: 'row',
        gap: 8,
    },
    historyMetricCard: {
        flex: 1,
        minHeight: 72,
        width: undefined,
    },
    historyList: {
        gap: 10,
    },
    emptyHistory: {
        backgroundColor: COLORS.background,
        borderColor: COLORS.border,
        borderRadius: 8,
        borderWidth: 1,
        gap: 5,
        padding: 14,
    },
    emptyHistoryTitle: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: '900',
    },
    emptyHistoryText: {
        color: COLORS.mutedText,
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 17,
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
    historyDateBlock: {
        width: 58,
    },
    historyDay: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: '900',
    },
    historyTime: {
        color: COLORS.mutedText,
        fontSize: 10,
        fontWeight: '800',
        marginTop: 3,
    },
    historyBody: {
        flex: 1,
        gap: 7,
    },
    historyTopLine: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    historySteps: {
        color: COLORS.text,
        fontSize: 13,
        fontWeight: '900',
    },
    historyPace: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: '900',
    },
    historyTrack: {
        backgroundColor: COLORS.border,
        borderRadius: 999,
        height: 9,
        overflow: 'hidden',
    },
    historyFill: {
        backgroundColor: COLORS.challenge,
        borderRadius: 999,
        height: '100%',
    },
    historyMeta: {
        color: COLORS.mutedText,
        fontSize: 11,
        fontWeight: '700',
    },
});
