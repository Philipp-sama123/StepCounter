import { Ionicons } from '@expo/vector-icons';
import { Accelerometer, DeviceMotion, Gyroscope, Magnetometer } from 'expo-sensors';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, TextStyle, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthContext';
import { AnimatedPressable } from '../src/components/AnimatedPressable';
import { AnimatedStepCount } from '../src/components/AnimatedStepCount';
import { GoalModal } from '../src/components/GoalModal';
import { ProgressRing } from '../src/components/ProgressRing';
import { StatusBadge } from '../src/components/StatusBadge';
import { ToastMessageItem, ToastStack } from '../src/components/ToastMessage';
import { COLORS, DEFAULT_GOAL } from '../src/constants';
import { syncChallengeSession } from '../src/firebase/stepsSync';
import { StepDataSource } from '../src/health/types';
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

type AccelerometerSample = {
    magnitude: number;
    timestamp: string;
    x: number;
    y: number;
    z: number;
};

type GenericSensorSample = {
    headline: string;
    line: string;
    timestamp: string;
};

export default function ChallengeScreen() {
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
    } = useStepCounter('live');
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
    const [accelerometerAvailable, setAccelerometerAvailable] = useState<boolean | null>(null);
    const [accelerometerLog, setAccelerometerLog] = useState<AccelerometerSample[]>([]);
    const [gyroscopeAvailable, setGyroscopeAvailable] = useState<boolean | null>(null);
    const [gyroscopeLog, setGyroscopeLog] = useState<GenericSensorSample[]>([]);
    const [deviceMotionAvailable, setDeviceMotionAvailable] = useState<boolean | null>(null);
    const [deviceMotionLog, setDeviceMotionLog] = useState<GenericSensorSample[]>([]);
    const [magnetometerAvailable, setMagnetometerAvailable] = useState<boolean | null>(null);
    const [magnetometerLog, setMagnetometerLog] = useState<GenericSensorSample[]>([]);
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
        setToastMessages((currentMessages) => appendToast(currentMessages, { message }));
    };

    const showSessionToast = (message: string): void => {
        setSessionToastMessages((currentMessages) => appendToast(currentMessages, { message, variant: 'standard' }));
    };

    const showServerToast = (message: string, variant: ToastMessageItem['variant'] = 'standard'): void => {
        setServerToastMessages((currentMessages) => appendToast(currentMessages, { message, variant }));
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
        if (!isChallengeActive) {
            return undefined;
        }

        const timer = setInterval(() => {
            setSessionClock(Date.now());
        }, 1000);

        return () => {
            clearInterval(timer);
        };
    }, [isChallengeActive]);

    useEffect(() => {
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
    }, []);

    useEffect(() => {
        let isMounted = true;
        let gyroscopeSubscription: ReturnType<typeof Gyroscope.addListener> | null = null;
        let deviceMotionSubscription: ReturnType<typeof DeviceMotion.addListener> | null = null;
        let magnetometerSubscription: ReturnType<typeof Magnetometer.addListener> | null = null;

        const startMotionSensors = async (): Promise<void> => {
            try {
                const [hasGyroscope, hasDeviceMotion, hasMagnetometer] = await Promise.all([
                    Gyroscope.isAvailableAsync(),
                    DeviceMotion.isAvailableAsync(),
                    Magnetometer.isAvailableAsync(),
                ]);

                if (!isMounted) {
                    return;
                }

                setGyroscopeAvailable(hasGyroscope);
                setDeviceMotionAvailable(hasDeviceMotion);
                setMagnetometerAvailable(hasMagnetometer);

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

                if (hasDeviceMotion) {
                    DeviceMotion.setUpdateInterval(650);
                    deviceMotionSubscription = DeviceMotion.addListener((measurement) => {
                        const acceleration = getMotionVector(measurement.acceleration)
                            ?? getMotionVector(measurement.accelerationIncludingGravity);
                        if (acceleration === null) {
                            return;
                        }

                        const rotationRate = getRotationRate(measurement.rotationRate);
                        const accelerationMagnitude = getVectorMagnitude(acceleration.x, acceleration.y, acceleration.z);
                        const rotationText = rotationRate === null
                            ? 'rot unavailable'
                            : `rot ${formatAxis(rotationRate.alpha)}/${formatAxis(rotationRate.beta)}/${formatAxis(rotationRate.gamma)} deg/s`;

                        setDeviceMotionLog((currentLog) => [
                            {
                                headline: `${formatAxis(accelerationMagnitude)} m/s2`,
                                line: `acc ${formatAxis(acceleration.x)}/${formatAxis(acceleration.y)}/${formatAxis(acceleration.z)}  ${rotationText}`,
                                timestamp: new Date().toISOString(),
                            },
                            ...currentLog,
                        ].slice(0, 120));
                    });
                }

                if (hasMagnetometer) {
                    Magnetometer.setUpdateInterval(650);
                    magnetometerSubscription = Magnetometer.addListener(({ x, y, z }) => {
                        const magnitude = getVectorMagnitude(x, y, z);
                        setMagnetometerLog((currentLog) => [
                            {
                                headline: `${formatAxis(magnitude)} uT`,
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
                    setDeviceMotionAvailable(false);
                    setMagnetometerAvailable(false);
                }
            }
        };

        void startMotionSensors();

        return () => {
            isMounted = false;
            gyroscopeSubscription?.remove();
            deviceMotionSubscription?.remove();
            magnetometerSubscription?.remove();
        };
    }, []);

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
    const challengeGoalPercent = currentChallengeGoal > 0 ? Math.min(100, (currentChallengeDelta / currentChallengeGoal) * 100) : 0;
    const dailyChallengeGoalPercent = dailyChallengeGoal > 0 ? Math.min(100, (idleChallengeSteps / dailyChallengeGoal) * 100) : 0;
    const rollingAverages = getRollingAverages({
        accelerometerLog,
        deviceMotionLog,
        gyroscopeLog,
        magnetometerLog,
        nowMs: sessionClock,
        sensorLog,
    });

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar style="dark" />
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.subtitle}>Challenge Mode</Text>
                        <Text style={styles.appName}>{displayName}</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <AnimatedPressable
                            accessibilityLabel="Edit challenge goal"
                            accessibilityRole="button"
                            onPress={() => {
                                setGoalModalMode('session-challenge');
                                setIsGoalModalVisible(true);
                            }}
                            style={styles.iconButton}
                        >
                            <Ionicons color={COLORS.text} name="settings-outline" size={24} />
                        </AnimatedPressable>
                        <AnimatedPressable
                            accessibilityLabel="Sign out"
                            accessibilityRole="button"
                            onPress={() => {
                                void signOutUser();
                            }}
                            style={styles.iconButton}
                        >
                            <Ionicons color={COLORS.text} name="log-out-outline" size={23} />
                        </AnimatedPressable>
                    </View>
                </View>

                <View style={styles.hero}>
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
                        <AnimatedPressable
                            accessibilityLabel="Refresh sensor step data"
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
                    )}

                    {hasReachedGoal ? (
                        <View style={styles.goalBanner}>
                            <Text style={styles.goalBannerText}>Daily goal reached. Beautiful work.</Text>
                        </View>
                    ) : null}

                    <View style={{ marginTop: 12, alignItems: 'center' }}>
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
                                        if (user !== null) {
                                            const result = await syncChallengeSession({
                                                date: today,
                                                session,
                                                source,
                                                userId: user.uid,
                                            });
                                            if (!result.ok) {
                                                showServerToast(result.message, 'error');
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
                            <Text style={[styles.challengeButtonText, isChallengeActive ? { color: COLORS.surface } : null]}>
                                {isChallengeActive ? 'Pause Challenge' : 'Start Challenge'}
                            </Text>
                        </AnimatedPressable>

                    </View>
                </View>

                <View style={styles.sensorSection}>
                    <View style={styles.averagePanel}>
                        <View style={styles.averageHeader}>
                            <View>
                                <Text style={styles.averageTitle}>Movement insight</Text>
                                <Text style={styles.averageDescription}>Animated live signals from your last minute of movement.</Text>
                            </View>
                            <Text style={styles.averageMeta}>{isChallengeActive ? 'running' : 'idle'}</Text>
                        </View>
                        <View style={styles.averageGrid}>
                            <AverageMetric label="Cadence" suffix="/min" value={rollingAverages.stepsPerMinute} />
                            <AverageMetric label="Acceleration" suffix="g" value={rollingAverages.accelerometerMagnitude} />
                            <AverageMetric label="Rotation" suffix="rad/s" value={rollingAverages.gyroscopeMagnitude} />
                        </View>
                    </View>

                    <View style={styles.sensorSummary}>
                        <View style={styles.sensorSummaryItem}>
                            <Text style={styles.sensorSummaryLabel}>Source</Text>
                            <Text style={styles.sensorSummaryValue}>{getSourceLabel(source)}</Text>
                        </View>
                        <View style={styles.sensorSummaryItem}>
                            <Text style={styles.sensorSummaryLabel}>Session</Text>
                            <Text style={styles.sensorSummaryValue}>{currentChallengeDelta.toLocaleString()}</Text>
                        </View>
                        <View style={styles.sensorSummaryItem}>
                            <Text style={styles.sensorSummaryLabel}>Pace</Text>
                            <Text style={styles.sensorSummaryValue}>{`${sessionPace.toLocaleString()}/min`}</Text>
                        </View>
                    </View>

                    <View style={styles.challengeDetailPanel}>
                        <View style={styles.challengeDetailItem}>
                            <Ionicons color={COLORS.challenge} name="timer-outline" size={18} />
                            <View>
                                <Text style={styles.challengeDetailLabel}>Duration</Text>
                                <Text style={styles.challengeDetailValue}>{formatDuration(sessionDurationMs)}</Text>
                            </View>
                        </View>
                        <View style={styles.challengeDetailItem}>
                            <Ionicons color={COLORS.challenge} name="flag-outline" size={18} />
                            <View>
                                <Text style={styles.challengeDetailLabel}>{isChallengeActive ? 'Challenge goal' : 'Daily challenge'}</Text>
                                <Text style={styles.challengeDetailValueOrange}>
                                    {`${(isChallengeActive ? challengeGoalPercent : dailyChallengeGoalPercent).toFixed(1)}%`}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.challengeDetailItem}>
                            <Ionicons color={COLORS.challenge} name="walk-outline" size={18} />
                            <View>
                                <Text style={styles.challengeDetailLabel}>{isChallengeActive ? 'Goal steps' : 'Daily goal'}</Text>
                                <Text style={styles.challengeDetailValueOrange}>
                                    {isChallengeActive ? currentChallengeGoal.toLocaleString() : dailyChallengeGoal.toLocaleString()}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.sensorHint}>{debugMessage}</Text>
                </View>
            </ScrollView>

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
        </SafeAreaView>
    );
}

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

const formatLogTime = (timestamp: string): string => new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
});

const formatReferenceSync = (timestamp: string | null): string => {
    if (timestamp === null) {
        return 'not loaded';
    }

    return new Date(timestamp).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatDuration = (durationMs: number): string => {
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const sumSessionSteps = (sessions: Array<{ steps: number }>): number =>
    sessions.reduce((total, session) => total + Math.max(0, Math.floor(session.steps)), 0);

const appendToast = (
    currentMessages: ToastMessageItem[],
    nextMessage: Omit<ToastMessageItem, 'id'>,
): ToastMessageItem[] => {
    const hasDuplicateVisible = currentMessages.some((message) =>
        message.message === nextMessage.message && (message.variant ?? 'success') === (nextMessage.variant ?? 'success'),
    );

    if (hasDuplicateVisible) {
        return currentMessages;
    }

    return [
        ...currentMessages.slice(-2),
        {
            ...nextMessage,
            id: Date.now() + Math.floor(Math.random() * 1000),
        },
    ];
};

const getAccelerationMagnitude = (x: number, y: number, z: number): number =>
    Math.sqrt(x * x + y * y + z * z);

type MotionVector = {
    x: number;
    y: number;
    z: number;
};

type RotationRate = {
    alpha: number;
    beta: number;
    gamma: number;
};

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const getMotionVector = (value: unknown): MotionVector | null => {
    if (typeof value !== 'object' || value === null) {
        return null;
    }

    const vector = value as Partial<MotionVector>;
    if (!isFiniteNumber(vector.x) || !isFiniteNumber(vector.y) || !isFiniteNumber(vector.z)) {
        return null;
    }

    return {
        x: vector.x,
        y: vector.y,
        z: vector.z,
    };
};

const getRotationRate = (value: unknown): RotationRate | null => {
    if (typeof value !== 'object' || value === null) {
        return null;
    }

    const rotation = value as Partial<RotationRate>;
    if (!isFiniteNumber(rotation.alpha) || !isFiniteNumber(rotation.beta) || !isFiniteNumber(rotation.gamma)) {
        return null;
    }

    return {
        alpha: rotation.alpha,
        beta: rotation.beta,
        gamma: rotation.gamma,
    };
};

const getVectorMagnitude = (x: number, y: number, z: number): number =>
    Math.sqrt(x * x + y * y + z * z);

const formatAxis = (value: number): string => value.toFixed(2);

const formatAcceleration = (value: number): string => `${value.toFixed(2)}g`;

type RollingAverageInput = {
    accelerometerLog: AccelerometerSample[];
    deviceMotionLog: GenericSensorSample[];
    gyroscopeLog: GenericSensorSample[];
    magnetometerLog: GenericSensorSample[];
    nowMs: number;
    sensorLog: Array<{ delta: number; timestamp: string }>;
};

type RollingAverages = {
    accelerometerMagnitude: number;
    deviceMotionMagnitude: number;
    gyroscopeMagnitude: number;
    magnetometerMagnitude: number;
    stepsPerMinute: number;
};

const getRollingAverages = ({
    accelerometerLog,
    deviceMotionLog,
    gyroscopeLog,
    magnetometerLog,
    nowMs,
    sensorLog,
}: RollingAverageInput): RollingAverages => {
    const cutoffMs = nowMs - 60000;
    const recentStepEvents = sensorLog.filter((entry) => new Date(entry.timestamp).getTime() >= cutoffMs);
    const stepsPerMinute = recentStepEvents.reduce((total, entry) => total + Math.max(0, entry.delta), 0);

    return {
        accelerometerMagnitude: averageNumbers(accelerometerLog
            .filter((entry) => new Date(entry.timestamp).getTime() >= cutoffMs)
            .map((entry) => entry.magnitude)),
        deviceMotionMagnitude: averageNumbers(deviceMotionLog
            .filter((entry) => new Date(entry.timestamp).getTime() >= cutoffMs)
            .map((entry) => parseLeadingNumber(entry.headline))),
        gyroscopeMagnitude: averageNumbers(gyroscopeLog
            .filter((entry) => new Date(entry.timestamp).getTime() >= cutoffMs)
            .map((entry) => parseLeadingNumber(entry.headline))),
        magnetometerMagnitude: averageNumbers(magnetometerLog
            .filter((entry) => new Date(entry.timestamp).getTime() >= cutoffMs)
            .map((entry) => parseLeadingNumber(entry.headline))),
        stepsPerMinute,
    };
};

const averageNumbers = (values: number[]): number => {
    const safeValues = values.filter(Number.isFinite);
    if (safeValues.length === 0) {
        return 0;
    }

    return safeValues.reduce((total, value) => total + value, 0) / safeValues.length;
};

const parseLeadingNumber = (value: string): number => {
    const parsed = Number(value.split(' ')[0]);
    return Number.isFinite(parsed) ? parsed : 0;
};

type AverageMetricProps = {
    label: string;
    suffix: string;
    value: number;
};

const AverageMetric = ({ label, suffix, value }: AverageMetricProps) => (
    <View style={styles.averageMetric}>
        <Text style={styles.averageMetricLabel}>{label}</Text>
        <View style={styles.averageValueRow}>
            <AnimatedMetricNumber value={value} style={styles.averageMetricValue} />
            <Text style={styles.averageMetricSuffix}>{suffix}</Text>
        </View>
    </View>
);

type AnimatedMetricNumberProps = {
    style: TextStyle;
    value: number;
};

const AnimatedMetricNumber = ({ style, value }: AnimatedMetricNumberProps) => {
    const animatedValue = useRef(new Animated.Value(value)).current;
    const [displayValue, setDisplayValue] = useState(value);
    const bounceScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const listenerId = animatedValue.addListener(({ value: nextValue }) => {
            setDisplayValue(nextValue);
        });

        return () => {
            animatedValue.removeListener(listenerId);
        };
    }, [animatedValue]);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(animatedValue, {
                duration: 520,
                toValue: value,
                useNativeDriver: false,
            }),
            Animated.sequence([
                Animated.spring(bounceScale, {
                    friction: 5,
                    tension: 160,
                    toValue: 1.08,
                    useNativeDriver: true,
                }),
                Animated.spring(bounceScale, {
                    friction: 6,
                    tension: 150,
                    toValue: 1,
                    useNativeDriver: true,
                }),
            ]),
        ]).start();
    }, [animatedValue, bounceScale, value]);

    return (
        <Animated.Text style={[style, { transform: [{ scale: bounceScale }] }]}>
            {displayValue >= 100 ? Math.round(displayValue).toLocaleString() : displayValue.toFixed(2)}
        </Animated.Text>
    );
};

type SensorConsoleProps = {
    available: boolean | null;
    description: string;
    log: GenericSensorSample[];
    metrics: SensorExplanationItem[];
    title: string;
    unitLabel: string;
};

type SensorExplanationItem = {
    label: string;
    text: string;
};

type SensorExplanationProps = {
    description: string;
    items: SensorExplanationItem[];
};

const SensorExplanation = ({ description, items }: SensorExplanationProps) => (
    <View style={styles.sensorExplanation}>
        <Text style={styles.sensorDescription}>{description}</Text>
        {items.map((item) => (
            <View key={item.label} style={styles.sensorExplanationRow}>
                <Text style={styles.sensorExplanationLabel}>{item.label}</Text>
                <Text style={styles.sensorExplanationText}>{item.text}</Text>
            </View>
        ))}
    </View>
);

type ReferenceCardProps = {
    label: string;
    note?: string;
    value: string;
};

const ReferenceCard = ({ label, note, value }: ReferenceCardProps) => (
    <View style={styles.referenceCard}>
        <Text style={styles.referenceLabel}>{label}</Text>
        <Text style={styles.referenceValue}>{value}</Text>
        {note === undefined ? null : <Text style={styles.referenceNote} numberOfLines={2}>{note}</Text>}
    </View>
);

const SensorConsole = ({ available, description, log, metrics, title, unitLabel }: SensorConsoleProps) => (
    <View style={styles.sensorConsole}>
        <View style={styles.consoleHeader}>
            <Text style={styles.consoleTitle}>{title}</Text>
            <Text style={styles.consoleMeta}>{available === false ? 'unavailable' : 'last 10'}</Text>
        </View>
        <SensorExplanation description={description} items={metrics} />
        {log.length > 0 ? (
            <>
                <View style={styles.sensorCurrent}>
                    <Text style={styles.sensorCurrentValue}>{log[0].headline}</Text>
                    <Text style={styles.sensorCurrentLabel}>{unitLabel}</Text>
                </View>
                <View style={styles.consoleLogBox}>
                    {log.slice(0, 10).map((entry, index) => (
                        <View key={`${entry.timestamp}-${index}`} style={styles.consoleRow}>
                            <Text style={styles.consoleTime}>{formatLogTime(entry.timestamp)}</Text>
                            <Text style={styles.consoleLine}>{entry.line}</Text>
                        </View>
                    ))}
                </View>
            </>
        ) : (
            <View style={styles.consoleLogBox}>
                <Text style={styles.consoleEmpty}>
                    {available === false ? `${title.toLowerCase()} unavailable on this device` : `waiting for ${title.toLowerCase()} events...`}
                </Text>
            </View>
        )}
    </View>
);

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    container: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 32,
        marginTop: 8,
    },
    subtitle: {
        color: COLORS.mutedText,
        fontSize: 16,
        fontWeight: '500',
    },
    appName: {
        color: COLORS.text,
        fontSize: 28,
        fontWeight: 'bold',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    iconButton: {
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 8,
        height: 40,
        justifyContent: 'center',
        width: 40,
    },
    hero: {
        alignItems: 'center',
        marginBottom: 32,
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
        marginBottom: 16,
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
        color: COLORS.surface,
        fontSize: 14,
        fontWeight: '600',
    },
    refreshButton: {
        alignItems: 'center',
        backgroundColor: COLORS.action,
        borderRadius: 8,
        flexDirection: 'row',
        gap: 8,
        height: 40,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    pressed: {
        opacity: 0.8,
    },
    refreshing: {
        opacity: 0.9,
    },
    refreshButtonText: {
        color: COLORS.surface,
        fontSize: 14,
        fontWeight: '600',
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
        color: COLORS.surface,
        fontSize: 14,
        fontWeight: '600',
    },
    sensorSection: {
        gap: 12,
        marginBottom: 28,
    },
    averagePanel: {
        backgroundColor: COLORS.challengeSoft,
        borderColor: COLORS.challenge,
        borderRadius: 8,
        borderWidth: 1,
        gap: 12,
        padding: 14,
    },
    averageHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    averageTitle: {
        color: COLORS.challenge,
        fontSize: 15,
        fontWeight: '900',
    },
    averageDescription: {
        color: COLORS.text,
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 17,
        marginTop: 2,
    },
    averageMeta: {
        color: COLORS.challenge,
        fontSize: 11,
        fontWeight: '800',
    },
    averageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    averageMetric: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.challenge,
        borderRadius: 8,
        borderWidth: 1,
        minHeight: 76,
        paddingHorizontal: 10,
        paddingVertical: 10,
        width: '31%',
    },
    averageMetricLabel: {
        color: COLORS.mutedText,
        fontSize: 11,
        fontWeight: '900',
        marginBottom: 6,
    },
    averageValueRow: {
        alignItems: 'flex-end',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    averageMetricValue: {
        color: COLORS.challenge,
        fontSize: 18,
        fontWeight: '900',
    },
    averageMetricSuffix: {
        color: COLORS.challenge,
        fontSize: 10,
        fontWeight: '800',
        paddingBottom: 2,
    },
    sensorSummary: {
        flexDirection: 'row',
        gap: 12,
    },
    sensorSummaryItem: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.border,
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    sensorSummaryLabel: {
        color: COLORS.mutedText,
        fontSize: 12,
        fontWeight: '800',
        marginBottom: 4,
    },
    sensorSummaryValue: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '800',
    },
    challengeDetailPanel: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.border,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    challengeDetailItem: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: 10,
    },
    challengeDetailLabel: {
        color: COLORS.mutedText,
        fontSize: 12,
        fontWeight: '800',
    },
    challengeDetailValue: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: '900',
    },
    challengeDetailValueOrange: {
        color: COLORS.challenge,
        fontSize: 15,
        fontWeight: '900',
    },
    advancedPanel: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.border,
        borderRadius: 8,
        borderWidth: 1,
        overflow: 'hidden',
    },
    advancedToggle: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
        minHeight: 68,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    advancedToggleCopy: {
        flex: 1,
        gap: 3,
    },
    advancedToggleTitle: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: '900',
    },
    advancedToggleText: {
        color: COLORS.mutedText,
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 17,
    },
    advancedContent: {
        borderTopColor: COLORS.border,
        borderTopWidth: 1,
        gap: 12,
        padding: 14,
    },
    referencePanel: {
        backgroundColor: COLORS.challengeSoft,
        borderColor: COLORS.challenge,
        borderRadius: 8,
        borderWidth: 1,
        gap: 12,
        padding: 12,
    },
    referenceHeader: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'space-between',
    },
    referenceTitle: {
        color: COLORS.challenge,
        fontSize: 15,
        fontWeight: '900',
    },
    referenceSubtitle: {
        color: COLORS.text,
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 17,
        marginTop: 2,
    },
    referenceSynced: {
        color: COLORS.challenge,
        fontSize: 11,
        fontWeight: '900',
    },
    referenceGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    referenceCard: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.challenge,
        borderRadius: 8,
        borderWidth: 1,
        minHeight: 76,
        paddingHorizontal: 10,
        paddingVertical: 9,
        width: '31%',
    },
    referenceLabel: {
        color: COLORS.mutedText,
        fontSize: 11,
        fontWeight: '900',
        marginBottom: 5,
    },
    referenceValue: {
        color: COLORS.challenge,
        fontSize: 16,
        fontWeight: '900',
    },
    referenceNote: {
        color: COLORS.mutedText,
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 13,
        marginTop: 4,
    },
    sensorConsole: {
        borderTopColor: COLORS.border,
        borderTopWidth: 1,
        paddingTop: 18,
    },
    consoleHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    consoleTitle: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: '900',
    },
    consoleMeta: {
        color: COLORS.challenge,
        fontSize: 12,
        fontWeight: '800',
    },
    consoleLogBox: {
        backgroundColor: '#08110D',
        borderColor: '#173528',
        borderRadius: 8,
        borderWidth: 1,
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    consoleRow: {
        flexDirection: 'row',
        gap: 10,
        paddingVertical: 4,
    },
    consoleTime: {
        color: '#7CE7A8',
        fontFamily: 'monospace',
        fontSize: 12,
        width: 72,
    },
    consoleLine: {
        color: '#D9FFE8',
        flex: 1,
        fontFamily: 'monospace',
        fontSize: 12,
    },
    consoleEmpty: {
        color: '#7CE7A8',
        fontFamily: 'monospace',
        fontSize: 12,
    },
    sensorExplanation: {
        gap: 7,
        marginBottom: 12,
    },
    sensorDescription: {
        color: COLORS.text,
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 17,
    },
    sensorExplanationRow: {
        flexDirection: 'row',
        gap: 8,
    },
    sensorExplanationLabel: {
        color: COLORS.challenge,
        fontSize: 11,
        fontWeight: '900',
        minWidth: 68,
    },
    sensorExplanationText: {
        color: COLORS.mutedText,
        flex: 1,
        fontSize: 11,
        fontWeight: '700',
        lineHeight: 15,
    },
    sensorCurrent: {
        alignItems: 'center',
        backgroundColor: COLORS.challengeSoft,
        borderColor: COLORS.challenge,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 10,
        paddingVertical: 10,
    },
    sensorCurrentValue: {
        color: COLORS.challenge,
        fontFamily: 'monospace',
        fontSize: 22,
        fontWeight: '900',
    },
    sensorCurrentLabel: {
        color: COLORS.challenge,
        fontSize: 11,
        fontWeight: '800',
        marginTop: 2,
    },
    sensorHint: {
        color: COLORS.mutedText,
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 18,
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
        color: COLORS.challengeText,
        fontSize: 15,
        fontWeight: '800',
    },
});
