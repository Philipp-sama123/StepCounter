import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useAuth } from '../../../auth/AuthContext';
import { AnimatedPressable } from '../../../components/AnimatedPressable';
import { AppScreen } from '../../../components/layout/AppScreen';
import { PageHeader } from '../../../components/layout/PageHeader';
import { MetricCard } from '../../../components/ui/MetricCard';
import { readChallengeSessionsFromFirestore } from '../../../firebase/stepsSync';
import { formatClockDuration as formatDuration } from '../../../shared/format/metrics';
import { readRecentChallengeSessions } from '../../../storage/stepStorage';
import { getSessionPace as getPace } from '../domain/challengeMetrics';

import { styles } from './ChallengeHistoryScreen.styles';

import type { StoredChallengeSession } from '../domain/models';

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
    <AppScreen contentStyle={styles.container}>
      <PageHeader subtitle={sourceLabel} title="Challenge Sessions" />

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
      </View>
    </AppScreen>
  );
}

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
