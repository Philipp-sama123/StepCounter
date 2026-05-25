import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/auth/AuthContext';
import { AnimatedPressable } from '../src/components/AnimatedPressable';
import { GoalModal } from '../src/components/GoalModal';
import { AppScreen } from '../src/components/layout/AppScreen';
import { PageHeader } from '../src/components/layout/PageHeader';
import { ProfileModal } from '../src/components/ProfileModal';
import { ProfileSharingPanel } from '../src/components/profile/ProfileSharingPanel';
import { RevealView } from '../src/components/RevealView';
import { ToastMessageItem, ToastStack } from '../src/components/ToastMessage';
import { AppButton } from '../src/components/ui/AppButton';
import { MetricCard } from '../src/components/ui/MetricCard';
import { SurfacePanel } from '../src/components/ui/SurfacePanel';
import { WeightTrendChart } from '../src/components/WeightTrendChart';
import { COLORS, DEFAULT_GOAL } from '../src/constants';
import {
  readBodyProfileFromFirestore,
  readWeightEntriesFromFirestore,
  syncBodyProfile,
  syncWeightEntry,
} from '../src/firebase/profileSync';
import { createShareCode, publishSharedProfile, readSharedProfile } from '../src/firebase/shareSync';
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
import { readImportedShareCode, readOwnShareCode, sanitizeShareCode, saveImportedShareCode, saveOwnShareCode } from '../src/storage/shareStorage';
import { readGoal, saveGoal } from '../src/storage/stepStorage';
import { appendToastMessage } from '../src/utils/toastQueue';

export default function ProfileScreen() {
  const { signOutUser, user } = useAuth();
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [bodyProfile, setBodyProfile] = useState<UserBodyProfile | null>(null);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [isGoalModalVisible, setIsGoalModalVisible] = useState(false);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [toastMessages, setToastMessages] = useState<ToastMessageItem[]>([]);
  const [graphReplayKey, setGraphReplayKey] = useState(0);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [importCode, setImportCode] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const shareSpin = useRef(new Animated.Value(0)).current;
  const importSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isSharing) {
      shareSpin.stopAnimation();
      shareSpin.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.timing(shareSpin, {
        duration: 850,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [isSharing, shareSpin]);

  useEffect(() => {
    if (!isImporting) {
      importSpin.stopAnimation();
      importSpin.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.timing(importSpin, {
        duration: 850,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [importSpin, isImporting]);

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
        setShareCode(await readOwnShareCode());
        setImportCode(await readImportedShareCode() ?? '');

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

  const handlePublishShareCode = async (): Promise<void> => {
    if (user === null) {
      showToast('Sign in before sharing your profile.', 'error');
      return;
    }

    setIsSharing(true);
    try {
      const nextCode = shareCode ?? createShareCode();
      const result = await publishSharedProfile({
        code: nextCode,
        displayName,
        userId: user.uid,
      });

      if (result.ok) {
        setShareCode(await saveOwnShareCode(result.code));
      }

      showToast(result.ok ? `${result.message} Shared history is refreshed.` : result.message, result.ok ? 'standard' : 'error');
    } catch (error) {
      console.warn('Unable to publish shared profile.', error);
      showToast('Could not publish shared history.', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const handleImportShareCode = async (): Promise<void> => {
    const normalizedCode = sanitizeShareCode(importCode);
    if (normalizedCode.length < 4) {
      showToast('Enter a valid share code.', 'error');
      return;
    }

    try {
      setIsImporting(true);
      const sharedProfile = await readSharedProfile(normalizedCode);
      if (sharedProfile === null) {
        showToast('No shared profile found for this code.', 'error');
        return;
      }

      setImportCode(await saveImportedShareCode(normalizedCode, sharedProfile.displayName));
      showToast(`Imported ${sharedProfile.displayName}.`, 'standard');
    } catch (error) {
      console.warn('Unable to import shared profile.', error);
      showToast('Could not import shared profile.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const showToast = (message: string, variant: ToastMessageItem['variant'] = 'standard'): void => {
    setToastMessages((currentMessages) => appendToastMessage(currentMessages, { message, variant }));
  };

  const hideToast = (id: number): void => {
    setToastMessages((currentMessages) => currentMessages.filter((message) => message.id !== id));
  };

  return (
    <AppScreen
      contentStyle={styles.container}
      overlays={(
        <>
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
        </>
      )}
    >
        <PageHeader
          accessory={(
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
          )}
          subtitle="Account"
          title={displayName}
        />

        <RevealView replayKey={graphReplayKey} style={styles.metricGrid}>
          <MetricCard label="Daily goal" style={styles.metricCard} value={goal.toLocaleString()} />
          <MetricCard label="Height" style={styles.metricCard} value={bodyProfile?.heightCm ? `${bodyProfile.heightCm.toLocaleString()} cm` : '-'} />
          <MetricCard label="Weight" style={styles.metricCard} value={latestWeight > 0 ? `${latestWeight.toLocaleString()} kg` : '-'} />
          <MetricCard label="BMI" style={styles.metricCard} value={bmi > 0 ? bmi.toFixed(1) : '-'} />
        </RevealView>

        <RevealView delay={80} replayKey={graphReplayKey}>
        <SurfacePanel style={styles.actionPanel}>
          <AppButton
            accessibilityLabel="Edit profile"
            icon="person-circle-outline"
            label="Edit profile"
            onPress={() => setIsProfileModalVisible(true)}
          />
          <AppButton
            accessibilityLabel="Edit daily goal"
            icon="flag-outline"
            label="Daily step goal"
            onPress={() => setIsGoalModalVisible(true)}
            variant="secondary"
          />
        </SurfacePanel>
        </RevealView>

        <RevealView delay={140} replayKey={graphReplayKey}>
          <WeightTrendChart animationKey={graphReplayKey} entries={weightEntries} profile={bodyProfile} />
        </RevealView>

        <RevealView delay={190} replayKey={graphReplayKey}>
          <ProfileSharingPanel
            importCode={importCode}
            importSpin={importSpin}
            isImporting={isImporting}
            isSharing={isSharing}
            onImport={() => {
              void handleImportShareCode();
            }}
            onImportCodeChange={(value) => setImportCode(sanitizeShareCode(value))}
            onPublish={() => {
              void handlePublishShareCode();
            }}
            shareCode={shareCode}
            shareSpin={shareSpin}
          />
        </RevealView>
    </AppScreen>
  );
}

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
  container: {
    gap: 18,
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
    minHeight: 86,
  },
  actionPanel: {
    gap: 10,
  },
});
