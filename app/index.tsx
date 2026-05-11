import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { GoalModal } from '../src/components/GoalModal';
import { ProgressRing } from '../src/components/ProgressRing';
import { StatusBadge } from '../src/components/StatusBadge';
import { COLORS, DEFAULT_GOAL } from '../src/constants';
import { useStepCounter } from '../src/hooks/useStepCounter';
import { readGoal, saveGoal } from '../src/storage/stepStorage';

export default function HomeScreen() {
  const { todaySteps, isAvailable, status, isSystemTotalAvailable } = useStepCounter();
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [isGoalModalVisible, setIsGoalModalVisible] = useState(false);

  useEffect(() => {
    const loadGoal = async (): Promise<void> => {
      const storedGoal = await readGoal();
      setGoal(storedGoal);
    };

    void loadGoal();
  }, []);

  const handleSaveGoal = async (nextGoal: number): Promise<void> => {
    setGoal(nextGoal);
    setIsGoalModalVisible(false);
    await saveGoal(nextGoal);
  };

  const hasReachedGoal = todaySteps >= goal;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>StepCounter</Text>
            <Text style={styles.subtitle}>Today</Text>
          </View>
          <Pressable
            accessibilityLabel="Edit daily step goal"
            accessibilityRole="button"
            onPress={() => setIsGoalModalVisible(true)}
            style={styles.iconButton}
          >
            <Ionicons color={COLORS.text} name="settings-outline" size={24} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <ProgressRing goal={goal} steps={todaySteps} />
          <View style={styles.stepBlock}>
            <Text style={styles.stepCount}>{todaySteps.toLocaleString()}</Text>
            <Text style={styles.stepLabel}>steps</Text>
          </View>
          <Text style={styles.goalText}>Goal {goal.toLocaleString()}</Text>

          {isAvailable ? <StatusBadge status={status} /> : <Text style={styles.unsupported}>Not supported on this device</Text>}

          {isAvailable && !isSystemTotalAvailable ? (
            <Text style={styles.liveNote}>Android live tracking counts new steps while this app is open.</Text>
          ) : null}

          {hasReachedGoal ? (
            <View style={styles.goalBanner}>
              <Text style={styles.goalBannerText}>Daily goal reached. Beautiful work.</Text>
            </View>
          ) : null}
        </View>
      </View>

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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appName: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    color: COLORS.mutedText,
    fontSize: 15,
    fontWeight: '600',
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingBottom: 36,
  },
  stepBlock: {
    alignItems: 'center',
    gap: 4,
  },
  stepCount: {
    color: COLORS.text,
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
  unsupported: {
    color: COLORS.warning,
    fontSize: 14,
    fontWeight: '700',
  },
  liveNote: {
    maxWidth: 280,
    color: COLORS.mutedText,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
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
});
