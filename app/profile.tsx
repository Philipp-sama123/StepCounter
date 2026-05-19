import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthContext';
import { AnimatedPressable } from '../src/components/AnimatedPressable';
import { GoalModal } from '../src/components/GoalModal';
import { ProfileModal } from '../src/components/ProfileModal';
import { RevealView } from '../src/components/RevealView';
import { ToastMessageItem, ToastStack } from '../src/components/ToastMessage';
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

        <RevealView replayKey={graphReplayKey} style={styles.metricGrid}>
          <MetricCard label="Daily goal" value={goal.toLocaleString()} />
          <MetricCard label="Height" value={bodyProfile?.heightCm ? `${bodyProfile.heightCm.toLocaleString()} cm` : '-'} />
          <MetricCard label="Weight" value={latestWeight > 0 ? `${latestWeight.toLocaleString()} kg` : '-'} />
          <MetricCard label="BMI" value={bmi > 0 ? bmi.toFixed(1) : '-'} />
        </RevealView>

        <RevealView delay={80} replayKey={graphReplayKey} style={styles.actionPanel}>
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
        </RevealView>

        <RevealView delay={140} replayKey={graphReplayKey}>
          <WeightTrendChart animationKey={graphReplayKey} entries={weightEntries} profile={bodyProfile} />
        </RevealView>

        <RevealView delay={190} replayKey={graphReplayKey} style={styles.sharePanel}>
          <View style={styles.shareHeader}>
            <View>
              <Text style={styles.shareTitle}>Challenge sharing</Text>
              <Text style={styles.shareText}>Share a read-only code or import another user for comparison.</Text>
            </View>
            <Ionicons color={COLORS.challenge} name="people-outline" size={22} />
          </View>

          {shareCode === null ? null : (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Your share code</Text>
              <Text style={styles.codeValue}>{shareCode}</Text>
            </View>
          )}

          <AnimatedPressable
            accessibilityLabel="Create or refresh share code"
            accessibilityRole="button"
            disabled={isSharing}
            onPress={() => {
              void handlePublishShareCode();
            }}
            style={styles.shareButton}
          >
            <Animated.View style={{ transform: [{ rotate: shareSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
              <Ionicons color={COLORS.surface} name={isSharing ? 'sync-outline' : 'share-social-outline'} size={18} />
            </Animated.View>
            <Text style={styles.shareButtonText}>{isSharing ? 'Publishing...' : shareCode === null ? 'Create share code' : 'Refresh shared data'}</Text>
          </AnimatedPressable>

          <View style={styles.importGroup}>
            <Text style={styles.importLabel}>Import someone else</Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={(value) => setImportCode(sanitizeShareCode(value))}
              placeholder="Import code"
              placeholderTextColor={COLORS.mutedText}
              style={styles.importInput}
              textAlign="center"
              value={importCode}
            />
            <AnimatedPressable
              accessibilityLabel="Import share code"
              accessibilityRole="button"
              disabled={isImporting}
              onPress={() => {
                void handleImportShareCode();
              }}
              style={styles.importButton}
            >
              <Animated.View style={{ transform: [{ rotate: importSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
                <Ionicons color={COLORS.surface} name={isImporting ? 'sync-outline' : 'download-outline'} size={18} />
              </Animated.View>
              <Text style={styles.importButtonText}>{isImporting ? 'Importing...' : 'Import'}</Text>
            </AnimatedPressable>
          </View>
        </RevealView>
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
  sharePanel: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  shareHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  shareTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '900',
  },
  shareText: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
  codeBox: {
    backgroundColor: COLORS.challengeSoft,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  codeLabel: {
    color: COLORS.challenge,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  codeValue: {
    color: COLORS.challenge,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
  },
  shareButton: {
    alignItems: 'center',
    backgroundColor: COLORS.challenge,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  shareButtonText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '900',
  },
  importGroup: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  importLabel: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '900',
  },
  importInput: {
    includeFontPadding: false,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
    height: 64,
    lineHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 16,
    textAlignVertical: 'center',
  },
  importButton: {
    alignItems: 'center',
    backgroundColor: COLORS.action,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  importButtonText: {
    color: COLORS.surface,
    fontSize: 15,
    fontWeight: '900',
  },
});
