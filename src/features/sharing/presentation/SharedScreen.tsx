import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useAuth } from '../../../auth/AuthContext';
import { AnimatedPressable } from '../../../components/AnimatedPressable';
import { AppScreen } from '../../../components/layout/AppScreen';
import { PageHeader } from '../../../components/layout/PageHeader';
import { RevealView } from '../../../components/RevealView';
import { SegmentedTabs } from '../../../components/SegmentedTabs';
import { MetricCard } from '../../../components/ui/MetricCard';
import { COLORS } from '../../../constants';
import { publishSharedProfile, readSharedProfile } from '../../../firebase/shareSync';
import { readChallengeSessionsFromFirestore, readDailyStepsFromFirestore } from '../../../firebase/stepsSync';
import { readTodayStepsFromSystemHealth } from '../../../health/stepsProvider';
import { syncSnapshotAndBackfill } from '../../../services/syncService';
import { formatClockDuration as formatDuration, formatTime } from '../../../shared/format/metrics';
import {
  readImportedShareCode,
  readImportedShareProfiles,
  saveImportedShareCode,
  saveSelectedImportedShareCode,
} from '../../../storage/shareStorage';
import {
  getTodayString,
  readGoal,
  readLastSevenDays,
  readRecentChallengeSessions,
  readStepsForDate,
} from '../../../storage/stepStorage';
import { getSessionPace as getPace } from '../../challenges/domain/challengeMetrics';

import {
  BOTTOM_PADDING,
  CHART_HEIGHT,
  HORIZONTAL_PADDING,
  MIN_CHART_WIDTH,
  POINT_WIDTH,
  TOP_PADDING,
} from './SharedScreen.layout';
import { styles } from './SharedScreen.styles';

import type { SharedProfileData } from '../../../firebase/shareSync';
import type { ImportedShareProfile } from '../../../storage/shareStorage';
import type { StoredChallengeSession } from '../../challenges/domain/models';
import type { StepHistoryEntry } from '../../steps/domain/models';

type GraphMode = 'steps' | 'challenges';
const COMPARISON_DAYS = 14;

export default function SharedHistoryScreen() {
  const { user } = useAuth();
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [importedProfiles, setImportedProfiles] = useState<ImportedShareProfile[]>([]);
  const [sharedProfile, setSharedProfile] = useState<SharedProfileData | null>(null);
  const [currentEntries, setCurrentEntries] = useState<StepHistoryEntry[]>([]);
  const [currentSessions, setCurrentSessions] = useState<StoredChallengeSession[]>([]);
  const [graphMode, setGraphMode] = useState<GraphMode>('steps');
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const refreshSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isLoading) {
      refreshSpin.stopAnimation();
      refreshSpin.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.timing(refreshSpin, {
        duration: 850,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [isLoading, refreshSpin]);

  const loadSharedProfile = useCallback(
    async (codeOverride?: string): Promise<void> => {
      setIsLoading(true);
      try {
        const [storedProfiles, storedCode, localEntries, localSessions] = await Promise.all([
          readImportedShareProfiles(),
          readImportedShareCode(),
          readLastSevenDays(),
          readRecentChallengeSessions(),
        ]);
        const selectedCode = codeOverride ?? storedCode ?? storedProfiles[0]?.code ?? null;
        const dates = getRecentDateEntries(COMPARISON_DAYS).map((entry) => entry.date);
        let [remoteEntriesByDate, remoteSessions] =
          user === null
            ? [{}, []]
            : await Promise.all([
                readDailyStepsFromFirestore(user.uid, dates),
                readChallengeSessionsFromFirestore(user.uid),
              ]);

        const selectedProfile = selectedCode === null ? null : await readSharedProfile(selectedCode);
        const refreshedSelectedProfile =
          selectedProfile === null
            ? null
            : await refreshOwnSharedProfileSnapshot({
                displayName: user?.displayName ?? user?.email?.split('@')[0] ?? selectedProfile.displayName,
                profile: selectedProfile,
                userId: user?.uid ?? null,
              });

        if (user !== null && refreshedSelectedProfile?.ownerId === user.uid) {
          [remoteEntriesByDate, remoteSessions] = await Promise.all([
            readDailyStepsFromFirestore(user.uid, dates),
            readChallengeSessionsFromFirestore(user.uid),
          ]);
        }
        const nextProfiles =
          selectedProfile === null
            ? storedProfiles
            : mergeImportedProfile(storedProfiles, {
                code: refreshedSelectedProfile?.code ?? selectedProfile.code,
                displayName: refreshedSelectedProfile?.displayName ?? selectedProfile.displayName,
                importedAt: new Date().toISOString(),
              });

        if (refreshedSelectedProfile !== null) {
          await saveImportedShareCode(refreshedSelectedProfile.code, refreshedSelectedProfile.displayName);
        }

        setCurrentEntries(
          mergeCurrentDailyEntries(getRecentDateEntries(COMPARISON_DAYS), localEntries, remoteEntriesByDate),
        );
        setCurrentSessions(mergeCurrentSessions(localSessions, remoteSessions));
        setImportedProfiles(nextProfiles);
        setShareCode(selectedCode);
        setSharedProfile(refreshedSelectedProfile);
      } catch (error) {
        console.warn('Unable to load shared profile comparison.', error);
        setSharedProfile(null);
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  const handleSelectProfile = async (code: string): Promise<void> => {
    setIsSelectorOpen(false);
    setShareCode(await saveSelectedImportedShareCode(code));
    await loadSharedProfile(code);
  };

  useFocusEffect(
    useCallback(() => {
      void loadSharedProfile();
    }, [loadSharedProfile]),
  );

  const importedEntries = sharedProfile?.dailySteps.slice(-14) ?? [];
  const importedSessions = sharedProfile?.sessions ?? [];
  const currentChallengeEntries = getChallengeEntries(currentEntries, currentSessions);
  const importedChallengeEntries = getChallengeEntries(importedEntries, importedSessions);
  const graphEntries = getComparisonEntries({
    currentChallengeEntries,
    currentDailyEntries: currentEntries,
    importedChallengeEntries,
    importedDailyEntries: importedEntries,
    mode: graphMode,
  });
  const currentTotal = graphEntries.reduce((total, entry) => total + entry.currentValue, 0);
  const importedTotal = graphEntries.reduce((total, entry) => total + entry.importedValue, 0);
  const totalDifference = currentTotal - importedTotal;
  const bestDay = importedEntries.reduce<(typeof importedEntries)[number] | null>(
    (best, entry) => (best === null || entry.steps > best.steps ? entry : best),
    null,
  );
  const bestSession = importedSessions.reduce<(typeof importedSessions)[number] | null>(
    (best, session) => (best === null || session.steps > best.steps ? session : best),
    null,
  );
  return (
    <AppScreen contentStyle={styles.container}>
      <PageHeader
        accessory={
          <AnimatedPressable
            accessibilityLabel="Refresh shared history"
            accessibilityRole="button"
            disabled={isLoading}
            onPress={() => {
              void loadSharedProfile();
            }}
            style={styles.iconButton}
          >
            <Animated.View
              style={{
                transform: [
                  { rotate: refreshSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
                ],
              }}
            >
              <Ionicons color={COLORS.onDanger} name={isLoading ? 'sync-outline' : 'refresh-outline'} size={20} />
            </Animated.View>
          </AnimatedPressable>
        }
        subtitle="Shared challenge"
        title={sharedProfile?.displayName ?? 'Imported user'}
      />

      {shareCode === null ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No imported profile yet</Text>
          <Text style={styles.emptyText}>
            Open Profile, enter a share code, then come back here to compare their history.
          </Text>
        </View>
      ) : null}

      {isLoading && sharedProfile === null ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={COLORS.challenge} />
          <Text style={styles.emptyTitle}>Loading shared history</Text>
          <Text style={styles.emptyText}>Fetching the selected imported profile and your comparison data.</Text>
        </View>
      ) : null}

      {shareCode !== null && sharedProfile === null && !isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Share code not found</Text>
          <Text
            style={styles.emptyText}
          >{`Code ${shareCode} did not return shared data. Ask them to refresh their shared data in Profile.`}</Text>
        </View>
      ) : null}

      {sharedProfile !== null ? (
        <>
          <RevealView style={styles.codePanel}>
            <View style={styles.selectorHeader}>
              <View>
                <Text style={styles.codeLabel}>Selected imported profile</Text>
                <Text style={styles.codeValue}>{sharedProfile.displayName}</Text>
                <Text style={styles.codeMeta}>{sharedProfile.code}</Text>
              </View>
              <AnimatedPressable
                accessibilityLabel="Select imported profile"
                accessibilityRole="button"
                onPress={() => setIsSelectorOpen((isOpen) => !isOpen)}
                style={styles.dropdownButton}
              >
                <Text style={styles.dropdownButtonText}>Select</Text>
                <Ionicons color={COLORS.challenge} name={isSelectorOpen ? 'chevron-up' : 'chevron-down'} size={18} />
              </AnimatedPressable>
            </View>
            {isSelectorOpen ? (
              <View style={styles.dropdownList}>
                {importedProfiles.map((profile) => (
                  <AnimatedPressable
                    accessibilityLabel={`Select ${profile.displayName}`}
                    accessibilityRole="button"
                    key={profile.code}
                    onPress={() => {
                      void handleSelectProfile(profile.code);
                    }}
                    style={[styles.dropdownItem, profile.code === shareCode && styles.dropdownItemActive]}
                  >
                    <View style={styles.dropdownItemTextWrap}>
                      <Text style={styles.dropdownItemName}>{profile.displayName}</Text>
                      <Text style={styles.dropdownItemCode}>{profile.code}</Text>
                    </View>
                    {profile.code === shareCode ? (
                      <Ionicons color={COLORS.challenge} name="checkmark-circle" size={19} />
                    ) : null}
                  </AnimatedPressable>
                ))}
              </View>
            ) : null}
          </RevealView>

          <RevealView delay={70} style={styles.metricGrid}>
            <ComparisonMetricCard
              label={graphMode === 'steps' ? 'Your steps' : 'Your challenge'}
              value={currentTotal.toLocaleString()}
            />
            <ComparisonMetricCard
              label={graphMode === 'steps' ? 'Their steps' : 'Their challenge'}
              value={importedTotal.toLocaleString()}
            />
            <ComparisonMetricCard
              label="Difference"
              value={formatSignedNumber(totalDifference)}
              valueColor={totalDifference >= 0 ? COLORS.action : COLORS.challenge}
            />
            <ComparisonMetricCard
              label={graphMode === 'steps' ? 'Their best day' : 'Their best session'}
              value={(graphMode === 'steps' ? bestDay?.steps : bestSession?.steps)?.toLocaleString() ?? '0'}
            />
          </RevealView>

          <RevealView delay={120} style={styles.chartPanel}>
            <View style={styles.chartHeader}>
              <Text style={styles.sectionTitle}>You vs imported user</Text>
              <Text style={styles.sectionMeta}>{graphMode === 'steps' ? 'daily steps' : 'challenges'}</Text>
            </View>
            <SegmentedTabs
              onChange={setGraphMode}
              options={[
                { icon: 'footsteps-outline', label: 'Steps', value: 'steps' },
                { icon: 'trophy-outline', label: 'Challenges', value: 'challenges' },
              ]}
              value={graphMode}
            />
            <View style={styles.legendRow}>
              <LegendItem color={COLORS.action} label="You" />
              <LegendItem color={COLORS.challenge} label={sharedProfile.displayName} />
            </View>
            <SharedTrendGraph
              animationKey={`${sharedProfile.code}-${graphMode}-${isLoading ? 'loading' : 'ready'}`}
              entries={graphEntries}
              emptyText="No shared step data yet."
            />
          </RevealView>

          <RevealView delay={170} style={styles.list}>
            {importedSessions.length === 0 ? (
              <View style={styles.emptyListItem}>
                <Text style={styles.emptyText}>No shared challenge sessions yet.</Text>
              </View>
            ) : (
              importedSessions.slice(0, 10).map((session) => (
                <View key={`${session.date}-${session.startedAt}`} style={styles.sessionRow}>
                  <View>
                    <Text style={styles.sessionDay}>{formatDay(session.date)}</Text>
                    <Text style={styles.sessionTime}>{formatTime(session.startedAt)}</Text>
                  </View>
                  <View style={styles.sessionBody}>
                    <Text style={styles.sessionSteps}>{`${session.steps.toLocaleString()} steps`}</Text>
                    <Text
                      style={styles.sessionMeta}
                    >{`${formatDuration(session.durationMs)} · ${getPace(session).toLocaleString()}/min`}</Text>
                  </View>
                </View>
              ))
            )}
          </RevealView>
        </>
      ) : null}
    </AppScreen>
  );
}

const ComparisonMetricCard = ({
  label,
  value,
  valueColor = COLORS.text,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) => <MetricCard label={label} value={value} valueStyle={{ color: valueColor }} />;

const refreshOwnSharedProfileSnapshot = async ({
  displayName,
  profile,
  userId,
}: {
  displayName: string;
  profile: SharedProfileData;
  userId: string | null;
}): Promise<SharedProfileData> => {
  if (userId === null || profile.ownerId !== userId) {
    return profile;
  }

  const today = getTodayString();
  const [goal, localSteps, systemSteps] = await Promise.all([
    readGoal(),
    readStepsForDate(today),
    readTodayStepsFromSystemHealth(),
  ]);
  const existingTodayEntry = profile.dailySteps.find((entry) => entry.date === today);
  const steps = systemSteps.available ? systemSteps.steps : Math.max(localSteps, existingTodayEntry?.steps ?? 0);
  const source = systemSteps.available ? systemSteps.source : (existingTodayEntry?.source ?? 'unavailable');

  if (steps > 0) {
    const syncResult = await syncSnapshotAndBackfill({
      goal,
      source,
      steps,
      userId,
    });

    if (!syncResult.ok) {
      console.warn('Unable to refresh own daily steps before shared profile publish.', syncResult.message);
    }
  }

  const publishResult = await publishSharedProfile({
    code: profile.code,
    displayName,
    userId,
  });

  if (!publishResult.ok) {
    console.warn('Unable to refresh own shared profile snapshot.', publishResult.message);
    return profile;
  }

  return (await readSharedProfile(profile.code)) ?? profile;
};

type SharedTrendEntry = {
  currentValue: number;
  date: string;
  importedValue: number;
};

type SharedTrendGraphProps = {
  animationKey: string;
  emptyText: string;
  entries: SharedTrendEntry[];
};

const SharedTrendGraph = ({ animationKey, emptyText, entries }: SharedTrendGraphProps) => {
  const revealAnimation = useRef(new Animated.Value(0)).current;
  const pointAnimation = useRef(new Animated.Value(0)).current;
  const visibleEntries = entries.filter((entry) => entry.currentValue > 0 || entry.importedValue > 0);
  const chartEntries = visibleEntries.length > 0 ? entries : [];
  const chartWidth = Math.max(MIN_CHART_WIDTH, chartEntries.length * POINT_WIDTH + HORIZONTAL_PADDING * 2);
  const plotWidth = chartWidth - HORIZONTAL_PADDING * 2;
  const plotHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;
  const values = chartEntries.flatMap((entry) => [entry.currentValue, entry.importedValue]);
  const maxValue = Math.max(...values, 1);
  const pointSpacing = chartEntries.length > 1 ? plotWidth / (chartEntries.length - 1) : 0;
  const baseline = CHART_HEIGHT - BOTTOM_PADDING;
  const currentPoints = chartEntries.map((entry, index) => ({
    x: HORIZONTAL_PADDING + pointSpacing * index,
    y: TOP_PADDING + plotHeight * (1 - entry.currentValue / maxValue),
  }));
  const importedPoints = chartEntries.map((entry, index) => ({
    x: HORIZONTAL_PADDING + pointSpacing * index,
    y: TOP_PADDING + plotHeight * (1 - entry.importedValue / maxValue),
  }));
  const currentLinePath = getLinePath(currentPoints);
  const importedLinePath = getLinePath(importedPoints);
  const currentAreaPath =
    currentPoints.length === 0
      ? ''
      : `${currentLinePath} L ${currentPoints[currentPoints.length - 1].x} ${baseline} L ${currentPoints[0].x} ${baseline} Z`;
  const importedAreaPath =
    importedPoints.length === 0
      ? ''
      : `${importedLinePath} L ${importedPoints[importedPoints.length - 1].x} ${baseline} L ${importedPoints[0].x} ${baseline} Z`;
  const revealStyle = {
    width: revealAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, chartWidth],
    }),
  };

  useEffect(() => {
    revealAnimation.setValue(0);
    pointAnimation.setValue(0);
    Animated.parallel([
      Animated.timing(revealAnimation, {
        duration: 740,
        toValue: 1,
        useNativeDriver: false,
      }),
      Animated.timing(pointAnimation, {
        duration: Math.max(580, chartEntries.length * 120),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animationKey, chartEntries.length, pointAnimation, revealAnimation]);

  if (chartEntries.length === 0) {
    return (
      <View style={styles.graphEmpty}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={[styles.trendCanvas, { width: chartWidth }]}>
        <View style={[styles.svgWindow, { width: chartWidth }]}>
          <Animated.View style={[styles.revealMask, revealStyle]}>
            <View style={{ width: chartWidth }}>
              <Svg height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`} width={chartWidth}>
                <Defs>
                  <LinearGradient id="sharedStepsArea" x1="0" x2="0" y1="0" y2="1">
                    <Stop offset="0" stopColor={COLORS.action} stopOpacity="0.22" />
                    <Stop offset="1" stopColor={COLORS.action} stopOpacity="0.02" />
                  </LinearGradient>
                  <LinearGradient id="sharedChallengeArea" x1="0" x2="0" y1="0" y2="1">
                    <Stop offset="0" stopColor={COLORS.challenge} stopOpacity="0.20" />
                    <Stop offset="1" stopColor={COLORS.challenge} stopOpacity="0.02" />
                  </LinearGradient>
                </Defs>
                <Path d={currentAreaPath} fill="url(#sharedStepsArea)" />
                <Path d={importedAreaPath} fill="url(#sharedChallengeArea)" />
                <Path
                  d={currentLinePath}
                  fill="none"
                  opacity={0.14}
                  stroke={COLORS.action}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={10}
                />
                <Path
                  d={importedLinePath}
                  fill="none"
                  opacity={0.14}
                  stroke={COLORS.challenge}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={10}
                />
                <Path
                  d={currentLinePath}
                  fill="none"
                  stroke={COLORS.action}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={4}
                />
                <Path
                  d={importedLinePath}
                  fill="none"
                  stroke={COLORS.challenge}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={4}
                />
              </Svg>
            </View>
          </Animated.View>
        </View>
        <View style={[styles.pointLayer, { width: chartWidth }]}>
          {currentPoints.map((point, index) => {
            const pointProgress = pointAnimation.interpolate({
              inputRange: [Math.min(0.9, index * 0.1), Math.min(1, index * 0.1 + 0.2)],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={`current-${chartEntries[index].date}-${chartEntries[index].currentValue}-${index}`}
                style={[
                  styles.pointDot,
                  {
                    borderColor: COLORS.action,
                    left: point.x - 5,
                    opacity: pointProgress,
                    top: point.y - 5,
                    transform: [
                      {
                        scale: pointProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.4, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
            );
          })}
          {importedPoints.map((point, index) => {
            const pointProgress = pointAnimation.interpolate({
              inputRange: [Math.min(0.9, index * 0.1), Math.min(1, index * 0.1 + 0.2)],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={`imported-${chartEntries[index].date}-${chartEntries[index].importedValue}-${index}`}
                style={[
                  styles.pointDot,
                  {
                    borderColor: COLORS.challenge,
                    left: point.x - 5,
                    opacity: pointProgress,
                    top: point.y - 5,
                    transform: [
                      {
                        scale: pointProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.4, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.axis}>
          {chartEntries.map((entry, index) => (
            <Animated.View
              key={`${entry.date}-${entry.currentValue}-${entry.importedValue}-${index}`}
              style={[
                styles.axisItem,
                {
                  opacity: pointAnimation.interpolate({
                    inputRange: [Math.min(0.9, index * 0.1), Math.min(1, index * 0.1 + 0.2)],
                    outputRange: [0, 1],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            >
              <Text style={styles.axisDay}>{formatDay(entry.date)}</Text>
              <Text style={styles.axisValue}>{Math.round(entry.currentValue).toLocaleString()}</Text>
              <Text style={styles.axisChallengeValue}>{Math.round(entry.importedValue).toLocaleString()}</Text>
            </Animated.View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const getChallengeEntries = (
  dailyEntries: { date: string }[],
  sessions: { date: string; steps: number }[],
): { date: string; value: number }[] => {
  const sessionStepsByDate = sessions.reduce<Record<string, number>>((result, session) => {
    result[session.date] = (result[session.date] ?? 0) + Math.max(0, Math.floor(session.steps));
    return result;
  }, {});
  const dates =
    dailyEntries.length > 0 ? dailyEntries.map((entry) => entry.date) : Object.keys(sessionStepsByDate).sort();

  return dates.map((date) => ({
    date,
    value: sessionStepsByDate[date] ?? 0,
  }));
};

const getComparisonEntries = ({
  currentChallengeEntries,
  currentDailyEntries,
  importedChallengeEntries,
  importedDailyEntries,
  mode,
}: {
  currentChallengeEntries: { date: string; value: number }[];
  currentDailyEntries: { date: string; steps: number }[];
  importedChallengeEntries: { date: string; value: number }[];
  importedDailyEntries: { date: string; steps: number }[];
  mode: GraphMode;
}): SharedTrendEntry[] => {
  const currentSource = mode === 'steps' ? currentDailyEntries : currentChallengeEntries;
  const importedSource = mode === 'steps' ? importedDailyEntries : importedChallengeEntries;
  const dates = new Set([...currentSource.map((entry) => entry.date), ...importedSource.map((entry) => entry.date)]);
  const currentValuesByDate = currentSource.reduce<Record<string, number>>((result, entry) => {
    result[entry.date] = Math.max(0, Math.floor(getEntryValue(entry)));
    return result;
  }, {});
  const importedValuesByDate = importedSource.reduce<Record<string, number>>((result, entry) => {
    result[entry.date] = Math.max(0, Math.floor(getEntryValue(entry)));
    return result;
  }, {});

  return Array.from(dates)
    .sort()
    .slice(-14)
    .map((date) => ({
      currentValue: currentValuesByDate[date] ?? 0,
      date,
      importedValue: importedValuesByDate[date] ?? 0,
    }));
};

const getEntryValue = (entry: { steps?: number; value?: number }): number => entry.steps ?? entry.value ?? 0;

const mergeCurrentDailyEntries = (
  dateEntries: StepHistoryEntry[],
  localEntries: StepHistoryEntry[],
  remoteEntriesByDate: Record<string, { steps: number }>,
): StepHistoryEntry[] =>
  dateEntries.map((entry) => ({
    ...entry,
    steps: Math.max(
      localEntries.find((localEntry) => localEntry.date === entry.date)?.steps ?? 0,
      remoteEntriesByDate[entry.date]?.steps ?? 0,
    ),
  }));

const mergeCurrentSessions = (
  localSessions: StoredChallengeSession[],
  remoteSessions: StoredChallengeSession[],
): StoredChallengeSession[] => {
  const sessionsByKey = new Map<string, StoredChallengeSession>();

  [...remoteSessions, ...localSessions].forEach((session) => {
    sessionsByKey.set(`${session.date}-${session.startedAt}-${session.endedAt}`, session);
  });

  return [...sessionsByKey.values()].sort(
    (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
  );
};

const mergeImportedProfile = (
  profiles: ImportedShareProfile[],
  nextProfile: ImportedShareProfile,
): ImportedShareProfile[] => {
  const profilesByCode = new Map<string, ImportedShareProfile>();

  [nextProfile, ...profiles].forEach((profile) => {
    if (!profilesByCode.has(profile.code)) {
      profilesByCode.set(profile.code, profile);
    }
  });

  return [...profilesByCode.values()].sort((left, right) => right.importedAt.localeCompare(left.importedAt));
};

const formatSignedNumber = (value: number): string => {
  const rounded = Math.round(value);
  if (rounded === 0) {
    return '0';
  }

  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString()}`;
};

const getRecentDateEntries = (days: number): StepHistoryEntry[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    return {
      date: dateString,
      dayName: date.toLocaleDateString(undefined, { weekday: 'short' }),
      steps: 0,
    };
  });
};

const getLinePath = (points: { x: number; y: number }[]): string =>
  points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const formatDay = (date: string): string =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
