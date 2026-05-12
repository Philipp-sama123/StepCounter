import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthContext';
import { AnimatedPressable } from '../src/components/AnimatedPressable';
import { COLORS } from '../src/constants';
import { readChallengeSessionsFromFirestore, StoredChallengeSession } from '../src/firebase/stepsSync';
import { readRecentChallengeSessions } from '../src/storage/stepStorage';

export default function ChallengeHistoryScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<StoredChallengeSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<StoredChallengeSession | null>(null);
  const [sourceLabel, setSourceLabel] = useState('Local cache');

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadSessions = async (): Promise<void> => {
        const localSessions = await readRecentChallengeSessions();
        const remoteSessions = user === null ? [] : await readChallengeSessionsFromFirestore(user.uid);
        const mergedSessions = mergeSessions(remoteSessions, localSessions);

        if (isActive) {
          setSessions(mergedSessions);
          setSelectedSession(mergedSessions[0] ?? null);
          setSourceLabel(remoteSessions.length > 0 ? 'Firestore + local cache' : 'Local cache');
        }
      };

      void loadSessions();

      return () => {
        isActive = false;
      };
    }, [user]),
  );

  const totalSteps = sessions.reduce((total, session) => total + session.steps, 0);
  const totalDuration = sessions.reduce((total, session) => total + session.durationMs, 0);
  const bestSession = sessions.reduce<StoredChallengeSession | null>(
    (best, session) => (best === null || session.steps > best.steps ? session : best),
    null,
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Challenge Sessions</Text>
          <Text style={styles.subtitle}>{sourceLabel}</Text>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard label="Sessions" value={sessions.length.toLocaleString()} />
          <MetricCard label="Session steps" value={totalSteps.toLocaleString()} />
          <MetricCard label="Time" value={formatDuration(totalDuration)} />
          <MetricCard label="Best" value={bestSession === null ? '0' : bestSession.steps.toLocaleString()} />
        </View>

        <View style={styles.timelinePanel}>
          <View style={styles.timelineHeader}>
            <Text style={styles.timelineTitle}>Challenge timeline</Text>
            <Text style={styles.timelineHint}>tap a bar</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.timeline}>
              {sessions.map((session) => {
                const isSelected = selectedSession?.startedAt === session.startedAt;
                return (
                  <AnimatedPressable
                    accessibilityRole="button"
                    key={`${session.date}-${session.startedAt}-bar`}
                    onPress={() => setSelectedSession(session)}
                    style={styles.timelineColumn}
                  >
                    <View style={styles.timelineBarTrack}>
                      <View
                        style={[
                          styles.timelineBar,
                          isSelected ? styles.timelineBarSelected : null,
                          { height: `${getRelativeWidth(session.steps, bestSession?.steps ?? 1)}%` },
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
        </View>

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
                onPress={() => setSelectedSession(session)}
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
      </ScrollView>
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
  list: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
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
