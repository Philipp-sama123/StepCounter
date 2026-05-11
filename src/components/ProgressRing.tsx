import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import {
  COLORS,
  HOME_PROGRESS_RING_PADDING,
  HOME_PROGRESS_RING_SIZE,
  HOME_PROGRESS_RING_WIDTH,
} from '../constants';

type ProgressRingProps = {
  steps: number;
  goal: number;
};

export const ProgressRing = ({ steps, goal }: ProgressRingProps) => {
  const progress = Math.min(1, steps / goal);
  const percentage = (progress * 100).toFixed(2);
  const isComplete = steps >= goal;
  const radius = (HOME_PROGRESS_RING_SIZE - HOME_PROGRESS_RING_WIDTH - HOME_PROGRESS_RING_PADDING) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);
  const ringColor = isComplete ? COLORS.success : COLORS.primary;

  return (
    <View style={styles.ring}>
      <Svg height={HOME_PROGRESS_RING_SIZE} style={styles.svg} width={HOME_PROGRESS_RING_SIZE}>
        <Circle
          cx={HOME_PROGRESS_RING_SIZE / 2}
          cy={HOME_PROGRESS_RING_SIZE / 2}
          fill="none"
          r={radius}
          stroke={COLORS.border}
          strokeWidth={HOME_PROGRESS_RING_WIDTH}
        />
        <Circle
          cx={HOME_PROGRESS_RING_SIZE / 2}
          cy={HOME_PROGRESS_RING_SIZE / 2}
          fill="none"
          r={radius}
          stroke={ringColor}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          strokeWidth={HOME_PROGRESS_RING_WIDTH}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={styles.percentage}>{`${percentage}%`}</Text>
        <Text style={styles.caption}>of daily goal</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  ring: {
    width: HOME_PROGRESS_RING_SIZE,
    height: HOME_PROGRESS_RING_SIZE,
    borderRadius: HOME_PROGRESS_RING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  svg: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  center: {
    alignItems: 'center',
    gap: 6,
  },
  percentage: {
    color: COLORS.text,
    fontSize: 48,
    fontWeight: '800',
  },
  caption: {
    color: COLORS.mutedText,
    fontSize: 14,
    fontWeight: '600',
  },
});
