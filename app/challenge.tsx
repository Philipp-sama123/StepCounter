import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthContext';
import { GoalModal } from '../src/components/GoalModal';
import { ProgressRing } from '../src/components/ProgressRing';
import { StatusBadge } from '../src/components/StatusBadge';
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
        isSystemTotalAvailable,
        lastSyncedAt,
        refreshSteps,
        requestPermissions,
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

    const hasReachedGoal = todaySteps >= goal;
    const remainingSteps = Math.max(0, goal - todaySteps);
    const rawPercent = goal > 0 ? (todaySteps / goal) * 100 : 0;
    const progressPercent = Math.min(100, rawPercent);
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
                        <Pressable
                            accessibilityLabel="Edit daily step goal"
                            accessibilityRole="button"
                            onPress={() => setIsGoalModalVisible(true)}
                            style={styles.iconButton}
                        >
                            <Ionicons color={COLORS.text} name="settings-outline" size={24} />
                        </Pressable>
                        <Pressable
                            accessibilityLabel="Sign out"
                            accessibilityRole="button"
                            onPress={() => {
                                void signOutUser();
                            }}
                            style={styles.iconButton}
                        >
                            <Ionicons color={COLORS.text} name="log-out-outline" size={23} />
                        </Pressable>
                    </View>
                </View>

                <View style={styles.hero}>
                    <ProgressRing goal={goal} steps={isAvailable ? todaySteps : 0} />
                    <View style={styles.stepBlock}>
                        <Text style={styles.stepCount}>{(isAvailable ? todaySteps : 0).toLocaleString()}</Text>
                        <Text style={styles.stepLabel}>steps today</Text>
                    </View>
                    <Text style={styles.goalText}>Goal {goal.toLocaleString()}</Text>

                    <View style={styles.statusRow}>
            <StatusBadge status={status} />
            {!isAvailable && (
              <View style={styles.permissionContainer}>
                <Text style={styles.unsupported}>Permissions required for step tracking</Text>
                <Pressable
                  accessibilityLabel="Request pedometer permissions"
                  accessibilityRole="button"
                  onPress={() => {
                    void requestPermissions();
                  }}
                  style={({ pressed }) => [styles.permissionButton, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.permissionButtonText}>Request Permissions</Text>
                </Pressable>
              </View>
            )}
          </View>

                    {canRefresh && (
                        <Pressable
                            accessibilityLabel="Refresh sensor step data"
                            accessibilityRole="button"
                            disabled={isRefreshing}
                            onPress={() => {
                                void refreshSteps();
                            }}
                            style={({ pressed }) => [styles.refreshButton, pressed ? styles.pressed : null, isRefreshing ? styles.disabled : null]}
                        >
                            {isRefreshing ? <ActivityIndicator color={COLORS.surface} /> : <Ionicons color={COLORS.surface} name="refresh-outline" size={18} />}
                            <Text style={styles.refreshButtonText}>{isRefreshing ? 'Refreshing' : 'Refresh steps'}</Text>
                        </Pressable>
                    )}

                    {hasReachedGoal ? (
                        <View style={styles.goalBanner}>
                            <Text style={styles.goalBannerText}>Daily goal reached. Beautiful work.</Text>
                        </View>
                    ) : null}

                    <View style={{ marginTop: 12, alignItems: 'center' }}>
                        <Pressable
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
                                    } catch (error) {
                                        console.warn('Unable to save challenge session', error);
                                    }
                                }

                                setChallengeStartSteps(null);
                                setChallengeStartAt(null);
                            }}
                            style={({ pressed }) => [
                                styles.challengeButton,
                                isChallengeActive ? { backgroundColor: COLORS.danger } : null,
                                pressed ? styles.pressed : null,
                            ]}
                        >
                            <Text style={[styles.challengeButtonText, isChallengeActive ? { color: COLORS.surface } : null]}>
                                {isChallengeActive ? 'Pause Challenge' : 'Start Challenge'}
                            </Text>
                        </Pressable>

                        {isChallengeActive && (
                            <Text style={{ marginTop: 8, color: COLORS.mutedText }}>{`Session steps: ${currentChallengeDelta.toLocaleString()}`}</Text>
                        )}
                    </View>
                </View>

                <View style={styles.statsGrid}>
                    <StatCard label="Progress" value={`${progressPercent.toFixed(2)}%`} />
                    <StatCard label="Remaining" value={remainingSteps === 0 ? 'Done' : remainingSteps.toLocaleString()} />
                    <StatCard label="Source" value={getSourceLabel(source)} />
                    <StatCard label="Synced" value={formatSyncTime(lastSyncedAt)} />
                </View>

                <View style={styles.syncPanel}>
                    <View style={styles.syncIcon}>
                        <Ionicons color={COLORS.primary} name="fitness-outline" size={20} />
                    </View>
                    <View style={styles.syncCopy}>
                        <Text style={styles.syncTitle}>Live Sensor Tracking</Text>
                        <Text style={styles.syncText}>{debugMessage}</Text>
                    </View>
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
        </SafeAreaView>
    );
}

type StatCardProps = {
    label: string;
    value: string;
};

const StatCard = ({ label, value }: StatCardProps) => (
    <View style={styles.statCard}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
    </View>
);

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

const formatSyncTime = (lastSyncedAt: string | null): string => {
    if (lastSyncedAt === null) {
        return 'Not yet';
    }

    return new Date(lastSyncedAt).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });
};

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
        color: COLORS.textSecondary,
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
        color: COLORS.text,
        fontSize: 48,
        fontWeight: 'bold',
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
        backgroundColor: COLORS.primary,
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
    disabled: {
        opacity: 0.5,
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
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 32,
    },
    statCard: {
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 8,
        flex: 1,
        minWidth: '45%',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    statLabel: {
        color: COLORS.textSecondary,
        fontSize: 12,
        marginBottom: 4,
    },
    statValue: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '600',
    },
    syncPanel: {
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 8,
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    syncIcon: {
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        borderRadius: 20,
        height: 40,
        justifyContent: 'center',
        width: 40,
    },
    syncCopy: {
        flex: 1,
    },
    syncTitle: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    }
    ,
    challengeButton: {
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        borderRadius: 8,
        height: 44,
        justifyContent: 'center',
        paddingHorizontal: 18,
    },
    challengeButtonText: {
        color: COLORS.surface,
        fontSize: 15,
        fontWeight: '800',
    }
});