import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthContext';
import { AnimatedPressable } from '../src/components/AnimatedPressable';
import { AnimatedStepCount } from '../src/components/AnimatedStepCount';
import { GoalModal } from '../src/components/GoalModal';
import { ProgressRing } from '../src/components/ProgressRing';
import { StatusBadge } from '../src/components/StatusBadge';
import { ToastMessageItem, ToastStack } from '../src/components/ToastMessage';
import { COLORS, DEFAULT_GOAL } from '../src/constants';
import { syncDailySteps } from '../src/firebase/stepsSync';
import { StepDataSource } from '../src/health/types';
import { useStepCounter } from '../src/hooks/useStepCounter';
import { getTodayString, readGoal, saveGoal, readStepsForDate, saveStepsForDate, saveChallengeSession } from '../src/storage/stepStorage';

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
    const [isGoalModalVisible, setIsGoalModalVisible] = useState(false);
    const [isChallengeActive, setIsChallengeActive] = useState(false);
    const [challengeStartSteps, setChallengeStartSteps] = useState<number | null>(null);
    const [challengeStartAt, setChallengeStartAt] = useState<number | null>(null);
    const [progressResetKey, setProgressResetKey] = useState(0);
    const [stepReplayKey, setStepReplayKey] = useState(0);
    const [toastMessages, setToastMessages] = useState<ToastMessageItem[]>([]);
    const [sessionToastMessages, setSessionToastMessages] = useState<ToastMessageItem[]>([]);
    const sessionOpacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const loadGoal = async (): Promise<void> => {
            const storedGoal = await readGoal();
            setGoal(storedGoal);
        };

        void loadGoal();
    }, []);

    useEffect(() => {
        if (user === null || todaySteps === 0) {
            return;
        }

        void syncDailySteps({
            date: getTodayString(),
            goal,
            source,
            steps: todaySteps,
            userId: user.uid,
        });
    }, [goal, source, todaySteps, user]);

    const handleSaveGoal = async (nextGoal: number): Promise<void> => {
        setGoal(nextGoal);
        setIsGoalModalVisible(false);
        await saveGoal(nextGoal);
    };

    const handleRefreshSteps = async (): Promise<void> => {
        const message = await refreshSteps();
        showToast(message);
        setProgressResetKey((currentKey) => currentKey + 1);
        setStepReplayKey((currentKey) => currentKey + 1);
    };

    const showToast = (message: string): void => {
        setToastMessages((currentMessages) => [...currentMessages, { id: Date.now() + currentMessages.length, message }]);
    };

    const showSessionToast = (message: string): void => {
        setSessionToastMessages((currentMessages) => [...currentMessages, { id: Date.now() + currentMessages.length, message }]);
    };

    const hideToast = (id: number): void => {
        setToastMessages((currentMessages) => currentMessages.filter((message) => message.id !== id));
    };

    const hideSessionToast = (id: number): void => {
        setSessionToastMessages((currentMessages) => currentMessages.filter((message) => message.id !== id));
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

    useFocusEffect(
        useCallback(() => {
            setProgressResetKey((currentKey) => currentKey + 1);
            setStepReplayKey((currentKey) => currentKey + 1);
        }, []),
    );

    const hasReachedGoal = todaySteps >= goal;
    const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'there';

    const currentChallengeDelta = challengeStartSteps !== null ? Math.max(0, todaySteps - challengeStartSteps) : 0;

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
                            accessibilityLabel="Edit daily step goal"
                            accessibilityRole="button"
                            onPress={() => setIsGoalModalVisible(true)}
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
                    <ProgressRing goal={goal} resetAnimationKey={progressResetKey} steps={isAvailable ? todaySteps : 0} />
                    <View style={styles.stepBlock}>
                        {isChallengeActive ? (
                            <Animated.View style={[styles.sessionStepsPanel, { opacity: sessionOpacity }]}>
                                <AnimatedStepCount replayKey={stepReplayKey} steps={currentChallengeDelta} style={styles.sessionStepCount} />
                                <Text style={styles.sessionStepLabel}>session steps</Text>
                            </Animated.View>
                        ) : (
                            <>
                                <AnimatedStepCount replayKey={stepReplayKey} steps={isAvailable ? todaySteps : 0} style={styles.stepCount} />
                                <Text style={styles.stepLabel}>steps today</Text>
                            </>
                        )}
                    </View>
                    <Text style={styles.goalText}>Goal {goal.toLocaleString()}</Text>

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
                                    setIsChallengeActive(true);
                                    setChallengeStartSteps(todaySteps);
                                    setChallengeStartAt(Date.now());
                                    return;
                                }

                                // Pausing/stopping the active challenge session
                                setIsChallengeActive(false);
                                const endAt = Date.now();
                                const startAt = challengeStartAt ?? endAt;
                                const startSteps = challengeStartSteps ?? todaySteps;
                                const delta = Math.max(0, todaySteps - startSteps);

                                if (delta > 0) {
                                    const today = getTodayString();
                                    try {
                                        const existing = await readStepsForDate(today);
                                        const newTotal = existing + delta;
                                        await saveStepsForDate(today, newTotal);
                                        await saveChallengeSession(today, {
                                            startedAt: new Date(startAt).toISOString(),
                                            endedAt: new Date(endAt).toISOString(),
                                            steps: delta,
                                            durationMs: endAt - startAt,
                                        });
                                        showSessionToast(`+${delta.toLocaleString()} session steps added`);
                                    } catch (error) {
                                        console.warn('Unable to save challenge session', error);
                                    }
                                } else {
                                    showSessionToast('No session steps added');
                                }

                                setChallengeStartSteps(null);
                                setChallengeStartAt(null);
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
                    <View style={styles.sensorSummary}>
                        <View style={styles.sensorSummaryItem}>
                            <Text style={styles.sensorSummaryLabel}>Source</Text>
                            <Text style={styles.sensorSummaryValue}>{getSourceLabel(source)}</Text>
                        </View>
                        <View style={styles.sensorSummaryItem}>
                            <Text style={styles.sensorSummaryLabel}>Session</Text>
                            <Text style={styles.sensorSummaryValue}>{currentChallengeDelta.toLocaleString()}</Text>
                        </View>
                    </View>

                    <View style={styles.sensorConsole}>
                        <View style={styles.consoleHeader}>
                            <Text style={styles.consoleTitle}>Live sensor log</Text>
                            <Text style={styles.consoleMeta}>last 5</Text>
                        </View>
                        {sensorLog.length > 0 ? (
                            sensorLog.map((entry) => (
                                <View key={`${entry.timestamp}-${entry.rawSteps}`} style={styles.consoleRow}>
                                    <Text style={styles.consoleTime}>{formatLogTime(entry.timestamp)}</Text>
                                    <Text style={styles.consoleLine}>{`raw ${entry.rawSteps.toLocaleString()}  +${entry.delta.toLocaleString()}  total ${entry.totalSteps.toLocaleString()}`}</Text>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.consoleEmpty}>waiting for live pedometer events...</Text>
                        )}
                    </View>

                    <Text style={styles.sensorHint}>{debugMessage}</Text>
                </View>
            </ScrollView>

            <GoalModal
                currentGoal={goal}
                isVisible={isGoalModalVisible}
                onClose={() => setIsGoalModalVisible(false)}
                onSave={(nextGoal) => {
                    void handleSaveGoal(nextGoal);
                }}
            />
            <ToastStack messages={toastMessages} onHide={hideToast} />
            <ToastStack messages={sessionToastMessages} onHide={hideSessionToast} placement="bottom" />
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
    sensorConsole: {
        backgroundColor: '#08110D',
        borderColor: '#173528',
        borderRadius: 8,
        borderWidth: 1,
        minHeight: 158,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    consoleHeader: {
        alignItems: 'center',
        borderBottomColor: '#173528',
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingBottom: 8,
    },
    consoleTitle: {
        color: '#E8FFF2',
        fontSize: 13,
        fontWeight: '900',
    },
    consoleMeta: {
        color: '#7CE7A8',
        fontSize: 12,
        fontWeight: '800',
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
