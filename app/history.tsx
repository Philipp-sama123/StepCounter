import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthContext';
import { AnimatedPressable } from '../src/components/AnimatedPressable';
import { StepTrendChart } from '../src/components/StepTrendChart';
import { COLORS, DEFAULT_GOAL } from '../src/constants';
import {
  readChallengeSessionSumsFromFirestore,
  readChallengeSessionsFromFirestore,
  readDailyStepsFromFirestore,
  StoredChallengeSession,
  syncLocalStepDataToFirestore,
} from '../src/firebase/stepsSync';
import { readStepsForDateFromSystemHealth } from '../src/health/stepsProvider';
import {
  mergeChallengeSessionsForDate,
  readGoal,
  readLastSevenDays,
  readChallengeSessions,
  readRecentChallengeSessions,
  saveStepsForDate,
  StepHistoryEntry,
} from '../src/storage/stepStorage';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [history, setHistory] = useState<StepHistoryEntry[]>([]);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [sessionSums, setSessionSums] = useState<Record<string, number>>({});
  const [rawStepSums, setRawStepSums] = useState<Record<string, number>>({});
  const [dailyStorageBreakdown, setDailyStorageBreakdown] = useState<Record<string, DailyStorageBreakdown>>({});
  const [paceByDate, setPaceByDate] = useState<Record<string, number>>({});
  const [dataSourceLabel, setDataSourceLabel] = useState('Local cache');
  const [graphMode, setGraphMode] = useState<'pace' | 'steps'>('steps');
  const [historyView, setHistoryView] = useState<'sessions' | 'totals'>('totals');
  const [sessions, setSessions] = useState<StoredChallengeSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<StoredChallengeSession | null>(null);
  const [selectedStorageDetail, setSelectedStorageDetail] = useState<StorageDetail | null>(null);
  const [sessionStorageCopies, setSessionStorageCopies] = useState<Record<string, SessionStorageCopies>>({});
  const [graphReplayKey, setGraphReplayKey] = useState(0);
  const sessionGraphAnimation = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadHistory = async (): Promise<void> => {
        const [entries, storedGoal] = await Promise.all([readLastSevenDays(), readGoal()]);

        if (!isActive) return;

        // Load challenge session sums for each date in parallel
        const sessionPromises = entries.map((e) => readChallengeSessions(e.date));
        const sessionResults = await Promise.all(sessionPromises);
        const localSessionSums: Record<string, number> = {};
        const localPaces: Record<string, number> = {};
        const localSessionsByDate: Record<string, Awaited<ReturnType<typeof readChallengeSessions>>> = {};
        sessionResults.forEach((arr, idx) => {
          const total = arr.reduce((t, s) => t + s.steps, 0);
          const duration = arr.reduce((t, s) => t + s.durationMs, 0);
          localSessionSums[entries[idx].date] = total;
          localPaces[entries[idx].date] = duration > 0 ? Math.round(total / (duration / 60000)) : 0;
          localSessionsByDate[entries[idx].date] = arr;
        });

        const dates = entries.map((entry) => entry.date);
        const [remoteDailySteps, remoteSessionSums, systemDailySteps] = await Promise.all([
          user === null ? Promise.resolve({} as Awaited<ReturnType<typeof readDailyStepsFromFirestore>>) : readDailyStepsFromFirestore(user.uid, dates),
          user === null ? Promise.resolve({} as Record<string, number>) : readChallengeSessionSumsFromFirestore(user.uid, dates),
          readSystemStepsByDate(dates),
        ]);

        const hasRemoteDailyData = Object.keys(remoteDailySteps).length > 0;
        const hasRemoteSessionData = Object.keys(remoteSessionSums).length > 0;
        const hasSystemDailyData = Object.keys(systemDailySteps).length > 0;
        const sums = mergeMaximumByDate(localSessionSums, remoteSessionSums);
        const paces = entries.reduce<Record<string, number>>((result, entry) => {
          result[entry.date] = Math.max(localPaces[entry.date] ?? 0, remoteDailySteps[entry.date]?.paceStepsPerMinute ?? 0);
          return result;
        }, {});

        const rawSums = entries.reduce<Record<string, number>>((result, entry) => {
          result[entry.date] = Math.max(entry.steps, remoteDailySteps[entry.date]?.steps ?? 0, systemDailySteps[entry.date] ?? 0);
          return result;
        }, {});
        const correctedEntries = entries.map((entry) => ({
          ...entry,
          steps: Math.max(entry.steps, remoteDailySteps[entry.date]?.steps ?? 0, systemDailySteps[entry.date] ?? 0, sums[entry.date] ?? 0),
        }));
        const breakdowns = entries.reduce<Record<string, DailyStorageBreakdown>>((result, entry) => {
          result[entry.date] = {
            firestoreGoal: remoteDailySteps[entry.date]?.goal ?? null,
            firestorePaceStepsPerMinute: remoteDailySteps[entry.date]?.paceStepsPerMinute ?? null,
            firestoreSessionSteps: remoteSessionSums[entry.date] ?? 0,
            firestoreSteps: remoteDailySteps[entry.date]?.steps ?? 0,
            localSessionSteps: localSessionSums[entry.date] ?? 0,
            localSteps: entry.steps,
            systemHealthSteps: systemDailySteps[entry.date] ?? 0,
          };
          return result;
        }, {});

        await Promise.all(correctedEntries.map((entry) => saveStepsForDate(entry.date, entry.steps)));

        if (user !== null) {
          void syncLocalStepDataToFirestore({
            entries: correctedEntries,
            goal: storedGoal,
            localSessionsByDate,
            userId: user.uid,
          });
        }

        if (isActive) {
          setHistory(correctedEntries);
          setGoal(getMostRecentRemoteGoal(remoteDailySteps) ?? storedGoal);
          setSessionSums(sums);
          setRawStepSums(rawSums);
          setDailyStorageBreakdown(breakdowns);
          setPaceByDate(paces);
          setDataSourceLabel(getDataSourceLabel({ hasRemoteDailyData, hasRemoteSessionData, hasSystemDailyData }));
        }
      };

      const loadSessions = async (): Promise<void> => {
        const localSessions = await readRecentChallengeSessions();
        const remoteSessions = user === null ? [] : await readChallengeSessionsFromFirestore(user.uid);
        await hydrateLocalSessions(remoteSessions);
        const mergedSessions = mergeSessions(remoteSessions, localSessions);
        const copyMap = getSessionStorageCopies(remoteSessions, localSessions);

        if (isActive) {
          setSessions(mergedSessions);
          setSelectedSession(mergedSessions[0] ?? null);
          setSessionStorageCopies(copyMap);
        }
      };

      setGraphReplayKey((currentKey) => currentKey + 1);
      void loadHistory();
      void loadSessions();

      return () => {
        isActive = false;
      };
    }, [user]),
  );

  useEffect(() => {
    if (historyView !== 'sessions') {
      return;
    }

    sessionGraphAnimation.setValue(0);
    Animated.timing(sessionGraphAnimation, {
      duration: 620,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [graphReplayKey, historyView, sessionGraphAnimation, sessions.length]);

  const weeklyTotal = history.reduce((total, entry) => total + entry.steps, 0);
  const average = history.length > 0 ? Math.round(weeklyTotal / history.length) : 0;
  const bestDay = history.reduce<StepHistoryEntry | null>(
    (bestEntry, entry) => (bestEntry === null || entry.steps > bestEntry.steps ? entry : bestEntry),
    null,
  );
  const goalDays = history.filter((entry) => entry.steps >= goal).length;
  const activeDays = history.filter((entry) => entry.steps > 0).length;
  const consistency = history.length > 0 ? Math.round((activeDays / history.length) * 100) : 0;
  const challengeTotal = history.reduce((total, entry) => total + (sessionSums[entry.date] ?? 0), 0);
  const totalSessionSteps = sessions.reduce((total, session) => total + session.steps, 0);
  const totalSessionDuration = sessions.reduce((total, session) => total + session.durationMs, 0);
  const bestSession = sessions.reduce<StoredChallengeSession | null>(
    (best, session) => (best === null || session.steps > best.steps ? session : best),
    null,
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Statistics</Text>
          <Text style={styles.subtitle}>{`Last 7 days · ${dataSourceLabel}`}</Text>
        </View>

        <View style={styles.segmentedControl}>
          <AnimatedPressable
            accessibilityRole="button"
            onPress={() => setHistoryView('totals')}
            style={[styles.segmentButton, historyView === 'totals' ? styles.segmentButtonActiveOrange : null]}
          >
            <Text style={[styles.segmentText, historyView === 'totals' ? styles.segmentTextActive : null]}>Totals</Text>
          </AnimatedPressable>
          <AnimatedPressable
            accessibilityRole="button"
            onPress={() => setHistoryView('sessions')}
            style={[styles.segmentButton, historyView === 'sessions' ? styles.segmentButtonActiveOrange : null]}
          >
            <Text style={[styles.segmentText, historyView === 'sessions' ? styles.segmentTextActive : null]}>Sessions</Text>
          </AnimatedPressable>
        </View>

        {historyView === 'totals' ? (
          <>
        <View style={styles.metricTabs}>
          <AnimatedPressable
            accessibilityRole="button"
            onPress={() => setGraphMode('steps')}
            style={[styles.metricTab, graphMode === 'steps' ? styles.metricTabActive : null]}
          >
            <Text style={[styles.metricTabText, graphMode === 'steps' ? styles.metricTabTextActive : null]}>Steps</Text>
          </AnimatedPressable>
          <AnimatedPressable
            accessibilityRole="button"
            onPress={() => setGraphMode('pace')}
            style={[styles.metricTab, graphMode === 'pace' ? styles.metricTabActive : null]}
          >
            <Text style={[styles.metricTabText, graphMode === 'pace' ? styles.metricTabTextActive : null]}>Pace</Text>
          </AnimatedPressable>
        </View>

        <View style={styles.chartSurface}>
          <StepTrendChart
            animationKey={graphReplayKey}
            goal={goal}
            history={history}
            metric={graphMode}
            paceByDate={paceByDate}
            sessionSums={sessionSums}
          />
        </View>

        <View style={styles.metricGrid}>
          <MetricCard label="Weekly total" value={weeklyTotal.toLocaleString()} />
          <MetricCard label="Daily average" value={average.toLocaleString()} />
          <MetricCard label="Goal days" value={`${goalDays}/${history.length}`} />
          <MetricCard label="Challenge logged" value={challengeTotal.toLocaleString()} />
        </View>

        <View style={styles.insight}>
          <Text style={styles.insightLabel}>Best day</Text>
          <Text style={styles.insightValue}>
            {bestDay === null || bestDay.steps === 0 ? 'No steps yet' : `${bestDay.dayName} · ${bestDay.steps.toLocaleString()} steps`}
          </Text>
          <Text style={styles.insightNote}>Daily totals use stored steps, with challenge sessions as a minimum if local daily history is lower.</Text>
        </View>

        <View style={styles.list}>
          {history.map((entry) => {
            const progress = Math.min(1, entry.steps / goal);
            const reachedGoal = entry.steps >= goal;
            const rawSteps = rawStepSums[entry.date] ?? entry.steps;
            const sessionSteps = sessionSums[entry.date] ?? 0;
            const wasCorrected = sessionSteps > rawSteps;

            return (
              <AnimatedPressable
                accessibilityRole="button"
                key={entry.date}
                onPress={() => setSelectedStorageDetail({
                  dataSourceLabel,
                  entry,
                  goal,
                  kind: 'day',
                  paceStepsPerMinute: paceByDate[entry.date] ?? 0,
                  rawSteps,
                  storageBreakdown: dailyStorageBreakdown[entry.date] ?? getEmptyDailyStorageBreakdown(entry.steps),
                  sessionSteps,
                })}
                style={styles.dayRow}
              >
                <View style={styles.dayCopy}>
                  <Text style={styles.dayName}>{entry.dayName}</Text>
                  <Text style={styles.dayDate}>{entry.date}</Text>
                </View>
                <View style={styles.dayProgress}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, reachedGoal ? styles.successFill : null, { width: `${progress * 100}%` }]} />
                  </View>
                  <Text style={styles.daySteps}>{`${entry.steps.toLocaleString()} total`}</Text>
                  {sessionSteps > 0 ? (
                    <Text style={styles.sessionNote}>
                      {wasCorrected
                        ? `${sessionSteps.toLocaleString()} from sessions used as known minimum`
                        : `${sessionSteps.toLocaleString()} challenge-session steps logged`}
                    </Text>
                  ) : null}
                </View>
              </AnimatedPressable>
            );
          })}
        </View>
          </>
        ) : (
          <>
            <View style={styles.metricGrid}>
              <MetricCard label="Sessions" value={sessions.length.toLocaleString()} />
              <MetricCard label="Session steps" value={totalSessionSteps.toLocaleString()} />
              <MetricCard label="Time" value={formatDuration(totalSessionDuration)} />
              <MetricCard label="Best" value={bestSession === null ? '0' : bestSession.steps.toLocaleString()} />
            </View>

            <Animated.View
              style={[
                styles.timelinePanel,
                {
                  opacity: sessionGraphAnimation,
                  transform: [{
                    translateY: sessionGraphAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  }],
                },
              ]}
            >
              <View style={styles.timelineHeader}>
                <Text style={styles.timelineTitle}>Challenge timeline</Text>
                <Text style={styles.timelineHint}>tap a bar</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.timeline}>
                  {sessions.map((session, index) => {
                    const isSelected = selectedSession?.startedAt === session.startedAt;
                    const appearProgress = sessionGraphAnimation.interpolate({
                      inputRange: [Math.min(0.85, index * 0.08), Math.min(1, index * 0.08 + 0.22)],
                      outputRange: [0, 1],
                      extrapolate: 'clamp',
                    });

                    return (
                      <AnimatedPressable
                        accessibilityRole="button"
                        key={`${session.date}-${session.startedAt}-bar`}
                        onPress={() => setSelectedSession(session)}
                        style={styles.timelineColumn}
                      >
                        <View style={styles.timelineBarTrack}>
                          <Animated.View
                            style={[
                              styles.timelineBar,
                              isSelected ? styles.timelineBarSelected : null,
                              {
                                height: `${getRelativeWidth(session.steps, bestSession?.steps ?? 1)}%`,
                                opacity: appearProgress,
                                transform: [{
                                  translateY: appearProgress.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [12, 0],
                                  }),
                                }],
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.timelineLabel}>{formatSessionDay(session.startedAt)}</Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </ScrollView>
              {selectedSession !== null ? (
                <View style={styles.tooltip}>
                  <Text style={styles.tooltipTitle}>{`${selectedSession.steps.toLocaleString()} steps · ${getPace(selectedSession).toLocaleString()}/min`}</Text>
                  <Text style={styles.tooltipText}>{`${formatSessionDay(selectedSession.startedAt)} ${formatSessionTime(selectedSession.startedAt)} - ${formatSessionTime(selectedSession.endedAt)}`}</Text>
                  <Text style={styles.tooltipText}>{`${formatDuration(selectedSession.durationMs)} · ${selectedSession.source ?? 'live-sensor'}`}</Text>
                </View>
              ) : null}
            </Animated.View>

            <View style={styles.list}>
              {sessions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No challenge sessions yet</Text>
                  <Text style={styles.emptyText}>Start and pause a challenge to save your first session.</Text>
                </View>
              ) : (
                sessions.map((session) => (
                  <AnimatedPressable
                    accessibilityRole="button"
                    key={`${session.date}-${session.startedAt}`}
                    onPress={() => {
                      setSelectedSession(session);
                      setSelectedStorageDetail({
                        kind: 'session',
                        session,
                        storageCopies: sessionStorageCopies[getSessionStorageKey(session)] ?? { firestore: false, local: true },
                      });
                    }}
                    style={styles.sessionRow}
                  >
                    <View style={styles.sessionDate}>
                      <Text style={styles.sessionDay}>{formatSessionDay(session.startedAt)}</Text>
                      <Text style={styles.sessionTime}>{formatSessionTime(session.startedAt)}</Text>
                    </View>
                    <View style={styles.sessionBody}>
                      <View style={styles.sessionTopLine}>
                        <Text style={styles.sessionSteps}>{`${session.steps.toLocaleString()} steps`}</Text>
                        <Text style={styles.sessionPace}>{`${getPace(session).toLocaleString()}/min`}</Text>
                      </View>
                      <View style={styles.sessionBarTrack}>
                        <View style={[styles.sessionBarFill, { width: `${getRelativeWidth(session.steps, bestSession?.steps ?? 1)}%` }]} />
                      </View>
                      <Text style={styles.sessionMeta}>{`${formatDuration(session.durationMs)} · ${session.source ?? 'live-sensor'}`}</Text>
                    </View>
                  </AnimatedPressable>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
      <StorageDetailModal
        detail={selectedStorageDetail}
        onClose={() => setSelectedStorageDetail(null)}
      />
    </SafeAreaView>
  );
}

type StorageDetail =
  | {
      dataSourceLabel: string;
      entry: StepHistoryEntry;
      goal: number;
      kind: 'day';
      paceStepsPerMinute: number;
      rawSteps: number;
      storageBreakdown: DailyStorageBreakdown;
      sessionSteps: number;
    }
  | {
      kind: 'session';
      session: StoredChallengeSession;
      storageCopies: SessionStorageCopies;
    };

type DailyStorageBreakdown = {
  firestoreGoal: number | null;
  firestorePaceStepsPerMinute: number | null;
  firestoreSessionSteps: number;
  firestoreSteps: number;
  localSessionSteps: number;
  localSteps: number;
  systemHealthSteps: number;
};

type SessionStorageCopies = {
  firestore: boolean;
  local: boolean;
};

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

type StorageDetailModalProps = {
  detail: StorageDetail | null;
  onClose: () => void;
};

const StorageDetailModal = ({ detail, onClose }: StorageDetailModalProps) => (
  <Modal animationType="fade" transparent visible={detail !== null} onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalBackdrop} />
      <View style={styles.modalCard}>
        {detail?.kind === 'day' ? (
          <>
            <Text style={styles.modalEyebrow}>Daily storage</Text>
            <Text style={styles.modalTitle}>{`${detail.entry.dayName} · ${detail.entry.date}`}</Text>
            <Text style={styles.modalIntro}>This is the merged value the app keeps for the day, using local cache, Firestore, system health, and sessions as available.</Text>
            <StorageDetailRow label="Stored total" value={`${detail.entry.steps.toLocaleString()} steps`} />
            <StorageDetailRow label="Local daily cache" value={`${detail.storageBreakdown.localSteps.toLocaleString()} steps`} />
            <StorageDetailRow label="Firestore daily" value={`${detail.storageBreakdown.firestoreSteps.toLocaleString()} steps`} />
            <StorageDetailRow label="System health" value={`${detail.storageBreakdown.systemHealthSteps.toLocaleString()} steps`} />
            <StorageDetailRow label="Local sessions" value={`${detail.storageBreakdown.localSessionSteps.toLocaleString()} steps`} />
            <StorageDetailRow label="Firestore sessions" value={`${detail.storageBreakdown.firestoreSessionSteps.toLocaleString()} steps`} />
            <StorageDetailRow label="Raw daily best" value={`${detail.rawSteps.toLocaleString()} steps`} />
            <StorageDetailRow label="Session best" value={`${detail.sessionSteps.toLocaleString()} steps`} />
            <StorageDetailRow label="Pace" value={`${detail.paceStepsPerMinute.toLocaleString()}/min`} />
            <StorageDetailRow
              label="Firestore pace"
              value={detail.storageBreakdown.firestorePaceStepsPerMinute === null ? 'Not stored' : `${detail.storageBreakdown.firestorePaceStepsPerMinute.toLocaleString()}/min`}
            />
            <StorageDetailRow label="Goal" value={`${detail.goal.toLocaleString()} steps`} />
            <StorageDetailRow
              label="Firestore goal"
              value={detail.storageBreakdown.firestoreGoal === null ? 'Not stored' : `${detail.storageBreakdown.firestoreGoal.toLocaleString()} steps`}
            />
            <StorageDetailRow label="Progress" value={`${Math.round((detail.entry.steps / Math.max(1, detail.goal)) * 100)}%`} />
            <StorageDetailRow label="Loaded from" value={detail.dataSourceLabel} />
          </>
        ) : null}

        {detail?.kind === 'session' ? (
          <>
            <Text style={styles.modalEyebrow}>Session storage</Text>
            <Text style={styles.modalTitle}>{`${formatSessionDay(detail.session.startedAt)} · ${formatSessionTime(detail.session.startedAt)}`}</Text>
            <Text style={styles.modalIntro}>This is one saved challenge session. It is used for the session history and as a minimum for the daily total.</Text>
            <StorageDetailRow label="Steps" value={`${detail.session.steps.toLocaleString()} steps`} />
            <StorageDetailRow label="Pace" value={`${getPace(detail.session).toLocaleString()}/min`} />
            <StorageDetailRow label="Duration" value={formatDuration(detail.session.durationMs)} />
            <StorageDetailRow label="Started" value={formatFullDateTime(detail.session.startedAt)} />
            <StorageDetailRow label="Ended" value={formatFullDateTime(detail.session.endedAt)} />
            <StorageDetailRow label="Goal" value={detail.session.challengeGoal === undefined ? 'Not stored' : `${detail.session.challengeGoal.toLocaleString()} steps`} />
            <StorageDetailRow label="Source" value={detail.session.source ?? 'live-sensor'} />
            <StorageDetailRow label="Local cache" value={detail.storageCopies.local ? 'Stored' : 'Not found'} />
            <StorageDetailRow label="Firestore" value={detail.storageCopies.firestore ? 'Stored' : 'Not found'} />
          </>
        ) : null}

        <AnimatedPressable accessibilityRole="button" onPress={onClose} style={styles.modalButton}>
          <Text style={styles.modalButtonText}>Close</Text>
        </AnimatedPressable>
      </View>
    </View>
  </Modal>
);

type StorageDetailRowProps = {
  label: string;
  value: string;
};

const StorageDetailRow = ({ label, value }: StorageDetailRowProps) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const mergeMaximumByDate = (localValues: Record<string, number>, remoteValues: Record<string, number>): Record<string, number> => {
  const dates = new Set([...Object.keys(localValues), ...Object.keys(remoteValues)]);
  return Array.from(dates).reduce<Record<string, number>>((result, date) => {
    result[date] = Math.max(localValues[date] ?? 0, remoteValues[date] ?? 0);
    return result;
  }, {});
};

const getMostRecentRemoteGoal = (remoteDailySteps: Awaited<ReturnType<typeof readDailyStepsFromFirestore>>): number | null => {
  const dates = Object.keys(remoteDailySteps).sort();
  const latestDateWithGoal = [...dates].reverse().find((date) => typeof remoteDailySteps[date].goal === 'number');
  return latestDateWithGoal === undefined ? null : (remoteDailySteps[latestDateWithGoal].goal ?? null);
};

const readSystemStepsByDate = async (dates: string[]): Promise<Record<string, number>> => {
  const results = await Promise.all(dates.map(async (date) => ({
    date,
    result: await readStepsForDateFromSystemHealth(date),
  })));

  return results.reduce<Record<string, number>>((stepsByDate, { date, result }) => {
    if (result.available && result.steps > 0) {
      stepsByDate[date] = result.steps;
    }

    return stepsByDate;
  }, {});
};

const getDataSourceLabel = ({
  hasRemoteDailyData,
  hasRemoteSessionData,
  hasSystemDailyData,
}: {
  hasRemoteDailyData: boolean;
  hasRemoteSessionData: boolean;
  hasSystemDailyData: boolean;
}): string => {
  if (hasSystemDailyData && (hasRemoteDailyData || hasRemoteSessionData)) {
    return 'System health + Firestore + local cache';
  }

  if (hasSystemDailyData) {
    return 'System health + local cache';
  }

  if (hasRemoteDailyData || hasRemoteSessionData) {
    return 'Firestore + local cache';
  }

  return 'Local cache';
};

const mergeSessions = (
  remoteSessions: StoredChallengeSession[],
  localSessions: Array<StoredChallengeSession>,
): StoredChallengeSession[] => {
  const sessionMap = new Map<string, StoredChallengeSession>();

  [...localSessions, ...remoteSessions].forEach((session) => {
    sessionMap.set(`${session.date}-${session.startedAt}`, session);
  });

  return Array.from(sessionMap.values()).sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
};

const getSessionStorageKey = (session: Pick<StoredChallengeSession, 'date' | 'startedAt'>): string =>
  `${session.date}-${session.startedAt}`;

const getSessionStorageCopies = (
  remoteSessions: StoredChallengeSession[],
  localSessions: Array<StoredChallengeSession>,
): Record<string, SessionStorageCopies> => {
  const copies: Record<string, SessionStorageCopies> = {};

  localSessions.forEach((session) => {
    const key = getSessionStorageKey(session);
    copies[key] = { firestore: copies[key]?.firestore ?? false, local: true };
  });

  remoteSessions.forEach((session) => {
    const key = getSessionStorageKey(session);
    copies[key] = { firestore: true, local: copies[key]?.local ?? false };
  });

  return copies;
};

const getEmptyDailyStorageBreakdown = (localSteps: number): DailyStorageBreakdown => ({
  firestoreGoal: null,
  firestorePaceStepsPerMinute: null,
  firestoreSessionSteps: 0,
  firestoreSteps: 0,
  localSessionSteps: 0,
  localSteps,
  systemHealthSteps: 0,
});

const hydrateLocalSessions = async (remoteSessions: StoredChallengeSession[]): Promise<void> => {
  const sessionsByDate = remoteSessions.reduce<Record<string, StoredChallengeSession[]>>((result, session) => {
    result[session.date] = [...(result[session.date] ?? []), session];
    return result;
  }, {});

  await Promise.all(Object.entries(sessionsByDate).map(([date, sessions]) =>
    mergeChallengeSessionsForDate(date, sessions.map(({ date: _date, ...session }) => session)),
  ));
};

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const getPace = (session: StoredChallengeSession): number => {
  const minutes = Math.max(1, session.durationMs / 60000);
  return Math.round(session.steps / minutes);
};

const getRelativeWidth = (steps: number, maxSteps: number): number => Math.max(4, Math.min(100, (steps / Math.max(1, maxSteps)) * 100));

const formatSessionDay = (timestamp: string): string => new Date(timestamp).toLocaleDateString(undefined, {
  month: 'short',
  day: 'numeric',
});

const formatSessionTime = (timestamp: string): string => new Date(timestamp).toLocaleTimeString(undefined, {
  hour: '2-digit',
  minute: '2-digit',
});

const formatFullDateTime = (timestamp: string): string => new Date(timestamp).toLocaleString(undefined, {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
});

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
    gap: 4,
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: 14,
    fontWeight: '800',
  },
  chartSurface: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segmentedControl: {
    backgroundColor: COLORS.challengeSoft,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    padding: 5,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  segmentButtonActiveOrange: {
    backgroundColor: COLORS.challenge,
  },
  segmentText: {
    color: COLORS.challenge,
    fontSize: 14,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: COLORS.surface,
  },
  metricTabs: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.surface,
    borderBottomColor: COLORS.challenge,
    borderBottomWidth: 2,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  metricTab: {
    alignItems: 'center',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    flex: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  metricTabActive: {
    backgroundColor: COLORS.challenge,
  },
  metricTabText: {
    color: COLORS.challenge,
    fontSize: 14,
    fontWeight: '900',
  },
  metricTabTextActive: {
    color: COLORS.surface,
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
    fontSize: 22,
    fontWeight: '900',
  },
  insight: {
    borderRadius: 8,
    padding: 18,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 6,
  },
  insightLabel: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  insightValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
  },
  insightNote: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  list: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  dayRow: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dayCopy: {
    width: 74,
    gap: 3,
  },
  dayName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  dayDate: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '700',
  },
  dayProgress: {
    flex: 1,
    gap: 7,
  },
  progressTrack: {
    height: 9,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: COLORS.barSoft,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: COLORS.bar,
  },
  successFill: {
    backgroundColor: COLORS.success,
  },
  daySteps: {
    color: COLORS.text,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '900',
  },
  sessionNote: {
    color: COLORS.mutedText,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 18, 14, 0.58)',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    maxWidth: 420,
    padding: 18,
    width: '100%',
  },
  modalEyebrow: {
    color: COLORS.challenge,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
  },
  modalIntro: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 2,
  },
  detailRow: {
    alignItems: 'flex-start',
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    paddingTop: 9,
  },
  detailLabel: {
    color: COLORS.mutedText,
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  detailValue: {
    color: COLORS.text,
    flex: 1.35,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  modalButton: {
    alignItems: 'center',
    backgroundColor: COLORS.challenge,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  modalButtonText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '900',
  },
  timelinePanel: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  timelineHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  timelineHint: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  timeline: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    minHeight: 132,
  },
  timelineColumn: {
    alignItems: 'center',
    gap: 7,
    width: 46,
  },
  timelineBarTrack: {
    backgroundColor: COLORS.challengeSoft,
    borderRadius: 8,
    height: 104,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%',
  },
  timelineBar: {
    backgroundColor: COLORS.challenge,
    borderRadius: 8,
    minHeight: 4,
    width: '100%',
  },
  timelineBarSelected: {
    backgroundColor: COLORS.action,
  },
  timelineLabel: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '800',
  },
  tooltip: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  tooltipTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  tooltipText: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  sessionRow: {
    minHeight: 88,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sessionDate: {
    width: 68,
    gap: 4,
  },
  sessionDay: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sessionTime: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '800',
  },
  sessionBody: {
    flex: 1,
    gap: 8,
  },
  sessionTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sessionSteps: {
    color: COLORS.challenge,
    fontSize: 17,
    fontWeight: '900',
  },
  sessionPace: {
    color: COLORS.action,
    fontSize: 13,
    fontWeight: '900',
  },
  sessionBarTrack: {
    height: 9,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: COLORS.challengeSoft,
  },
  sessionBarFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: COLORS.challenge,
  },
  sessionMeta: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    padding: 20,
    gap: 6,
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
});
