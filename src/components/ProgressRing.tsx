import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
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
  caption?: string;
  completeColor?: string;
  overflowColor?: string;
  progressColor?: string;
  resetAnimationKey?: number;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const ProgressRing = ({
  caption = 'of daily goal',
  completeColor = COLORS.success,
  goal,
  overflowColor = COLORS.challengeText,
  progressColor = COLORS.action,
  resetAnimationKey = 0,
  steps,
}: ProgressRingProps) => {
  const targetRatio = goal > 0 ? steps / goal : 0;
  const targetProgress = Math.min(1, targetRatio);
  const targetOverflowProgress = getOverflowProgress(steps, goal);
  const [displayRatio, setDisplayRatio] = useState(targetRatio);
  const animatedProgress = useRef(new Animated.Value(targetProgress)).current;
  const animatedOverflowProgress = useRef(new Animated.Value(targetOverflowProgress)).current;
  const resetAnimationKeyRef = useRef(resetAnimationKey);
  const previousSteps = useRef(steps);
  const gainScale = useRef(new Animated.Value(1)).current;
  const fullPulseScale = useRef(new Animated.Value(1)).current;
  const fullPulseOpacity = useRef(new Animated.Value(0)).current;
  const overflowPulseScale = useRef(new Animated.Value(1)).current;
  const percentageScale = useRef(new Animated.Value(1)).current;

  const playGainAnimation = (delay = 0): void => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.sequence([
          Animated.spring(gainScale, {
            friction: 5,
            tension: 170,
            toValue: 1.045,
            useNativeDriver: true,
          }),
          Animated.spring(gainScale, {
            friction: 6,
            tension: 160,
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.spring(percentageScale, {
            friction: 4,
            tension: 190,
            toValue: 1.1,
            useNativeDriver: true,
          }),
          Animated.spring(percentageScale, {
            friction: 6,
            tension: 160,
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  };

  const playFullPulseAnimation = (): void => {
    fullPulseScale.setValue(1);
    fullPulseOpacity.setValue(0.34);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(fullPulseScale, {
          friction: 4,
          tension: 130,
          toValue: 1.14,
          useNativeDriver: true,
        }),
        Animated.spring(fullPulseScale, {
          friction: 7,
          tension: 120,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(fullPulseOpacity, {
        duration: 760,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const playOverflowPulseAnimation = (delay = 0): void => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(overflowPulseScale, {
        friction: 5,
        tension: 150,
        toValue: 1.045,
        useNativeDriver: true,
      }),
      Animated.spring(overflowPulseScale, {
        friction: 7,
        tension: 130,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    if (resetAnimationKey !== resetAnimationKeyRef.current) {
      return;
    }

    const reachedGoalThisUpdate = hasCrossedGoalCycle(previousSteps.current, steps, goal);
    const progressAnimation = Animated.timing(animatedProgress, {
      duration: 650,
      toValue: targetProgress,
      useNativeDriver: false,
    });
    const overflowAnimation = Animated.timing(animatedOverflowProgress, {
      duration: 650,
      toValue: targetOverflowProgress,
      useNativeDriver: false,
    });

    if (reachedGoalThisUpdate) {
      Animated.sequence([
        progressAnimation,
        Animated.delay(110),
        overflowAnimation,
      ]).start();
    } else {
      Animated.parallel([progressAnimation, overflowAnimation]).start();
    }

    setDisplayRatio(targetRatio);

    if (steps > previousSteps.current) {
      playGainAnimation();
    }

    if (reachedGoalThisUpdate) {
      playFullPulseAnimation();
    }

    if (steps > previousSteps.current && steps > goal && goal > 0) {
      playOverflowPulseAnimation(reachedGoalThisUpdate ? 780 : 0);
    }

    previousSteps.current = steps;
  }, [animatedOverflowProgress, animatedProgress, goal, overflowPulseScale, resetAnimationKey, steps, targetOverflowProgress, targetProgress, targetRatio]);

  useEffect(() => {
    if (resetAnimationKey === resetAnimationKeyRef.current) {
      return undefined;
    }

    resetAnimationKeyRef.current = resetAnimationKey;
    animatedProgress.stopAnimation();
    animatedOverflowProgress.stopAnimation();
    animatedProgress.setValue(0);
    animatedOverflowProgress.setValue(0);
    setDisplayRatio(0);

    Animated.sequence([
      Animated.delay(80),
      Animated.sequence([
        Animated.timing(animatedProgress, {
          duration: 660,
          toValue: targetProgress,
          useNativeDriver: false,
        }),
        Animated.delay(targetOverflowProgress > 0 ? 110 : 0),
        Animated.timing(animatedOverflowProgress, {
          duration: targetOverflowProgress > 0 ? 520 : 1,
          toValue: targetOverflowProgress,
          useNativeDriver: false,
        }),
      ]),
    ]).start(() => setDisplayRatio(targetRatio));

    playGainAnimation(200);
    if (steps >= goal && goal > 0) {
      playFullPulseAnimation();
      playOverflowPulseAnimation(860);
    }
    previousSteps.current = steps;
  }, [animatedOverflowProgress, animatedProgress, goal, overflowPulseScale, resetAnimationKey, steps, targetOverflowProgress, targetProgress, targetRatio]);

  const isComplete = steps >= goal;
  const baseDisplayRatio = Math.min(displayRatio, 1);
  const percentage = formatProgressPercentage(baseDisplayRatio);
  const overflowPercentage = goal > 0 && steps > goal ? formatProgressPercentage((steps - goal) / goal) : null;
  const radius = (HOME_PROGRESS_RING_SIZE - HOME_PROGRESS_RING_WIDTH - HOME_PROGRESS_RING_PADDING) / 2;
  const overflowRadius = radius;
  const overflowStrokeWidth = HOME_PROGRESS_RING_WIDTH + 8;
  const circumference = 2 * Math.PI * radius;
  const overflowCircumference = 2 * Math.PI * overflowRadius;
  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });
  const overflowStrokeDashoffset = animatedOverflowProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [overflowCircumference, 0],
  });
  const ringColor = isComplete ? completeColor : progressColor;
  const ringScale = Animated.multiply(gainScale, fullPulseScale);
  const shouldShowOverflow = steps > goal && goal > 0;

  return (
    <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }] }]}>
      <Animated.View style={[styles.fullPulse, { opacity: fullPulseOpacity, transform: [{ scale: fullPulseScale }] }]} />
      <Svg height={HOME_PROGRESS_RING_SIZE} style={styles.svg} width={HOME_PROGRESS_RING_SIZE}>
        <Circle
          cx={HOME_PROGRESS_RING_SIZE / 2}
          cy={HOME_PROGRESS_RING_SIZE / 2}
          fill="none"
          r={radius}
          stroke={COLORS.border}
          strokeWidth={HOME_PROGRESS_RING_WIDTH}
        />
        <AnimatedCircle
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
      {shouldShowOverflow ? (
        <Animated.View style={[styles.overflowLayer, { transform: [{ scale: overflowPulseScale }] }]}>
          <Svg height={HOME_PROGRESS_RING_SIZE} style={styles.svg} width={HOME_PROGRESS_RING_SIZE}>
            <AnimatedCircle
              cx={HOME_PROGRESS_RING_SIZE / 2}
              cy={HOME_PROGRESS_RING_SIZE / 2}
              fill="none"
              opacity={0.3}
              r={overflowRadius}
              stroke={overflowColor}
              strokeDasharray={overflowCircumference}
              strokeDashoffset={overflowStrokeDashoffset}
              strokeLinecap="round"
              strokeWidth={overflowStrokeWidth + 8}
            />
            <AnimatedCircle
              cx={HOME_PROGRESS_RING_SIZE / 2}
              cy={HOME_PROGRESS_RING_SIZE / 2}
              fill="none"
              r={overflowRadius}
              stroke={overflowColor}
              strokeDasharray={overflowCircumference}
              strokeDashoffset={overflowStrokeDashoffset}
              strokeLinecap="round"
              strokeWidth={overflowStrokeWidth}
            />
          </Svg>
        </Animated.View>
      ) : null}
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ scale: percentageScale }] }}>
          <PercentageLabel color={ringColor} value={percentage} />
        </Animated.View>
        <Text style={styles.caption}>{caption}</Text>
        {overflowPercentage !== null ? (
          <Text style={styles.overflowCaption}>{`+${overflowPercentage}% extra`}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
};

type PercentageLabelProps = {
  color: string;
  value: string;
};

const PercentageLabel = ({ color, value }: PercentageLabelProps) => {
  const [wholePercentage, decimalPercentage] = value.split('.');

  return (
    <Text style={[styles.percentage, { color }]}>
      {wholePercentage}
      <Text style={[styles.percentageDecimal, { color }]}>{`.${decimalPercentage}`}</Text>
      <Text style={[styles.percentageSuffix, { color }]}>%</Text>
    </Text>
  );
};

const formatProgressPercentage = (progress: number): string => (progress * 100).toFixed(2);

const getOverflowProgress = (steps: number, goal: number): number => {
  if (goal <= 0 || steps <= goal) {
    return 0;
  }

  const overflowSteps = steps - goal;
  const cycleProgress = overflowSteps % goal;
  return cycleProgress === 0 ? 1 : cycleProgress / goal;
};

const hasCrossedGoalCycle = (previousSteps: number, nextSteps: number, goal: number): boolean => {
  if (goal <= 0 || nextSteps <= previousSteps) {
    return false;
  }

  return Math.floor(nextSteps / goal) > Math.floor(previousSteps / goal);
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
  fullPulse: {
    ...StyleSheet.absoluteFillObject,
    borderColor: COLORS.challengeText,
    borderRadius: HOME_PROGRESS_RING_SIZE / 2,
    borderWidth: 4,
  },
  svg: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  overflowLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    alignItems: 'center',
    gap: 6,
  },
  percentage: {
    color: COLORS.action,
    fontSize: 48,
    fontWeight: '800',
  },
  percentageDecimal: {
    color: COLORS.action,
    fontSize: 27,
    fontWeight: '800',
  },
  percentageSuffix: {
    color: COLORS.action,
    fontSize: 22,
    fontWeight: '800',
  },
  caption: {
    color: COLORS.mutedText,
    fontSize: 14,
    fontWeight: '600',
  },
  overflowCaption: {
    color: COLORS.challengeText,
    fontSize: 13,
    fontWeight: '800',
  },
});
