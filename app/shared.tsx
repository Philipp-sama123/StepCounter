import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { AnimatedPressable } from '../src/components/AnimatedPressable';
import { RevealView } from '../src/components/RevealView';
import { COLORS } from '../src/constants';
import { useAuth } from '../src/auth/AuthContext';
import { readSharedProfile, SharedProfileData } from '../src/firebase/shareSync';
import { readChallengeSessionsFromFirestore, readDailyStepsFromFirestore, StoredChallengeSession } from '../src/firebase/stepsSync';
import {
  ImportedShareProfile,
  readImportedShareCode,
  readImportedShareProfiles,
  saveSelectedImportedShareCode,
} from '../src/storage/shareStorage';
import { readLastSevenDays, readRecentChallengeSessions, StepHistoryEntry } from '../src/storage/stepStorage';

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

  const loadSharedProfile = useCallback(async (codeOverride?: string): Promise<void> => {
    setIsLoading(true);
    const [storedProfiles, storedCode, localEntries, localSessions] = await Promise.all([
      readImportedShareProfiles(),
      readImportedShareCode(),
      readLastSevenDays(),
      readRecentChallengeSessions(),
    ]);
    const selectedCode = codeOverride ?? storedCode ?? storedProfiles[0]?.code ?? null;
    const dates = getRecentDateEntries(COMPARISON_DAYS).map((entry) => entry.date);
    const [remoteEntriesByDate, remoteSessions] = user === null
      ? [{}, []]
      : await Promise.all([
        readDailyStepsFromFirestore(user.uid, dates),
        readChallengeSessionsFromFirestore(user.uid),
      ]);

    setCurrentEntries(mergeCurrentDailyEntries(getRecentDateEntries(COMPARISON_DAYS), localEntries, remoteEntriesByDate));
    setCurrentSessions(mergeCurrentSessions(localSessions, remoteSessions));
    setImportedProfiles(storedProfiles);
    setShareCode(selectedCode);
    setSharedProfile(selectedCode === null ? null : await readSharedProfile(selectedCode));
    setIsLoading(false);
  }, [user]);

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
  const bestDay = importedEntries.reduce<typeof importedEntries[number] | null>(
    (best, entry) => (best === null || entry.steps > best.steps ? entry : best),
    null,
  );
  const bestSession = importedSessions.reduce<typeof importedSessions[number] | null>(
    (best, session) => (best === null || session.steps > best.steps ? session : best),
    null,
  );
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>Shared challenge</Text>
            <Text style={styles.title}>{sharedProfile?.displayName ?? 'Imported user'}</Text>
          </View>
          <AnimatedPressable
            accessibilityLabel="Refresh shared history"
            accessibilityRole="button"
            disabled={isLoading}
            onPress={() => {
              void loadSharedProfile();
            }}
            style={styles.iconButton}
          >
            <Animated.View style={{ transform: [{ rotate: refreshSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
              <Ionicons color={COLORS.surface} name={isLoading ? 'sync-outline' : 'refresh-outline'} size={20} />
            </Animated.View>
          </AnimatedPressable>
        </View>

        {shareCode === null ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No imported profile yet</Text>
            <Text style={styles.emptyText}>Open Profile, enter a share code, then come back here to compare their history.</Text>
          </View>
        ) : null}

        {shareCode !== null && sharedProfile === null && !isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Share code not found</Text>
            <Text style={styles.emptyText}>{`Code ${shareCode} did not return shared data. Ask them to refresh their shared data in Profile.`}</Text>
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
                      {profile.code === shareCode ? <Ionicons color={COLORS.challenge} name="checkmark-circle" size={19} /> : null}
                    </AnimatedPressable>
                  ))}
                </View>
              ) : null}
            </RevealView>

            <RevealView delay={70} style={styles.metricGrid}>
              <MetricCard label={graphMode === 'steps' ? 'Your steps' : 'Your challenge'} value={currentTotal.toLocaleString()} />
              <MetricCard label={graphMode === 'steps' ? 'Their steps' : 'Their challenge'} value={importedTotal.toLocaleString()} />
              <MetricCard label="Difference" value={formatSignedNumber(totalDifference)} valueColor={totalDifference >= 0 ? COLORS.action : COLORS.challenge} />
              <MetricCard label={graphMode === 'steps' ? 'Their best day' : 'Their best session'} value={(graphMode === 'steps' ? bestDay?.steps : bestSession?.steps)?.toLocaleString() ?? '0'} />
            </RevealView>

            <RevealView delay={120} style={styles.chartPanel}>
              <View style={styles.chartHeader}>
                <Text style={styles.sectionTitle}>You vs imported user</Text>
                <Text style={styles.sectionMeta}>{graphMode === 'steps' ? 'daily steps' : 'challenges'}</Text>
              </View>
              <View style={styles.segmentedControl}>
                <AnimatedPressable
                  accessibilityLabel="Compare daily steps"
                  accessibilityRole="button"
                  onPress={() => setGraphMode('steps')}
                  style={[styles.segmentButton, graphMode === 'steps' && styles.segmentButtonActive]}
                >
                  <Text style={[styles.segmentText, graphMode === 'steps' && styles.segmentTextActive]}>Steps</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  accessibilityLabel="Compare challenges"
                  accessibilityRole="button"
                  onPress={() => setGraphMode('challenges')}
                  style={[styles.segmentButton, graphMode === 'challenges' && styles.segmentButtonActive]}
                >
                  <Text style={[styles.segmentText, graphMode === 'challenges' && styles.segmentTextActive]}>Challenges</Text>
                </AnimatedPressable>
              </View>
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
              ) : importedSessions.slice(0, 10).map((session) => (
                <View key={`${session.date}-${session.startedAt}`} style={styles.sessionRow}>
                  <View>
                    <Text style={styles.sessionDay}>{formatDay(session.date)}</Text>
                    <Text style={styles.sessionTime}>{formatTime(session.startedAt)}</Text>
                  </View>
                  <View style={styles.sessionBody}>
                    <Text style={styles.sessionSteps}>{`${session.steps.toLocaleString()} steps`}</Text>
                    <Text style={styles.sessionMeta}>{`${formatDuration(session.durationMs)} · ${getPace(session).toLocaleString()}/min`}</Text>
                  </View>
                </View>
              ))}
            </RevealView>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const MetricCard = ({ label, value, valueColor = COLORS.text }: { label: string; value: string; valueColor?: string }) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
  </View>
);

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

const CHART_HEIGHT = 132;
const MIN_CHART_WIDTH = 310;
const POINT_WIDTH = 72;
const HORIZONTAL_PADDING = 18;
const TOP_PADDING = 16;
const BOTTOM_PADDING = 28;

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
  const currentAreaPath = currentPoints.length === 0
    ? ''
    : `${currentLinePath} L ${currentPoints[currentPoints.length - 1].x} ${baseline} L ${currentPoints[0].x} ${baseline} Z`;
  const importedAreaPath = importedPoints.length === 0
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
                <Path d={currentLinePath} fill="none" opacity={0.14} stroke={COLORS.action} strokeLinecap="round" strokeLinejoin="round" strokeWidth={10} />
                <Path d={importedLinePath} fill="none" opacity={0.14} stroke={COLORS.challenge} strokeLinecap="round" strokeLinejoin="round" strokeWidth={10} />
                <Path d={currentLinePath} fill="none" stroke={COLORS.action} strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} />
                <Path d={importedLinePath} fill="none" stroke={COLORS.challenge} strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} />
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
                    transform: [{
                      scale: pointProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 1],
                      }),
                    }],
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
                    transform: [{
                      scale: pointProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 1],
                      }),
                    }],
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
  dailyEntries: Array<{ date: string }>,
  sessions: Array<{ date: string; steps: number }>,
): Array<{ date: string; value: number }> => {
  const sessionStepsByDate = sessions.reduce<Record<string, number>>((result, session) => {
    result[session.date] = (result[session.date] ?? 0) + Math.max(0, Math.floor(session.steps));
    return result;
  }, {});
  const dates = dailyEntries.length > 0
    ? dailyEntries.map((entry) => entry.date)
    : Object.keys(sessionStepsByDate).sort();

  return dates.map((date) => ({
    date,
    value: sessionStepsByDate[date] ?? 0,
  }));
};

const getComparisonEntries = (
  {
    currentChallengeEntries,
    currentDailyEntries,
    importedChallengeEntries,
    importedDailyEntries,
    mode,
  }: {
    currentChallengeEntries: Array<{ date: string; value: number }>;
    currentDailyEntries: Array<{ date: string; steps: number }>;
    importedChallengeEntries: Array<{ date: string; value: number }>;
    importedDailyEntries: Array<{ date: string; steps: number }>;
    mode: GraphMode;
  },
): SharedTrendEntry[] => {
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

  return Array.from(dates).sort().slice(-14).map((date) => ({
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
  localSessions: Array<StoredChallengeSession>,
  remoteSessions: StoredChallengeSession[],
): StoredChallengeSession[] => {
  const sessionsByKey = new Map<string, StoredChallengeSession>();

  [...remoteSessions, ...localSessions].forEach((session) => {
    sessionsByKey.set(`${session.date}-${session.startedAt}-${session.endedAt}`, session);
  });

  return [...sessionsByKey.values()].sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
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

const getLinePath = (points: Array<{ x: number; y: number }>): string =>
  points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const formatDay = (date: string): string => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
  day: 'numeric',
  month: 'short',
});

const formatTime = (timestamp: string): string => new Date(timestamp).toLocaleTimeString(undefined, {
  hour: '2-digit',
  minute: '2-digit',
});

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const getPace = (session: { durationMs: number; steps: number }): number => {
  const minutes = Math.max(1, session.durationMs / 60000);
  return Math.round(session.steps / minutes);
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    gap: 16,
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: 14,
    fontWeight: '800',
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '900',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: COLORS.challenge,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  codePanel: {
    backgroundColor: COLORS.challengeSoft,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  selectorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  codeLabel: {
    color: COLORS.challenge,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  codeValue: {
    color: COLORS.challenge,
    fontSize: 24,
    fontWeight: '900',
  },
  codeMeta: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },
  dropdownButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  dropdownButtonText: {
    color: COLORS.challenge,
    fontSize: 13,
    fontWeight: '900',
  },
  dropdownList: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownItem: {
    alignItems: 'center',
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownItemActive: {
    backgroundColor: COLORS.challengeSoft,
  },
  dropdownItemTextWrap: {
    flex: 1,
  },
  dropdownItemName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  dropdownItemCode: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'space-between',
    minHeight: 86,
    padding: 14,
    width: '48%',
  },
  metricLabel: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
  },
  chartPanel: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  chartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sectionMeta: {
    color: COLORS.challenge,
    fontSize: 12,
    fontWeight: '800',
  },
  legendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  legendDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  legendText: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  segmentedControl: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  segmentButtonActive: {
    backgroundColor: COLORS.challenge,
  },
  segmentText: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: COLORS.surface,
  },
  trendCanvas: {
    minHeight: 192,
  },
  svgWindow: {
    height: CHART_HEIGHT,
    overflow: 'hidden',
  },
  revealMask: {
    height: CHART_HEIGHT,
    overflow: 'hidden',
  },
  pointLayer: {
    height: CHART_HEIGHT,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  pointDot: {
    backgroundColor: COLORS.surface,
    borderRadius: 5,
    borderWidth: 3,
    height: 10,
    position: 'absolute',
    width: 10,
  },
  axis: {
    flexDirection: 'row',
    paddingHorizontal: HORIZONTAL_PADDING - 8,
  },
  axisItem: {
    alignItems: 'center',
    gap: 3,
    width: POINT_WIDTH,
  },
  axisDay: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '900',
  },
  axisValue: {
    color: COLORS.action,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  axisChallengeValue: {
    color: COLORS.challenge,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  graphEmpty: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  list: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sessionRow: {
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  sessionDay: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    width: 64,
  },
  sessionTime: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '800',
  },
  sessionBody: {
    flex: 1,
  },
  sessionSteps: {
    color: COLORS.challenge,
    fontSize: 16,
    fontWeight: '900',
  },
  sessionMeta: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyState: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 18,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  emptyListItem: {
    padding: 16,
  },
});
