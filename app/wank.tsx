import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/auth/AuthContext';
import { DashboardAvatar } from '../src/components/avatar/DashboardAvatar';
import { AppScreen } from '../src/components/layout/AppScreen';
import { PageHeader } from '../src/components/layout/PageHeader';
import { SegmentedTabs } from '../src/components/SegmentedTabs';
import { AppButton } from '../src/components/ui/AppButton';
import { SurfacePanel } from '../src/components/ui/SurfacePanel';
import { AvatarAnimationKey } from '../src/config/avatarSprites';
import { COLORS, THEME } from '../src/constants';
import {
  getTodayString,
  readAllWankSessions,
  readWankSessions,
  readWankSessionsForRecentDays,
  saveWankSession,
  WankReplayEvent,
  WankReplaySample,
  WankSession,
} from '../src/storage/stepStorage';
import { triggerSelectionHaptic } from '../src/utils/haptics';

type MotionSample = {
  direction: SwingDirection;
  motionG: number;
  passed: boolean;
  rotationRadPerSecond: number;
  timestamp: number;
};

type SwingDirection = 'down' | 'still' | 'up';

type SwingLogEntry = {
  combo: number;
  direction: SwingDirection;
  motionG: number;
  rotationRadPerSecond: number;
  timestamp: number;
};

type WankHistoryRange = 'all' | 'today' | 'week';

const SAMPLE_INTERVAL_MS = 90;
const GYROSCOPE_INTERVAL_MS = 90;
const MOTION_WALK_THRESHOLD_G = 0.16;
const MOTION_RUN_THRESHOLD_G = 0.34;
const ROTATION_WALK_THRESHOLD_RAD_PER_SECOND = 1.1;
const ROTATION_RUN_THRESHOLD_RAD_PER_SECOND = 2.4;
const MIN_SWING_INTERVAL_MS = 170;
const ACTIVE_HOLD_MS = 850;
const MAX_GRAPH_SAMPLES = 34;
const MAX_LOG_ENTRIES = 8;
const REPLAY_SAMPLE_INTERVAL_MS = 180;

export default function WankChallengeScreen() {
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const [avatarState, setAvatarState] = useState<AvatarAnimationKey>('idle');
  const [bestCombo, setBestCombo] = useState(0);
  const [currentCombo, setCurrentCombo] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [historyRange, setHistoryRange] = useState<WankHistoryRange>('today');
  const [historySessions, setHistorySessions] = useState<Array<WankSession & { date: string }>>([]);
  const [isReplaying, setIsReplaying] = useState(false);
  const [motionG, setMotionG] = useState(0);
  const [rotationRadPerSecond, setRotationRadPerSecond] = useState(0);
  const [samples, setSamples] = useState<MotionSample[]>([]);
  const [swingCount, setSwingCount] = useState(0);
  const [swingLog, setSwingLog] = useState<SwingLogEntry[]>([]);
  const scoreScale = useRef(new Animated.Value(1)).current;
  const baselineMagnitudeRef = useRef<number | null>(null);
  const currentComboRef = useRef(0);
  const gyroscopeMagnitudeRef = useRef(0);
  const isReplayingRef = useRef(false);
  const isRunningRef = useRef(false);
  const lastAcceptedAtRef = useRef(0);
  const lastDirectionRef = useRef<SwingDirection>('still');
  const motionSampleCountRef = useRef(0);
  const motionTotalRef = useRef(0);
  const previousYRef = useRef<number | null>(null);
  const replayEventsRef = useRef<WankReplayEvent[]>([]);
  const replaySamplesRef = useRef<WankReplaySample[]>([]);
  const replayTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rotationTotalRef = useRef(0);
  const sessionBestComboRef = useRef(0);
  const sessionLastReplaySampleAtRef = useRef(0);
  const sessionStartAtRef = useRef<number | null>(null);
  const sessionStartSwingCountRef = useRef(0);
  const swingCountRef = useRef(0);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    isReplayingRef.current = isReplaying;
  }, [isReplaying]);

  useEffect(() => () => {
    clearReplayTimeouts(replayTimeoutsRef.current);
  }, []);

  const loadHistory = useCallback(async (): Promise<void> => {
    setHistorySessions(await readWankSessionsForRange(historyRange));
  }, [historyRange]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const animateScore = useCallback((): void => {
    scoreScale.setValue(0.92);
    Animated.spring(scoreScale, {
      friction: 5,
      tension: 180,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [scoreScale]);

  useEffect(() => {
    if (!isFocused || !isRunning) {
      return undefined;
    }

    let accelerometerSubscription: ReturnType<typeof Accelerometer.addListener> | null = null;
    let gyroscopeSubscription: ReturnType<typeof Gyroscope.addListener> | null = null;

    Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
    Gyroscope.setUpdateInterval(GYROSCOPE_INTERVAL_MS);

    gyroscopeSubscription = Gyroscope.addListener((measurement) => {
      if (isReplayingRef.current) {
        return;
      }

      const rotationMagnitude = getVectorMagnitude(measurement.x, measurement.y, measurement.z);
      gyroscopeMagnitudeRef.current = rotationMagnitude;
      setRotationRadPerSecond(rotationMagnitude);
    });

    accelerometerSubscription = Accelerometer.addListener((measurement) => {
      if (isReplayingRef.current) {
        return;
      }

      const now = Date.now();
      const rawMagnitude = getVectorMagnitude(measurement.x, measurement.y, measurement.z);
      const baselineMagnitude = baselineMagnitudeRef.current ?? rawMagnitude;
      baselineMagnitudeRef.current = baselineMagnitude * 0.92 + rawMagnitude * 0.08;
      const nextMotionG = Math.abs(rawMagnitude - baselineMagnitudeRef.current);
      const nextRotationRadPerSecond = gyroscopeMagnitudeRef.current;
      const previousY = previousYRef.current;
      const direction = getSwingDirection(previousY === null ? 0 : measurement.y - previousY);
      const passed = nextMotionG >= MOTION_RUN_THRESHOLD_G && nextRotationRadPerSecond >= ROTATION_RUN_THRESHOLD_RAD_PER_SECOND;

      previousYRef.current = measurement.y;
      if (isRunningRef.current) {
        const sessionStartAt = sessionStartAtRef.current ?? now;
        const replaySample = {
          direction,
          motionG: nextMotionG,
          offsetMs: now - sessionStartAt,
          passed,
          rotationRadPerSecond: nextRotationRadPerSecond,
        };

        motionSampleCountRef.current += 1;
        motionTotalRef.current += nextMotionG;
        rotationTotalRef.current += nextRotationRadPerSecond;
        if (shouldStoreReplaySample(now, sessionLastReplaySampleAtRef.current, passed)) {
          sessionLastReplaySampleAtRef.current = now;
          replaySamplesRef.current = [...replaySamplesRef.current, replaySample];
        }
      }
      setMotionG(nextMotionG);
      setSamples((currentSamples) =>
        [
          ...currentSamples.slice(-(MAX_GRAPH_SAMPLES - 1)),
          {
            direction,
            motionG: nextMotionG,
            passed,
            rotationRadPerSecond: nextRotationRadPerSecond,
            timestamp: now,
          },
        ],
      );

      if (isRunningRef.current && canAcceptSwing(direction, passed, now, lastAcceptedAtRef.current, lastDirectionRef.current)) {
        lastAcceptedAtRef.current = now;
        lastDirectionRef.current = direction;
        currentComboRef.current += 1;
        const nextCombo = currentComboRef.current;
        const nextSwingCount = swingCountRef.current + 1;
        const sessionStartAt = sessionStartAtRef.current ?? now;

        swingCountRef.current = nextSwingCount;
        sessionBestComboRef.current = Math.max(sessionBestComboRef.current, nextCombo);
        replayEventsRef.current = [
          ...replayEventsRef.current,
          {
            combo: nextCombo,
            direction,
            motionG: nextMotionG,
            offsetMs: now - sessionStartAt,
            rotationRadPerSecond: nextRotationRadPerSecond,
            swingNumber: nextSwingCount - sessionStartSwingCountRef.current,
          },
        ];
        setSwingCount(nextSwingCount);
        setCurrentCombo(nextCombo);
        setBestCombo((currentBest) => Math.max(currentBest, nextCombo));
        setSwingLog((currentLog) =>
          [
            {
              combo: nextCombo,
              direction,
              motionG: nextMotionG,
              rotationRadPerSecond: nextRotationRadPerSecond,
              timestamp: now,
            },
            ...currentLog,
          ].slice(0, MAX_LOG_ENTRIES),
        );
        triggerSelectionHaptic();
        animateScore();
      }

      if (now - lastAcceptedAtRef.current > MIN_SWING_INTERVAL_MS * 5 && currentComboRef.current > 0) {
        currentComboRef.current = 0;
        setCurrentCombo(0);
      }

      setAvatarState(getAvatarState(nextMotionG, nextRotationRadPerSecond, now - lastAcceptedAtRef.current));
    });

    return () => {
      accelerometerSubscription?.remove();
      gyroscopeSubscription?.remove();
    };
  }, [animateScore, isFocused, isRunning]);

  const handleToggle = async (): Promise<void> => {
    if (isReplaying) {
      stopReplay();
    }

    if (isRunning) {
      await saveCurrentSession();
      isRunningRef.current = false;
      setIsRunning(false);
      resetSessionState({ clearScore: false });
      return;
    }

    resetSessionState({ clearScore: false });
    sessionStartAtRef.current = Date.now();
    sessionStartSwingCountRef.current = swingCountRef.current;
    isRunningRef.current = true;
    setIsRunning(true);
  };

  const saveCurrentSession = async (): Promise<void> => {
    const startedAt = sessionStartAtRef.current;
    const endAt = Date.now();
    const sessionSwings = Math.max(0, swingCountRef.current - sessionStartSwingCountRef.current);

    sessionStartAtRef.current = null;

    if (startedAt === null || sessionSwings === 0) {
      return;
    }

    const sampleCount = Math.max(1, motionSampleCountRef.current);
    await saveWankSession(getTodayString(), {
      averageMotionG: motionTotalRef.current / sampleCount,
      averageRotationRadPerSecond: rotationTotalRef.current / sampleCount,
      bestCombo: sessionBestComboRef.current,
      durationMs: endAt - startedAt,
      endedAt: new Date(endAt).toISOString(),
      replayEvents: replayEventsRef.current,
      replaySamples: replaySamplesRef.current,
      startedAt: new Date(startedAt).toISOString(),
      swings: sessionSwings,
    });
    await loadHistory();
  };

  const resetSessionState = ({ clearScore }: { clearScore: boolean }): void => {
    currentComboRef.current = 0;
    lastAcceptedAtRef.current = 0;
    lastDirectionRef.current = 'still';
    motionSampleCountRef.current = 0;
    motionTotalRef.current = 0;
    replayEventsRef.current = [];
    replaySamplesRef.current = [];
    rotationTotalRef.current = 0;
    sessionBestComboRef.current = 0;
    sessionLastReplaySampleAtRef.current = 0;
    sessionStartAtRef.current = null;
    sessionStartSwingCountRef.current = 0;
    setCurrentCombo(0);
    setSwingLog([]);

    if (clearScore) {
      swingCountRef.current = 0;
      setBestCombo(0);
      setSwingCount(0);
      setMotionG(0);
      setRotationRadPerSecond(0);
      setSamples([]);
    }
  };

  const handleReset = (): void => {
    stopReplay();
    isRunningRef.current = false;
    setIsRunning(false);
    resetSessionState({ clearScore: true });
  };

  const stopReplay = (): void => {
    clearReplayTimeouts(replayTimeoutsRef.current);
    replayTimeoutsRef.current = [];
    isReplayingRef.current = false;
    setIsReplaying(false);
    setAvatarState('idle');
  };

  const handleReplayLast = async (): Promise<void> => {
    if (isReplaying) {
      stopReplay();
      return;
    }

    if (isRunning) {
      await saveCurrentSession();
      isRunningRef.current = false;
      setIsRunning(false);
      resetSessionState({ clearScore: false });
    }

    const allSessions = await readAllWankSessions();
    const replaySession = allSessions.find((session) => (session.replaySamples?.length ?? 0) > 0 && (session.replayEvents?.length ?? 0) > 0);

    if (replaySession === undefined) {
      return;
    }

    clearReplayTimeouts(replayTimeoutsRef.current);
    replayTimeoutsRef.current = [];
    currentComboRef.current = 0;
    setAvatarState('idle');
    setBestCombo(replaySession.bestCombo);
    setCurrentCombo(0);
    setIsReplaying(true);
    setMotionG(0);
    setRotationRadPerSecond(0);
    setSamples([]);
    setSwingCount(0);
    setSwingLog([]);

    const sampleTimeouts = replaySession.replaySamples?.map((sample) => setTimeout(() => {
      const timestamp = Date.now();
      setMotionG(sample.motionG);
      setRotationRadPerSecond(sample.rotationRadPerSecond);
      setSamples((currentSamples) => [
        ...currentSamples.slice(-(MAX_GRAPH_SAMPLES - 1)),
        {
          direction: sample.direction,
          motionG: sample.motionG,
          passed: sample.passed,
          rotationRadPerSecond: sample.rotationRadPerSecond,
          timestamp,
        },
      ]);
      setAvatarState(getAvatarState(sample.motionG, sample.rotationRadPerSecond, sample.passed ? 0 : ACTIVE_HOLD_MS + 1));
    }, sample.offsetMs)) ?? [];

    const eventTimeouts = replaySession.replayEvents?.map((event) => setTimeout(() => {
      const timestamp = Date.now();
      setSwingCount(event.swingNumber);
      setCurrentCombo(event.combo);
      setSwingLog((currentLog) => [
        {
          combo: event.combo,
          direction: event.direction,
          motionG: event.motionG,
          rotationRadPerSecond: event.rotationRadPerSecond,
          timestamp,
        },
        ...currentLog,
      ].slice(0, MAX_LOG_ENTRIES));
      triggerSelectionHaptic();
      animateScore();
    }, event.offsetMs)) ?? [];

    const endTimeout = setTimeout(() => {
      setIsReplaying(false);
      setCurrentCombo(0);
      setAvatarState('idle');
      replayTimeoutsRef.current = [];
    }, Math.max(0, replaySession.durationMs) + 450);

    replayTimeoutsRef.current = [...sampleTimeouts, ...eventTimeouts, endTimeout];
  };

  return (
    <AppScreen>
      <PageHeader subtitle="Cheeky motion arcade" title="Wank challenge" />

      <SurfacePanel style={styles.heroPanel}>
        <DashboardAvatar caption={getAvatarCaption(avatarState, isRunning)} state={avatarState} userId={user?.uid ?? null} />
        <Animated.View style={[styles.scoreWrap, { transform: [{ scale: scoreScale }] }]}>
          <Text style={styles.score}>{swingCount}</Text>
          <Text style={styles.scoreLabel}>wanks</Text>
        </Animated.View>
        <View style={styles.metricGrid}>
          <Metric label="Combo" value={`${currentCombo}`} />
          <Metric label="Best combo" value={`${bestCombo}`} />
          <Metric label="Motion" value={`${formatDecimal(motionG)} g`} />
          <Metric label="Rotation" value={`${formatDecimal(rotationRadPerSecond)} rad/s`} />
        </View>
        <View style={styles.buttonRow}>
          <AppButton
            accessibilityLabel={isRunning ? 'Pause wank challenge' : 'Start wank challenge'}
            icon={isRunning ? 'pause-outline' : 'play-outline'}
            label={isRunning ? 'Pause' : 'Start'}
            onPress={() => {
              void handleToggle();
            }}
            style={styles.controlButton}
            variant={isRunning ? 'danger' : 'warning'}
          />
          <AppButton
            accessibilityLabel="Reset wank challenge"
            icon="refresh-outline"
            label="Reset"
            onPress={handleReset}
            style={styles.controlButton}
            variant="secondary"
          />
        </View>
        <AppButton
          accessibilityLabel={isReplaying ? 'Stop replay' : 'Replay last saved wank challenge'}
          disabled={isRunning && !isReplaying}
          icon={isReplaying ? 'stop-outline' : 'play-back-outline'}
          label={isReplaying ? 'Stop replay' : 'Replay last'}
          onPress={() => {
            void handleReplayLast();
          }}
          style={styles.replayButton}
          variant="secondary"
        />
      </SurfacePanel>

      <WankHistoryPanel
        onRangeChange={(nextRange) => {
          setHistoryRange(nextRange);
          void readWankSessionsForRange(nextRange).then(setHistorySessions);
        }}
        range={historyRange}
        sessions={historySessions}
      />

      <SurfacePanel>
        <View style={styles.sectionHeader}>
          <Ionicons color={COLORS.primary} name="speedometer-outline" size={20} />
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Motion thresholds</Text>
            <Text style={styles.sectionText}>
              Yellow reaches the walk threshold. Green reaches the run/count threshold. A score needs both graphs green plus alternating up/down direction.
            </Text>
          </View>
        </View>
        <ThresholdGraph
          label="Acceleration delta"
          limit={MOTION_RUN_THRESHOLD_G}
          slowLimit={MOTION_WALK_THRESHOLD_G}
          samples={samples}
          unit="g"
          valueKey="motionG"
        />
        <ThresholdGraph
          label="Rotation speed"
          limit={ROTATION_RUN_THRESHOLD_RAD_PER_SECOND}
          slowLimit={ROTATION_WALK_THRESHOLD_RAD_PER_SECOND}
          samples={samples}
          unit="rad/s"
          valueKey="rotationRadPerSecond"
        />
      </SurfacePanel>

      <SurfacePanel style={styles.logPanel}>
        <View style={styles.sectionHeader}>
          <Ionicons color={COLORS.primary} name="terminal-outline" size={20} />
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Last accepted swings</Text>
            <Text style={styles.sectionText}>The detector wants speed, rotation, and alternating vertical direction.</Text>
          </View>
        </View>
        <View style={styles.console}>
          {swingLog.length === 0 ? (
            <Text style={styles.consoleLine}>Start the mode and move fast up/down to fill this log.</Text>
          ) : (
            swingLog.map((entry) => (
              <Text key={`${entry.timestamp}-${entry.combo}`} style={styles.consoleLine}>
                {`${formatTime(entry.timestamp)} · ${entry.direction} · ${formatDecimal(entry.motionG)} g · ${formatDecimal(entry.rotationRadPerSecond)} rad/s · combo ${entry.combo}`}
              </Text>
            ))
          )}
        </View>
      </SurfacePanel>
    </AppScreen>
  );
}

const readWankSessionsForRange = async (range: WankHistoryRange): Promise<Array<WankSession & { date: string }>> => {
  if (range === 'today') {
    const date = getTodayString();
    const sessions = await readWankSessions(date);
    return sessions
      .map((session) => ({ ...session, date }))
      .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
  }

  if (range === 'week') {
    return readWankSessionsForRecentDays(7);
  }

  return readAllWankSessions();
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

type WankHistoryPanelProps = {
  onRangeChange: (range: WankHistoryRange) => void;
  range: WankHistoryRange;
  sessions: Array<WankSession & { date: string }>;
};

const WankHistoryPanel = ({ onRangeChange, range, sessions }: WankHistoryPanelProps) => {
  const totalSwings = sessions.reduce((total, session) => total + Math.max(0, session.swings), 0);
  const totalDuration = sessions.reduce((total, session) => total + Math.max(0, session.durationMs), 0);
  const bestSession = sessions.reduce<(WankSession & { date: string }) | null>(
    (best, session) => (best === null || session.swings > best.swings ? session : best),
    null,
  );
  const graphSessions = [...sessions].reverse().slice(-12);
  const maxSwings = Math.max(1, ...graphSessions.map((session) => session.swings));

  return (
    <SurfacePanel style={styles.historyPanel}>
      <View style={styles.sectionHeader}>
        <Ionicons color={COLORS.primary} name="trophy-outline" size={20} />
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>Wank history</Text>
          <Text style={styles.sectionText}>Saved when you pause a run with at least one accepted swing.</Text>
        </View>
      </View>
      <SegmentedTabs
        onChange={onRangeChange}
        options={[
          { icon: 'today-outline', label: 'Today', value: 'today' },
          { icon: 'stats-chart-outline', label: 'Week', value: 'week' },
          { icon: 'albums-outline', label: 'All', value: 'all' },
        ]}
        value={range}
      />
      <View style={styles.metricGrid}>
        <Metric label="Sessions" value={`${sessions.length}`} />
        <Metric label="Total" value={`${totalSwings}`} />
        <Metric label="Best" value={bestSession === null ? '0' : `${bestSession.swings}`} />
        <Metric label="Time" value={formatDuration(totalDuration)} />
      </View>
      <View style={styles.historyGraphPanel}>
        <View style={styles.graphHeader}>
          <Text style={styles.graphLabel}>Score trend</Text>
          <Text style={styles.graphLimit}>{graphSessions.length === 0 ? 'empty' : `${graphSessions.length} runs`}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.historyGraph}>
            {graphSessions.length === 0 ? (
              <View style={styles.emptyHistoryGraph}>
                <Text style={styles.emptyGraphText}>No saved runs yet.</Text>
              </View>
            ) : graphSessions.map((session) => (
              <View key={`${session.date}-${session.startedAt}`} style={styles.historyGraphColumn}>
                <View style={styles.historyGraphTrack}>
                  <View style={[styles.historyGraphFill, { height: `${getRelativeHeight(session.swings, maxSwings)}%` }]} />
                </View>
                <Text style={styles.historyGraphLabel}>{formatSessionLabel(session.startedAt, range)}</Text>
                <Text style={styles.historyGraphValue}>{session.swings}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      <View style={styles.historyList}>
        {sessions.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyHistoryTitle}>No saved chaos yet</Text>
            <Text style={styles.emptyHistoryText}>Start the mode, score at least once, then pause to save a session.</Text>
          </View>
        ) : sessions.slice(0, 8).map((session) => (
          <WankHistoryRow key={`${session.date}-${session.startedAt}`} session={session} />
        ))}
      </View>
    </SurfacePanel>
  );
};

const WankHistoryRow = ({ session }: { session: WankSession & { date: string } }) => (
  <View style={styles.historyRow}>
    <View style={styles.historyDateBlock}>
      <Text style={styles.historyDay}>{formatSessionDay(session.startedAt)}</Text>
      <Text style={styles.historyTime}>{formatSessionTime(session.startedAt)}</Text>
    </View>
    <View style={styles.historyBody}>
      <View style={styles.historyTopLine}>
        <Text style={styles.historyScore}>{`${session.swings} wanks`}</Text>
        <Text style={styles.historyCombo}>{`combo ${session.bestCombo}`}</Text>
      </View>
      <Text style={styles.historyMeta}>
        {`${formatDuration(session.durationMs)} · ${formatDecimal(session.averageMotionG)} g · ${formatDecimal(session.averageRotationRadPerSecond)} rad/s`}
      </Text>
    </View>
  </View>
);

type ThresholdGraphProps = {
  label: string;
  limit: number;
  samples: MotionSample[];
  slowLimit: number;
  unit: string;
  valueKey: 'motionG' | 'rotationRadPerSecond';
};

const ThresholdGraph = ({ label, limit, samples, slowLimit, unit, valueKey }: ThresholdGraphProps) => {
  const maxValue = Math.max(limit * 1.35, ...samples.map((sample) => sample[valueKey]), 0.1);

  return (
    <View style={styles.graphBlock}>
      <View style={styles.graphHeader}>
        <Text style={styles.graphLabel}>{label}</Text>
        <Text style={styles.graphLimit}>{`walk ${formatDecimal(slowLimit)} · run ${formatDecimal(limit)} ${unit}`}</Text>
      </View>
      <View style={styles.graph}>
        {samples.length === 0 ? (
          <Text style={styles.emptyGraphText}>Waiting for sensor samples...</Text>
        ) : (
          samples.map((sample) => {
            const value = sample[valueKey];
            const passesCountLimit = value >= limit;
            const passesSlowLimit = value >= slowLimit;
            const height = Math.max(8, Math.min(86, (value / maxValue) * 86));

            return (
              <View key={`${sample.timestamp}-${valueKey}`} style={styles.graphBarSlot}>
                <View
                  style={[
                    styles.graphBar,
                    passesCountLimit ? styles.graphBarPass : passesSlowLimit ? styles.graphBarSlow : styles.graphBarFail,
                    { height },
                  ]}
                />
              </View>
            );
          })
        )}
        <View style={[styles.graphThresholdLine, { bottom: getThresholdLineOffset(limit, maxValue) }]} />
        <View style={[styles.graphSlowLine, { bottom: getThresholdLineOffset(slowLimit, maxValue) }]} />
        <View style={[styles.graphThresholdBadge, styles.graphRunThresholdBadge, { bottom: getThresholdLineOffset(limit, maxValue) + 4 }]}>
          <Text style={styles.graphThresholdBadgeText}>{`run ${formatDecimal(limit)} ${unit}`}</Text>
        </View>
        <View style={[styles.graphThresholdBadge, styles.graphWalkThresholdBadge, { bottom: getThresholdLineOffset(slowLimit, maxValue) + 4 }]}>
          <Text style={styles.graphThresholdBadgeText}>{`walk ${formatDecimal(slowLimit)} ${unit}`}</Text>
        </View>
      </View>
    </View>
  );
};

const canAcceptSwing = (
  direction: SwingDirection,
  passed: boolean,
  now: number,
  lastAcceptedAt: number,
  lastDirection: SwingDirection,
): boolean => {
  if (!passed || direction === 'still' || now - lastAcceptedAt < MIN_SWING_INTERVAL_MS) {
    return false;
  }

  return lastDirection === 'still' || direction !== lastDirection;
};

const getAvatarState = (motionG: number, rotationRadPerSecond: number, timeSinceAcceptedMs: number): AvatarAnimationKey => {
  if (timeSinceAcceptedMs < ACTIVE_HOLD_MS || motionG >= MOTION_RUN_THRESHOLD_G || rotationRadPerSecond >= ROTATION_RUN_THRESHOLD_RAD_PER_SECOND) {
    return 'run';
  }

  if (motionG >= MOTION_WALK_THRESHOLD_G || rotationRadPerSecond >= ROTATION_WALK_THRESHOLD_RAD_PER_SECOND) {
    return 'walk';
  }

  return 'idle';
};

const getAvatarCaption = (state: AvatarAnimationKey, isRunning: boolean): string => {
  if (!isRunning) {
    return 'ready for chaos';
  }

  if (state === 'run') {
    return 'rapid motion detected';
  }

  if (state === 'walk') {
    return 'warming up';
  }

  return 'listening for motion';
};

const getSwingDirection = (verticalDelta: number): SwingDirection => {
  if (verticalDelta > 0.06) {
    return 'up';
  }

  if (verticalDelta < -0.06) {
    return 'down';
  }

  return 'still';
};

const getThresholdLineOffset = (value: number, maxValue: number): number => Math.max(8, Math.min(86, (value / maxValue) * 86));

const getVectorMagnitude = (x: number, y: number, z: number): number => Math.sqrt(x * x + y * y + z * z);

const getRelativeHeight = (value: number, maxValue: number): number => Math.max(5, Math.min(100, (value / Math.max(1, maxValue)) * 100));

const shouldStoreReplaySample = (now: number, previousSampleAt: number, passed: boolean): boolean =>
  passed || previousSampleAt === 0 || now - previousSampleAt >= REPLAY_SAMPLE_INTERVAL_MS;

const clearReplayTimeouts = (timeouts: Array<ReturnType<typeof setTimeout>>): void => {
  timeouts.forEach((timeout) => clearTimeout(timeout));
};

const formatDecimal = (value: number): string => value.toFixed(2);

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
};

const formatSessionDay = (timestamp: string): string =>
  new Date(timestamp).toLocaleDateString(undefined, { weekday: 'short' });

const formatSessionLabel = (timestamp: string, range: WankHistoryRange): string => {
  if (range === 'today') {
    return formatSessionTime(timestamp);
  }

  return new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const formatSessionTime = (timestamp: string): string =>
  new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const formatTime = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));

const styles = StyleSheet.create({
  heroPanel: {
    alignItems: 'center',
  },
  scoreWrap: {
    alignItems: 'center',
    gap: 0,
  },
  score: {
    color: COLORS.text,
    fontSize: 54,
    fontWeight: '900',
    lineHeight: 60,
  },
  scoreLabel: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
  },
  metricCard: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.border,
    borderRadius: THEME.radius.control,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: '46%',
    padding: 12,
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '900',
  },
  metricLabel: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  controlButton: {
    flex: 1,
  },
  replayButton: {
    width: '100%',
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  sectionCopy: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '900',
  },
  sectionText: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  graphBlock: {
    gap: 8,
  },
  graphHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  graphLabel: {
    color: COLORS.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  graphLimit: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '800',
  },
  graph: {
    alignItems: 'flex-end',
    backgroundColor: COLORS.ink,
    borderColor: COLORS.border,
    borderRadius: THEME.radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    height: 104,
    overflow: 'hidden',
    padding: 8,
  },
  graphBarSlot: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  graphBar: {
    borderRadius: 999,
    minHeight: 8,
    width: '100%',
  },
  graphBarPass: {
    backgroundColor: COLORS.progressOverflowStart,
  },
  graphBarSlow: {
    backgroundColor: COLORS.warning,
  },
  graphBarFail: {
    backgroundColor: COLORS.progressDangerStart,
  },
  graphThresholdLine: {
    backgroundColor: COLORS.progressOverflowEnd,
    height: 2,
    left: 8,
    opacity: 0.9,
    position: 'absolute',
    right: 8,
  },
  graphSlowLine: {
    backgroundColor: COLORS.warning,
    height: 1,
    left: 8,
    opacity: 0.75,
    position: 'absolute',
    right: 8,
  },
  graphThresholdBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    position: 'absolute',
    right: 10,
  },
  graphRunThresholdBadge: {
    backgroundColor: COLORS.progressOverflowSoft,
    borderColor: COLORS.progressOverflowStart,
    borderWidth: 1,
  },
  graphWalkThresholdBadge: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.warning,
    borderWidth: 1,
  },
  graphThresholdBadgeText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '900',
  },
  emptyGraphText: {
    alignSelf: 'center',
    color: COLORS.mutedText,
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  logPanel: {
    marginBottom: 12,
  },
  historyPanel: {
    gap: 14,
  },
  historyGraphPanel: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: THEME.radius.control,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  historyGraph: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    minHeight: 132,
    paddingTop: 8,
  },
  historyGraphColumn: {
    alignItems: 'center',
    gap: 6,
    width: 48,
  },
  historyGraphTrack: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.border,
    borderRadius: THEME.radius.control,
    borderWidth: 1,
    height: 84,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%',
  },
  historyGraphFill: {
    backgroundColor: COLORS.progressOverflowStart,
    borderRadius: THEME.radius.control,
    minHeight: 5,
    width: '100%',
  },
  historyGraphLabel: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '900',
  },
  historyGraphValue: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  emptyHistoryGraph: {
    alignItems: 'center',
    borderColor: COLORS.border,
    borderRadius: THEME.radius.control,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 84,
    justifyContent: 'center',
    minWidth: 220,
    paddingHorizontal: 18,
  },
  historyList: {
    gap: 10,
  },
  emptyHistory: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.border,
    borderRadius: THEME.radius.control,
    borderWidth: 1,
    padding: 14,
  },
  emptyHistoryTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
  },
  emptyHistoryText: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  historyRow: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.border,
    borderRadius: THEME.radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  historyDateBlock: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: THEME.radius.control,
    minWidth: 58,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  historyDay: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },
  historyTime: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  historyBody: {
    flex: 1,
    gap: 4,
  },
  historyTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyScore: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  historyCombo: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  historyMeta: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '800',
  },
  console: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.border,
    borderRadius: THEME.radius.control,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  consoleLine: {
    color: COLORS.primary,
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
  },
});
