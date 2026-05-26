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
import { COLORS, DEFAULT_GOAL } from '../src/constants';
import { syncChallengeSession } from '../src/firebase/stepsSync';
import { publishOwnSharedProfileSnapshot } from '../src/services/sharedProfilePublish';
import { useStepCounter } from '../src/hooks/useStepCounter';
import {
    getTodayString,
    readChallengeGoal,
    readChallengeSessions,
    readDailyChallengeGoal,
    readGoal,
    saveChallengeGoal,
    saveChallengeSession,
    saveDailyChallengeGoal,
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

export default function ChallengeScreen() {
    const [trackingMode, setTrackingMode] = useState<ChallengeTrackingMode>('live');
    const isFocused = useIsFocused();
    const {
        debugMessage,
        isAvailable,
        isRefreshing,
        refreshSteps,
        requestPermissions,
        sensorLog,
        source,
        status,
        todaySteps,
        canRefresh,
    } = useStepCounter(trackingMode, isFocused);
    const { signOutUser, user } = useAuth();
    const [goal, setGoal] = useState(DEFAULT_GOAL);
    const [challengeGoal, setChallengeGoal] = useState(DEFAULT_GOAL);
    const [dailyChallengeGoal, setDailyChallengeGoal] = useState(DEFAULT_GOAL);
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
            const [storedGoal, storedChallengeGoal, storedDailyChallengeGoal, todaySessions] = await Promise.all([
                readGoal(),
                readChallengeGoal(),
                readDailyChallengeGoal(),
                readChallengeSessions(getTodayString()),
            ]);
            setGoal(storedGoal);
            setChallengeGoal(storedChallengeGoal);
            setDailyChallengeGoal(storedDailyChallengeGoal);
            setTodayChallengeSteps(sumSessionSteps(todaySessions));
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
        if (!isChallengeActive || !isFocused) {
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
    }, [isChallengeActive, isFocused]);

    useEffect(() => {
        if (!isChallengeActive || !isFocused) {
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
    }, [isChallengeActive, isFocused]);

    useFocusEffect(
        useCallback(() => {
            const loadTodayChallengeSteps = async (): Promise<void> => {
                setTodayChallengeSteps(sumSessionSteps(await readChallengeSessions(getTodayString())));
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
        accelerometerLog,
        gyroscopeLog,
        nowMs: sessionClock,
        sensorLog,
    });
    const isLiveMode = trackingMode === 'live';

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
                        overflowColor={COLORS.challengeText}
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
                        {isLiveMode
                            ? 'Live mode reacts while you walk. Best for testing immediate sensor behavior.'
                            : 'Health data mode reads the system total. Best for comparing against Google Fit / Health Connect.'}
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
                                <Text style={styles.unsupported}>Permissions required for step tracking</Text>
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

        </AppScreen>
    );
}

const sumSessionSteps = (sessions: Array<{ steps: number }>): number =>
    sessions.reduce((total, session) => total + Math.max(0, Math.floor(session.steps)), 0);

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
        backgroundColor: COLORS.primary,
        borderRadius: 8,
        height: 36,
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    permissionButtonText: {
        color: COLORS.onAccent,
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
        backgroundColor: COLORS.action,
    },
    challengeStopButton: {
        backgroundColor: COLORS.danger,
    },
    challengeButtonText: {
        color: COLORS.onAccent,
        fontSize: 15,
        fontWeight: '800',
    },
});
