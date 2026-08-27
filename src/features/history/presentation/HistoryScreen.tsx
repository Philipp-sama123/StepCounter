import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth } from '../../../auth/AuthContext';
import { AnimatedPressable } from '../../../components/AnimatedPressable';
import { AppScreen } from '../../../components/layout/AppScreen';
import { PageHeader } from '../../../components/layout/PageHeader';
import { RevealView } from '../../../components/RevealView';
import { SegmentedTabs } from '../../../components/SegmentedTabs';
import { StepTrendChart } from '../../../components/StepTrendChart';
import { AppButton } from '../../../components/ui/AppButton';
import { MetricCard } from '../../../components/ui/MetricCard';
import { DEFAULT_GOAL } from '../../../constants';
import {
  readChallengeSessionSumsFromFirestore,
  readChallengeSessionsFromFirestore,
  readDailyStepsFromFirestore,
  syncLocalStepDataToFirestore,
} from '../../../firebase/stepsSync';
import { readStepsForDatesFromSystemHealth } from '../../../health/stepsProvider';
import { syncTodayAndBackfill } from '../../../services/syncService';
import { formatClockDuration as formatDuration } from '../../../shared/format/metrics';
import {
  mergeChallengeSessionsForDate,
  readGoal,
  readLastSevenDays,
  readChallengeSessions,
  readRecentChallengeSessions,
  saveStepsForDate,
} from '../../../storage/stepStorage';
import { getSessionPace as getPace } from '../../challenges/domain/challengeMetrics';

import { styles } from './HistoryScreen.styles';

import type { StoredChallengeSession } from '../../challenges/domain/models';
import type { StepHistoryEntry } from '../../steps/domain/models';

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
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [graphReplayKey, setGraphReplayKey] = useState(0);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
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
          user === null
            ? Promise.resolve({} as Awaited<ReturnType<typeof readDailyStepsFromFirestore>>)
            : readDailyStepsFromFirestore(user.uid, dates),
          user === null
            ? Promise.resolve({} as Record<string, number>)
            : readChallengeSessionSumsFromFirestore(user.uid, dates),
          readSystemStepsByDate(dates),
        ]);

        const hasRemoteDailyData = Object.keys(remoteDailySteps).length > 0;
        const hasRemoteSessionData = Object.keys(remoteSessionSums).length > 0;
        const hasSystemDailyData = Object.keys(systemDailySteps).length > 0;
        const sums = mergeMaximumByDate(localSessionSums, remoteSessionSums);
        const paces = entries.reduce<Record<string, number>>((result, entry) => {
          result[entry.date] = Math.max(
            localPaces[entry.date] ?? 0,
            remoteDailySteps[entry.date]?.paceStepsPerMinute ?? 0,
          );
          return result;
        }, {});

        const rawSums = entries.reduce<Record<string, number>>((result, entry) => {
          result[entry.date] = Math.max(
            entry.steps,
            remoteDailySteps[entry.date]?.steps ?? 0,
            systemDailySteps[entry.date] ?? 0,
          );
          return result;
        }, {});
        const correctedEntries = entries.map((entry) => ({
          ...entry,
          steps: Math.max(
            entry.steps,
            remoteDailySteps[entry.date]?.steps ?? 0,
            systemDailySteps[entry.date] ?? 0,
            sums[entry.date] ?? 0,
          ),
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
    }, [historyReloadKey, user]),
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
  const challengeTotal = history.reduce((total, entry) => total + (sessionSums[entry.date] ?? 0), 0);
  const totalSessionSteps = sessions.reduce((total, session) => total + session.steps, 0);
  const totalSessionDuration = sessions.reduce((total, session) => total + session.durationMs, 0);
  const bestSession = sessions.reduce<StoredChallengeSession | null>(
    (best, session) => (best === null || session.steps > best.steps ? session : best),
    null,
  );

  const handleSyncHistory = async (): Promise<void> => {
    setIsSyncingHistory(true);
    try {
      const result = await syncTodayAndBackfill({
        userId: user?.uid ?? null,
      });
      setSyncMessage(result.message);
      setHistoryReloadKey((currentKey) => currentKey + 1);
      setGraphReplayKey((currentKey) => currentKey + 1);
    } finally {
      setIsSyncingHistory(false);
    }
  };

  return (
    <AppScreen
      contentStyle={styles.container}
      overlays={<StorageDetailModal detail={selectedStorageDetail} onClose={() => setSelectedStorageDetail(null)} />}
    >
      <PageHeader
        accessory={
          <AppButton
            accessibilityLabel="Sync missing Health Connect days"
            busy={isSyncingHistory}
            icon="sync-outline"
            label="Sync"
            onPress={() => {
              void handleSyncHistory();
            }}
            style={styles.syncButton}
            variant="warning"
          />
        }
        subtitle={`Last 7 days · ${dataSourceLabel}`}
        title="Statistics"
      />
      {syncMessage === null ? null : <Text style={styles.syncMessage}>{syncMessage}</Text>}

      <SegmentedTabs
        onChange={setHistoryView}
        options={[
          { icon: 'analytics-outline', label: 'Totals', value: 'totals' },
          { icon: 'walk-outline', label: 'Sessions', value: 'sessions' },
        ]}
        value={historyView}
      />

      {historyView === 'totals' ? (
        <>
          <SegmentedTabs
            onChange={setGraphMode}
            options={[
              { icon: 'footsteps-outline', label: 'Steps', value: 'steps' },
              { icon: 'speedometer-outline', label: 'Pace', value: 'pace' },
            ]}
            value={graphMode}
          />

          <RevealView replayKey={graphReplayKey} style={styles.chartSurface}>
            <StepTrendChart
              animationKey={graphReplayKey}
              goal={goal}
              history={history}
              metric={graphMode}
              paceByDate={paceByDate}
              sessionSums={sessionSums}
            />
          </RevealView>

          <RevealView delay={80} replayKey={graphReplayKey} style={styles.metricGrid}>
            <MetricCard label="Weekly total" value={weeklyTotal.toLocaleString()} />
            <MetricCard label="Daily average" value={average.toLocaleString()} />
            <MetricCard label="Goal days" value={`${goalDays}/${history.length}`} />
            <MetricCard label="Challenge logged" value={challengeTotal.toLocaleString()} />
          </RevealView>

          <RevealView delay={130} replayKey={graphReplayKey} style={styles.insight}>
            <Text style={styles.insightLabel}>Best day</Text>
            <Text style={styles.insightValue}>
              {bestDay === null || bestDay.steps === 0
                ? 'No steps yet'
                : `${bestDay.dayName} · ${bestDay.steps.toLocaleString()} steps`}
            </Text>
            <Text style={styles.insightNote}>
              Daily totals use stored steps, with challenge sessions as a minimum if local daily history is lower.
            </Text>
          </RevealView>

          <RevealView delay={180} replayKey={graphReplayKey} style={styles.list}>
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
                  onPress={() =>
                    setSelectedStorageDetail({
                      dataSourceLabel,
                      entry,
                      goal,
                      kind: 'day',
                      paceStepsPerMinute: paceByDate[entry.date] ?? 0,
                      rawSteps,
                      storageBreakdown: dailyStorageBreakdown[entry.date] ?? getEmptyDailyStorageBreakdown(entry.steps),
                      sessionSteps,
                    })
                  }
                  style={styles.dayRow}
                >
                  <View style={styles.dayCopy}>
                    <Text style={styles.dayName}>{entry.dayName}</Text>
                    <Text style={styles.dayDate}>{entry.date}</Text>
                  </View>
                  <View style={styles.dayProgress}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          reachedGoal ? styles.successFill : null,
                          { width: `${progress * 100}%` },
                        ]}
                      />
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
          </RevealView>
        </>
      ) : (
        <>
          <RevealView replayKey={graphReplayKey} style={styles.metricGrid}>
            <MetricCard label="Sessions" value={sessions.length.toLocaleString()} />
            <MetricCard label="Session steps" value={totalSessionSteps.toLocaleString()} />
            <MetricCard label="Time" value={formatDuration(totalSessionDuration)} />
            <MetricCard label="Best" value={bestSession === null ? '0' : bestSession.steps.toLocaleString()} />
          </RevealView>

          <Animated.View
            style={[
              styles.timelinePanel,
              {
                opacity: sessionGraphAnimation,
                transform: [
                  {
                    translateY: sessionGraphAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
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
                              transform: [
                                {
                                  translateY: appearProgress.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [12, 0],
                                  }),
                                },
                              ],
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
                <Text
                  style={styles.tooltipTitle}
                >{`${selectedSession.steps.toLocaleString()} steps · ${getPace(selectedSession).toLocaleString()}/min`}</Text>
                <Text
                  style={styles.tooltipText}
                >{`${formatSessionDay(selectedSession.startedAt)} ${formatSessionTime(selectedSession.startedAt)} - ${formatSessionTime(selectedSession.endedAt)}`}</Text>
                <Text
                  style={styles.tooltipText}
                >{`${formatDuration(selectedSession.durationMs)} · ${selectedSession.source ?? 'live-sensor'}`}</Text>
              </View>
            ) : null}
          </Animated.View>

          <RevealView delay={120} replayKey={graphReplayKey} style={styles.list}>
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
                      storageCopies: sessionStorageCopies[getSessionStorageKey(session)] ?? {
                        firestore: false,
                        local: true,
                      },
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
                      <View
                        style={[
                          styles.sessionBarFill,
                          { width: `${getRelativeWidth(session.steps, bestSession?.steps ?? 1)}%` },
                        ]}
                      />
                    </View>
                    <Text
                      style={styles.sessionMeta}
                    >{`${formatDuration(session.durationMs)} · ${session.source ?? 'live-sensor'}`}</Text>
                  </View>
                </AnimatedPressable>
              ))
            )}
          </RevealView>
        </>
      )}
    </AppScreen>
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
            <Text style={styles.modalIntro}>
              This is the merged value the app keeps for the day, using local cache, Firestore, system health, and
              sessions as available.
            </Text>
            <StorageDetailRow label="Stored total" value={`${detail.entry.steps.toLocaleString()} steps`} />
            <StorageDetailRow
              label="Local daily cache"
              value={`${detail.storageBreakdown.localSteps.toLocaleString()} steps`}
            />
            <StorageDetailRow
              label="Firestore daily"
              value={`${detail.storageBreakdown.firestoreSteps.toLocaleString()} steps`}
            />
            <StorageDetailRow
              label="System health"
              value={`${detail.storageBreakdown.systemHealthSteps.toLocaleString()} steps`}
            />
            <StorageDetailRow
              label="Local sessions"
              value={`${detail.storageBreakdown.localSessionSteps.toLocaleString()} steps`}
            />
            <StorageDetailRow
              label="Firestore sessions"
              value={`${detail.storageBreakdown.firestoreSessionSteps.toLocaleString()} steps`}
            />
            <StorageDetailRow label="Raw daily best" value={`${detail.rawSteps.toLocaleString()} steps`} />
            <StorageDetailRow label="Session best" value={`${detail.sessionSteps.toLocaleString()} steps`} />
            <StorageDetailRow label="Pace" value={`${detail.paceStepsPerMinute.toLocaleString()}/min`} />
            <StorageDetailRow
              label="Firestore pace"
              value={
                detail.storageBreakdown.firestorePaceStepsPerMinute === null
                  ? 'Not stored'
                  : `${detail.storageBreakdown.firestorePaceStepsPerMinute.toLocaleString()}/min`
              }
            />
            <StorageDetailRow label="Goal" value={`${detail.goal.toLocaleString()} steps`} />
            <StorageDetailRow
              label="Firestore goal"
              value={
                detail.storageBreakdown.firestoreGoal === null
                  ? 'Not stored'
                  : `${detail.storageBreakdown.firestoreGoal.toLocaleString()} steps`
              }
            />
            <StorageDetailRow
              label="Progress"
              value={`${Math.round((detail.entry.steps / Math.max(1, detail.goal)) * 100)}%`}
            />
            <StorageDetailRow label="Loaded from" value={detail.dataSourceLabel} />
          </>
        ) : null}

        {detail?.kind === 'session' ? (
          <>
            <Text style={styles.modalEyebrow}>Session storage</Text>
            <Text
              style={styles.modalTitle}
            >{`${formatSessionDay(detail.session.startedAt)} · ${formatSessionTime(detail.session.startedAt)}`}</Text>
            <Text style={styles.modalIntro}>
              This is one saved challenge session. It is used for the session history and as a minimum for the daily
              total.
            </Text>
            <StorageDetailRow label="Steps" value={`${detail.session.steps.toLocaleString()} steps`} />
            <StorageDetailRow label="Pace" value={`${getPace(detail.session).toLocaleString()}/min`} />
            <StorageDetailRow label="Duration" value={formatDuration(detail.session.durationMs)} />
            <StorageDetailRow label="Started" value={formatFullDateTime(detail.session.startedAt)} />
            <StorageDetailRow label="Ended" value={formatFullDateTime(detail.session.endedAt)} />
            <StorageDetailRow
              label="Goal"
              value={
                detail.session.challengeGoal === undefined
                  ? 'Not stored'
                  : `${detail.session.challengeGoal.toLocaleString()} steps`
              }
            />
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

const mergeMaximumByDate = (
  localValues: Record<string, number>,
  remoteValues: Record<string, number>,
): Record<string, number> => {
  const dates = new Set([...Object.keys(localValues), ...Object.keys(remoteValues)]);
  return Array.from(dates).reduce<Record<string, number>>((result, date) => {
    result[date] = Math.max(localValues[date] ?? 0, remoteValues[date] ?? 0);
    return result;
  }, {});
};

const getMostRecentRemoteGoal = (
  remoteDailySteps: Awaited<ReturnType<typeof readDailyStepsFromFirestore>>,
): number | null => {
  const dates = Object.keys(remoteDailySteps).sort();
  const latestDateWithGoal = [...dates].reverse().find((date) => typeof remoteDailySteps[date].goal === 'number');
  return latestDateWithGoal === undefined ? null : (remoteDailySteps[latestDateWithGoal].goal ?? null);
};

const readSystemStepsByDate = async (dates: string[]): Promise<Record<string, number>> => {
  const results = await readStepsForDatesFromSystemHealth(dates);

  return Object.entries(results).reduce<Record<string, number>>((stepsByDate, [date, result]) => {
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
  localSessions: StoredChallengeSession[],
): StoredChallengeSession[] => {
  const sessionMap = new Map<string, StoredChallengeSession>();

  [...localSessions, ...remoteSessions].forEach((session) => {
    sessionMap.set(`${session.date}-${session.startedAt}`, session);
  });

  return Array.from(sessionMap.values()).sort(
    (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
  );
};

const getSessionStorageKey = (session: Pick<StoredChallengeSession, 'date' | 'startedAt'>): string =>
  `${session.date}-${session.startedAt}`;

const getSessionStorageCopies = (
  remoteSessions: StoredChallengeSession[],
  localSessions: StoredChallengeSession[],
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

  await Promise.all(
    Object.entries(sessionsByDate).map(([date, sessions]) =>
      mergeChallengeSessionsForDate(
        date,
        sessions.map(({ date: _date, ...session }) => session),
      ),
    ),
  );
};

const getRelativeWidth = (steps: number, maxSteps: number): number =>
  Math.max(4, Math.min(100, (steps / Math.max(1, maxSteps)) * 100));

const formatSessionDay = (timestamp: string): string =>
  new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

const formatSessionTime = (timestamp: string): string =>
  new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

const formatFullDateTime = (timestamp: string): string =>
  new Date(timestamp).toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
