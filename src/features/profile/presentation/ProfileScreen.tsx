import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Text } from 'react-native';

import { useAuth } from '../../../auth/AuthContext';
import { AnimatedPressable } from '../../../components/AnimatedPressable';
import { GoalModal } from '../../../components/GoalModal';
import { AppScreen } from '../../../components/layout/AppScreen';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProfileModal } from '../../../components/ProfileModal';
import { RevealView } from '../../../components/RevealView';
import { ToastStack } from '../../../components/ToastMessage';
import { AppButton } from '../../../components/ui/AppButton';
import { MetricCard } from '../../../components/ui/MetricCard';
import { SurfacePanel } from '../../../components/ui/SurfacePanel';
import { COLORS, DEFAULT_GOAL } from '../../../constants';
import { createShareCode, publishSharedProfile, readSharedProfile } from '../../../firebase/shareSync';
import { getBmi } from '../../../storage/profileStorage';
import { sanitizeShareCode, saveImportedShareCode, saveOwnShareCode } from '../../../storage/shareStorage';
import { appendToastMessage } from '../../../utils/toastQueue';
import { saveGoal } from '../../steps/infrastructure/localStepRepository';
import { loadProfileSnapshot, mergeWeightEntries, saveProfileSnapshot } from '../application/profileService';

import { ProfileSharingPanel } from './components/ProfileSharingPanel';
import { WeightTrendChart } from './components/WeightTrendChart';
import { styles } from './ProfileScreen.styles';

import type { ToastMessageItem } from '../../../components/ToastMessage';
import type { UserBodyProfile, WeightEntry } from '../domain/models';

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
        const snapshot = await loadProfileSnapshot(user?.uid ?? null);

        if (!isActive) {
          return;
        }

        setGoal(snapshot.goal);
        setBodyProfile(snapshot.bodyProfile);
        setWeightEntries(snapshot.weightEntries);
        setShareCode(snapshot.ownShareCode);
        setImportCode(snapshot.importedShareCode);
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
    setBodyProfile(profile);
    setIsProfileModalVisible(false);
    const result = await saveProfileSnapshot({ profile, userId: user?.uid ?? null });
    const nextWeightEntry = result.newWeightEntry;
    if (nextWeightEntry !== null) {
      setWeightEntries((currentEntries) => mergeWeightEntries(currentEntries, [nextWeightEntry]));
    }
    showToast(result.message, result.ok ? 'standard' : 'error');
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

      showToast(
        result.ok ? `${result.message} Shared history is refreshed.` : result.message,
        result.ok ? 'standard' : 'error',
      );
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
      overlays={
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
      }
    >
      <PageHeader
        accessory={
          <AnimatedPressable
            accessibilityLabel="Sign out"
            accessibilityRole="button"
            onPress={() => {
              void signOutUser();
            }}
            style={styles.logoutButton}
          >
            <Ionicons color={COLORS.onDanger} name="log-out-outline" size={18} />
            <Text style={styles.logoutText}>Logout</Text>
          </AnimatedPressable>
        }
        subtitle="Account"
        title={displayName}
      />

      <RevealView replayKey={graphReplayKey} style={styles.metricGrid}>
        <MetricCard label="Daily goal" style={styles.metricCard} value={goal.toLocaleString()} />
        <MetricCard
          label="Height"
          style={styles.metricCard}
          value={bodyProfile?.heightCm ? `${bodyProfile.heightCm.toLocaleString()} cm` : '-'}
        />
        <MetricCard
          label="Weight"
          style={styles.metricCard}
          value={latestWeight > 0 ? `${latestWeight.toLocaleString()} kg` : '-'}
        />
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
          <AppButton
            accessibilityLabel="Open sensor diagnostics"
            icon="hardware-chip-outline"
            label="Sensor diagnostics"
            onPress={() => router.push('/sensors')}
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
