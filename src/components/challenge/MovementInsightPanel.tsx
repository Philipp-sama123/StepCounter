import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TextStyle, View } from 'react-native';

import { COLORS } from '../../constants';
import { StepDataSource } from '../../health/types';
import { formatDuration, RollingAverages } from '../../utils/challengeMetrics';
import { getStepSourceLabel } from '../../utils/stepSource';

type MovementInsightPanelProps = {
  currentChallengeDelta: number;
  currentChallengeGoal: number;
  dailyChallengeGoal: number;
  dailyChallengeGoalPercent: number;
  debugMessage: string;
  isChallengeActive: boolean;
  rollingAverages: RollingAverages;
  sessionDurationMs: number;
  sessionPace: number;
  source: StepDataSource;
};

export const MovementInsightPanel = ({
  currentChallengeDelta,
  currentChallengeGoal,
  dailyChallengeGoal,
  dailyChallengeGoalPercent,
  debugMessage,
  isChallengeActive,
  rollingAverages,
  sessionDurationMs,
  sessionPace,
  source,
}: MovementInsightPanelProps) => {
  const challengeGoalPercent = currentChallengeGoal > 0 ? Math.min(100, (currentChallengeDelta / currentChallengeGoal) * 100) : 0;

  return (
    <View style={styles.sensorSection}>
      <View style={styles.averagePanel}>
        <View style={styles.averageHeader}>
          <View>
            <Text style={styles.averageTitle}>Movement insight</Text>
            <Text style={styles.averageDescription}>Animated live signals from your last minute of movement.</Text>
          </View>
          <Text style={styles.averageMeta}>{isChallengeActive ? 'running' : 'idle'}</Text>
        </View>
        <View style={styles.averageGrid}>
          <AverageMetric label="Cadence" suffix="/min" value={rollingAverages.stepsPerMinute} />
          <AverageMetric label="Acceleration" suffix="g" value={rollingAverages.accelerometerMagnitude} />
          <AverageMetric label="Rotation" suffix="rad/s" value={rollingAverages.gyroscopeMagnitude} />
        </View>
      </View>

      <View style={styles.sensorSummary}>
        <View style={styles.sensorSummaryItem}>
          <Text style={styles.sensorSummaryLabel}>Source</Text>
          <Text style={styles.sensorSummaryValue}>{getStepSourceLabel(source)}</Text>
        </View>
        <View style={styles.sensorSummaryItem}>
          <Text style={styles.sensorSummaryLabel}>Session</Text>
          <Text style={styles.sensorSummaryValue}>{currentChallengeDelta.toLocaleString()}</Text>
        </View>
        <View style={styles.sensorSummaryItem}>
          <Text style={styles.sensorSummaryLabel}>Pace</Text>
          <Text style={styles.sensorSummaryValue}>{`${sessionPace.toLocaleString()}/min`}</Text>
        </View>
      </View>

      <View style={styles.challengeDetailPanel}>
        <View style={styles.challengeDetailItem}>
          <Ionicons color={COLORS.challenge} name="timer-outline" size={18} />
          <View>
            <Text style={styles.challengeDetailLabel}>Duration</Text>
            <Text style={styles.challengeDetailValue}>{formatDuration(sessionDurationMs)}</Text>
          </View>
        </View>
        <View style={styles.challengeDetailItem}>
          <Ionicons color={COLORS.challenge} name="flag-outline" size={18} />
          <View>
            <Text style={styles.challengeDetailLabel}>{isChallengeActive ? 'Challenge goal' : 'Daily challenge'}</Text>
            <Text style={styles.challengeDetailValueOrange}>
              {`${(isChallengeActive ? challengeGoalPercent : dailyChallengeGoalPercent).toFixed(1)}%`}
            </Text>
          </View>
        </View>
        <View style={styles.challengeDetailItem}>
          <Ionicons color={COLORS.challenge} name="walk-outline" size={18} />
          <View>
            <Text style={styles.challengeDetailLabel}>{isChallengeActive ? 'Goal steps' : 'Daily goal'}</Text>
            <Text style={styles.challengeDetailValueOrange}>
              {isChallengeActive ? currentChallengeGoal.toLocaleString() : dailyChallengeGoal.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sensorHint}>{debugMessage}</Text>
    </View>
  );
};

type AverageMetricProps = {
  label: string;
  suffix: string;
  value: number;
};

const AverageMetric = ({ label, suffix, value }: AverageMetricProps) => (
  <View style={styles.averageMetric}>
    <Text style={styles.averageMetricLabel}>{label}</Text>
    <View style={styles.averageValueRow}>
      <AnimatedMetricNumber value={value} style={styles.averageMetricValue} />
      <Text style={styles.averageMetricSuffix}>{suffix}</Text>
    </View>
  </View>
);

type AnimatedMetricNumberProps = {
  style: TextStyle;
  value: number;
};

const AnimatedMetricNumber = ({ style, value }: AnimatedMetricNumberProps) => {
  const animatedValue = useRef(new Animated.Value(value)).current;
  const [displayValue, setDisplayValue] = useState(value);
  const bounceScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const listenerId = animatedValue.addListener(({ value: nextValue }) => {
      setDisplayValue(nextValue);
    });

    return () => {
      animatedValue.removeListener(listenerId);
    };
  }, [animatedValue]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animatedValue, {
        duration: 520,
        toValue: value,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.spring(bounceScale, {
          friction: 5,
          tension: 160,
          toValue: 1.08,
          useNativeDriver: true,
        }),
        Animated.spring(bounceScale, {
          friction: 6,
          tension: 150,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [animatedValue, bounceScale, value]);

  return (
    <Animated.Text style={[style, { transform: [{ scale: bounceScale }] }]}>
      {displayValue >= 100 ? Math.round(displayValue).toLocaleString() : displayValue.toFixed(2)}
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  sensorSection: {
    gap: 12,
    marginBottom: 28,
  },
  averagePanel: {
    backgroundColor: COLORS.challengeSoft,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  averageHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  averageTitle: {
    color: COLORS.challenge,
    fontSize: 15,
    fontWeight: '900',
  },
  averageDescription: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 2,
  },
  averageMeta: {
    color: COLORS.challenge,
    fontSize: 11,
    fontWeight: '800',
  },
  averageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  averageMetric: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 76,
    paddingHorizontal: 10,
    paddingVertical: 10,
    width: '31%',
  },
  averageMetricLabel: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 6,
  },
  averageValueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  averageMetricValue: {
    color: COLORS.challenge,
    fontSize: 18,
    fontWeight: '900',
  },
  averageMetricSuffix: {
    color: COLORS.challenge,
    fontSize: 10,
    fontWeight: '800',
    paddingBottom: 2,
  },
  sensorSummary: {
    flexDirection: 'row',
    gap: 12,
  },
  sensorSummaryItem: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sensorSummaryLabel: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  sensorSummaryValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
  },
  challengeDetailPanel: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  challengeDetailItem: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  challengeDetailLabel: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  challengeDetailValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  challengeDetailValueOrange: {
    color: COLORS.challenge,
    fontSize: 15,
    fontWeight: '900',
  },
  sensorHint: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
});
