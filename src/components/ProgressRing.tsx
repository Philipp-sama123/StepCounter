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
  progressColor?: string;
  resetAnimationKey?: number;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const ProgressRing = ({
  caption = 'of daily goal',
  completeColor = COLORS.success,
  goal,
  progressColor = COLORS.action,
  resetAnimationKey = 0,
  steps,
}: ProgressRingProps) => {
  const targetProgress = goal > 0 ? Math.min(1, steps / goal) : 0;
  const [displayProgress, setDisplayProgress] = useState(targetProgress);
  const animatedProgress = useRef(new Animated.Value(targetProgress)).current;
  const resetAnimationKeyRef = useRef(resetAnimationKey);
  const previousSteps = useRef(steps);
  const gainScale = useRef(new Animated.Value(1)).current;
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

  useEffect(() => {
    const listenerId = animatedProgress.addListener(({ value }) => {
      setDisplayProgress(value);
    });

    return () => {
      animatedProgress.removeListener(listenerId);
    };
  }, [animatedProgress]);

  useEffect(() => {
    if (resetAnimationKey !== resetAnimationKeyRef.current) {
      return;
    }

    Animated.timing(animatedProgress, {
      duration: 650,
      toValue: targetProgress,
      useNativeDriver: false,
    }).start();

    if (steps > previousSteps.current) {
      playGainAnimation();
    }

    previousSteps.current = steps;
  }, [animatedProgress, resetAnimationKey, steps, targetProgress]);

  useEffect(() => {
    if (resetAnimationKey === resetAnimationKeyRef.current) {
      return undefined;
    }

    resetAnimationKeyRef.current = resetAnimationKey;
    animatedProgress.stopAnimation();
    animatedProgress.setValue(0);
    setDisplayProgress(0);

    Animated.sequence([
      Animated.delay(80),
      Animated.timing(animatedProgress, {
        duration: 820,
        toValue: targetProgress,
        useNativeDriver: false,
      }),
    ]).start();

    playGainAnimation(200);
  }, [animatedProgress, resetAnimationKey, targetProgress]);

  const percentage = formatProgressPercentage(displayProgress);
  const isComplete = steps >= goal;
  const radius = (HOME_PROGRESS_RING_SIZE - HOME_PROGRESS_RING_WIDTH - HOME_PROGRESS_RING_PADDING) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });
  const ringColor = isComplete ? completeColor : progressColor;

  return (
    <Animated.View style={[styles.ring, { transform: [{ scale: gainScale }] }]}>
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
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ scale: percentageScale }] }}>
          <PercentageLabel color={ringColor} value={percentage} />
        </Animated.View>
        <Text style={styles.caption}>{caption}</Text>
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
});
