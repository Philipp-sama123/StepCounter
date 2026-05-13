import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthContext';
import { AnimatedPressable } from '../src/components/AnimatedPressable';
import { GoalModal } from '../src/components/GoalModal';
import { ProfileModal } from '../src/components/ProfileModal';
import { ToastMessageItem, ToastStack } from '../src/components/ToastMessage';
import { WeightTrendChart } from '../src/components/WeightTrendChart';
import { COLORS, DEFAULT_GOAL } from '../src/constants';
import {
  readBodyProfileFromFirestore,
  readWeightEntriesFromFirestore,
  syncBodyProfile,
  syncWeightEntry,
} from '../src/firebase/profileSync';
import {
  getBmi,
  createWeightEntry,
  readBodyProfile,
  readRecentWeightEntries,
  saveBodyProfile,
  saveWeightEntry,
  UserBodyProfile,
  WeightEntry,
} from '../src/storage/profileStorage';
import { readGoal, saveGoal } from '../src/storage/stepStorage';

export default function ProfileScreen() {
  const { signOutUser, user } = useAuth();
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [bodyProfile, setBodyProfile] = useState<UserBodyProfile | null>(null);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [isGoalModalVisible, setIsGoalModalVisible] = useState(false);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [toastMessages, setToastMessages] = useState<ToastMessageItem[]>([]);
  const [graphReplayKey, setGraphReplayKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadProfile = async (): Promise<void> => {
        const [storedGoal, localProfile, localWeights] = await Promise.all([
          readGoal(),
          readBodyProfile(),
          readRecentWeightEntries(),
        ]);
        const [remoteProfile, remoteWeights] = user === null
          ? [null, []]
          : await Promise.all([
            readBodyProfileFromFirestore(user.uid),
            readWeightEntriesFromFirestore(user.uid),
          ]);

        if (!isActive) {
          return;
        }

        const nextProfile = getNewestProfile(localProfile, remoteProfile);
        const nextWeights = mergeWeightEntries(localWeights, remoteWeights);
        setGoal(storedGoal);
        setBodyProfile(nextProfile);
        setWeightEntries(nextWeights);

        if (remoteProfile !== null) {
          void saveBodyProfile(remoteProfile);
        }

        await Promise.all(nextWeights.map(saveWeightEntry));
      };

      setGraphReplayKey((currentKey) => currentKey + 1);
      void loadProfile();

      return () => {
        isActive = false;
      };
    }, [user]),
  );

  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'Profile';
  const bmi = bodyProfile === null ? 0 : getBmi(bodyProfile.heightCm, bodyProfile.currentWeightKg);
  const latestWeight = weightEntries[weightEntries.length - 1]?.weightKg ?? bodyProfile?.currentWeightKg ?? 0;

  const handleSaveGoal = async (nextGoal: number): Promise<void> => {
    setGoal(nextGoal);
    setIsGoalModalVisible(false);
    await saveGoal(nextGoal);
    showToast('Daily goal saved.', 'standard');
  };

  const handleSaveProfile = async (profile: UserBodyProfile): Promise<void> => {
    const shouldWriteWeight = profile.weightTrackingEnabled && profile.currentWeightKg > 0;
    const nextWeightEntry = createWeightEntry(profile.currentWeightKg);

    setBodyProfile(profile);
    setIsProfileModalVisible(false);
    await saveBodyProfile(profile);

    if (shouldWriteWeight) {
      await saveWeightEntry(nextWeightEntry);
      setWeightEntries((currentEntries) => mergeWeightEntries(currentEntries, [nextWeightEntry]));
    }

    if (user === null) {
      showToast('Profile saved locally. Sign in to sync it.', 'standard');
      return;
    }

    const profileResult = await syncBodyProfile(user.uid, profile);
    const weightResult = shouldWriteWeight
      ? await syncWeightEntry(user.uid, nextWeightEntry)
      : { message: 'Profile saved to Firestore.', ok: true };
    const ok = profileResult.ok && weightResult.ok;
    showToast(ok ? 'Profile saved to Firestore.' : 'Could not save all profile data.', ok ? 'standard' : 'error');
  };

  const showToast = (message: string, variant: ToastMessageItem['variant'] = 'standard'): void => {
    setToastMessages((currentMessages) => [...currentMessages, { id: Date.now() + currentMessages.length, message, variant }]);
  };

  const hideToast = (id: number): void => {
    setToastMessages((currentMessages) => currentMessages.filter((message) => message.id !== id));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>Account</Text>
            <Text style={styles.title}>{displayName}</Text>
          </View>
          <AnimatedPressable
            accessibilityLabel="Sign out"
            accessibilityRole="button"
            onPress={() => {
              void signOutUser();
            }}
            style={styles.logoutButton}
          >
            <Ionicons color={COLORS.surface} name="log-out-outline" size={18} />
            <Text style={styles.logoutText}>Logout</Text>
          </AnimatedPressable>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard label="Daily goal" value={goal.toLocaleString()} />
          <MetricCard label="Height" value={bodyProfile?.heightCm ? `${bodyProfile.heightCm.toLocaleString()} cm` : '-'} />
          <MetricCard label="Weight" value={latestWeight > 0 ? `${latestWeight.toLocaleString()} kg` : '-'} />
          <MetricCard label="BMI" value={bmi > 0 ? bmi.toFixed(1) : '-'} />
        </View>

        <View style={styles.actionPanel}>
          <AnimatedPressable
            accessibilityLabel="Edit profile"
            accessibilityRole="button"
            onPress={() => setIsProfileModalVisible(true)}
            style={styles.actionButton}
          >
            <Ionicons color={COLORS.surface} name="person-circle-outline" size={19} />
            <Text style={styles.actionButtonText}>Edit profile</Text>
          </AnimatedPressable>
          <AnimatedPressable
            accessibilityLabel="Edit daily goal"
            accessibilityRole="button"
            onPress={() => setIsGoalModalVisible(true)}
            style={styles.secondaryActionButton}
          >
            <Ionicons color={COLORS.action} name="flag-outline" size={19} />
            <Text style={styles.secondaryActionText}>Daily step goal</Text>
          </AnimatedPressable>
        </View>

        <WeightTrendChart animationKey={graphReplayKey} entries={weightEntries} profile={bodyProfile} />
      </ScrollView>

      <GoalModal
        currentGoal={goal}
        isVisible={isGoalModalVisible}
        onClose={() => setIsGoalModalVisible(false)}
        onSave={(nextGoal) => {
          void handleSaveGoal(nextGoal);
        }}
      />
      <ProfileModal
        isVisible={isProfileModalVisible}
        onClose={() => setIsProfileModalVisible(false)}
        onSave={(nextProfile) => {
          void handleSaveProfile(nextProfile);
        }}
        profile={bodyProfile}
      />
      <ToastStack messages={toastMessages} onHide={hideToast} placement="center" />
    </SafeAreaView>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
};

const MetricCard = ({ label, value }: MetricCardProps) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

const mergeWeightEntries = (localEntries: WeightEntry[], remoteEntries: WeightEntry[]): WeightEntry[] => {
  const entriesById = new Map<string, WeightEntry>();
  [...localEntries, ...remoteEntries].forEach((entry) => {
    entriesById.set(entry.id, entry);
  });

  return Array.from(entriesById.values()).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
};

const getNewestProfile = (localProfile: UserBodyProfile | null, remoteProfile: UserBodyProfile | null): UserBodyProfile | null => {
  if (localProfile === null) {
    return remoteProfile;
  }

  if (remoteProfile === null) {
    return localProfile;
  }

  const localTime = localProfile.updatedAt === undefined ? 0 : new Date(localProfile.updatedAt).getTime();
  const remoteTime = remoteProfile.updatedAt === undefined ? 0 : new Date(remoteProfile.updatedAt).getTime();
  return remoteTime > localTime ? remoteProfile : localProfile;
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '900',
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 13,
  },
  logoutText: {
    color: COLORS.surface,
    fontSize: 13,
    fontWeight: '900',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    minHeight: 86,
    borderRadius: 8,
    padding: 14,
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricLabel: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: '900',
  },
  actionPanel: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: COLORS.action,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  actionButtonText: {
    color: COLORS.surface,
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryActionButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  secondaryActionText: {
    color: COLORS.action,
    fontSize: 15,
    fontWeight: '900',
  },
});
