import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import {
  COLORS,
  HOME_PROGRESS_RING_PADDING,
  HOME_PROGRESS_RING_SIZE,
  HOME_PROGRESS_RING_WIDTH,
} from '../constants';
import { triggerSuccessHaptic } from '../utils/haptics';

type ProgressRingProps = {
  steps: number;
  goal: number;
  caption?: string;
  completeColor?: string;
  progressColor?: string;
  resetAnimationKey?: number;
  size?: number;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const ProgressRing = ({
  caption = 'of daily goal',
  completeColor = COLORS.action,
  goal,
  progressColor = COLORS.action,
  resetAnimationKey = 0,
  size = HOME_PROGRESS_RING_SIZE,
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
  const overflowPulseOpacity = useRef(new Animated.Value(0)).current;
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

  const playFullFeedback = (): void => {
    playFullPulseAnimation();
    triggerSuccessHaptic();
  };

  const playOverflowPulseAnimation = (): void => {
    overflowPulseScale.setValue(1);
    overflowPulseOpacity.setValue(0.4);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(overflowPulseScale, {
          friction: 5,
          tension: 150,
          toValue: 1.18,
          useNativeDriver: true,
        }),
        Animated.spring(overflowPulseScale, {
          friction: 7,
          tension: 130,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(overflowPulseOpacity, {
        duration: 520,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const playOverflowFeedback = (): void => {
    playOverflowPulseAnimation();
    triggerSuccessHaptic();
  };

  useEffect(() => {
    let currentBaseProgress = targetProgress;
    let currentOverflowProgress = targetOverflowProgress;
    const updateDisplayRatio = (): void => {
      setDisplayRatio(currentBaseProgress + (steps > goal && goal > 0 ? currentOverflowProgress : 0));
    };
    const progressListenerId = animatedProgress.addListener(({ value }) => {
      currentBaseProgress = value;
      updateDisplayRatio();
    });
    const overflowListenerId = animatedOverflowProgress.addListener(({ value }) => {
      currentOverflowProgress = value;
      updateDisplayRatio();
    });

    return () => {
      animatedProgress.removeListener(progressListenerId);
      animatedOverflowProgress.removeListener(overflowListenerId);
    };
  }, [animatedOverflowProgress, animatedProgress, goal, steps, targetOverflowProgress, targetProgress]);

  useEffect(() => {
    if (resetAnimationKey !== resetAnimationKeyRef.current) {
      return;
    }

    const previousStepCount = previousSteps.current;
    const reachedGoalThisUpdate = hasCrossedGoalCycle(previousStepCount, steps, goal);
    const gainedSteps = steps > previousStepCount;
    const shouldPlayOverflowFeedback = gainedSteps && steps > goal && goal > 0;
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
      Animated.sequence([progressAnimation]).start(({ finished }) => {
        if (!finished) {
          return;
        }

        playFullFeedback();
        Animated.sequence([
          Animated.delay(targetOverflowProgress > 0 ? 110 : 0),
          overflowAnimation,
        ]).start(({ finished: overflowFinished }) => {
          if (overflowFinished && targetOverflowProgress > 0) {
            playOverflowFeedback();
          }
        });
      });
    } else {
      Animated.parallel([progressAnimation, overflowAnimation]).start(({ finished }) => {
        if (finished && shouldPlayOverflowFeedback) {
          playOverflowFeedback();
        }
      });
    }

    if (gainedSteps) {
      playGainAnimation();
    }

    previousSteps.current = steps;
  }, [animatedOverflowProgress, animatedProgress, goal, resetAnimationKey, steps, targetOverflowProgress, targetProgress, targetRatio]);

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
      Animated.timing(animatedProgress, {
        duration: 660,
        toValue: targetProgress,
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        return;
      }

      if (steps >= goal && goal > 0) {
        playFullFeedback();
      }

      Animated.sequence([
        Animated.delay(targetOverflowProgress > 0 ? 110 : 0),
        Animated.timing(animatedOverflowProgress, {
          duration: targetOverflowProgress > 0 ? 520 : 1,
          toValue: targetOverflowProgress,
          useNativeDriver: false,
        }),
      ]).start(({ finished: overflowFinished }) => {
        if (overflowFinished && targetOverflowProgress > 0) {
          playOverflowFeedback();
        }
        setDisplayRatio(targetRatio);
      });
    });

    playGainAnimation(200);
    previousSteps.current = steps;
  }, [animatedOverflowProgress, animatedProgress, goal, resetAnimationKey, steps, targetOverflowProgress, targetProgress, targetRatio]);

  const isComplete = steps >= goal;
  const baseDisplayRatio = Math.min(displayRatio, 1);
  const percentage = formatProgressPercentage(baseDisplayRatio);
  const overflowPercentage = goal > 0 && steps > goal ? formatProgressPercentage((steps - goal) / goal) : null;
  const radius = (size - HOME_PROGRESS_RING_WIDTH - HOME_PROGRESS_RING_PADDING) / 2;
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
    <Animated.View style={[styles.ring, { borderRadius: size / 2, height: size, width: size, transform: [{ scale: ringScale }] }]}>
      <Animated.View style={[styles.fullPulse, { borderRadius: size / 2, opacity: fullPulseOpacity, transform: [{ scale: fullPulseScale }] }]} />
      <Animated.View style={[styles.overflowPulse, { borderRadius: size / 2, opacity: overflowPulseOpacity, transform: [{ scale: overflowPulseScale }] }]} />
      <Svg height={size} style={styles.svg} width={size}>
        <Defs>
          <LinearGradient id="ringProgressGradient" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={COLORS.avatarGradientStart} />
            <Stop offset="0.58" stopColor={COLORS.avatarGradientMiddle} />
            <Stop offset="1" stopColor={COLORS.avatarGradientEnd} />
          </LinearGradient>
          <LinearGradient id="ringOverflowGradient" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={COLORS.avatarGradientEnd} />
            <Stop offset="1" stopColor={COLORS.progressOverflowEnd} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={COLORS.border}
          strokeWidth={HOME_PROGRESS_RING_WIDTH}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke="url(#ringProgressGradient)"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          strokeWidth={HOME_PROGRESS_RING_WIDTH}
        />
      </Svg>
      {shouldShowOverflow ? (
        <View style={styles.overflowLayer}>
          <Svg height={size} style={styles.svg} width={size}>
            <Defs>
              <LinearGradient id="ringOverflowGradientLayer" x1="0" x2="1" y1="0" y2="1">
                <Stop offset="0" stopColor={COLORS.avatarGradientEnd} />
                <Stop offset="1" stopColor={COLORS.progressOverflowEnd} />
              </LinearGradient>
            </Defs>
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              fill="none"
              opacity={0.3}
              r={overflowRadius}
              stroke="url(#ringOverflowGradientLayer)"
              strokeDasharray={overflowCircumference}
              strokeDashoffset={overflowStrokeDashoffset}
              strokeLinecap="round"
              strokeWidth={overflowStrokeWidth + 8}
            />
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              fill="none"
              r={overflowRadius}
              stroke="url(#ringOverflowGradientLayer)"
              strokeDasharray={overflowCircumference}
              strokeDashoffset={overflowStrokeDashoffset}
              strokeLinecap="round"
              strokeWidth={overflowStrokeWidth}
            />
          </Svg>
        </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  fullPulse: {
    ...StyleSheet.absoluteFillObject,
    borderColor: COLORS.challengeText,
    borderWidth: 4,
  },
  overflowPulse: {
    ...StyleSheet.absoluteFillObject,
    borderColor: COLORS.progressOverflowStart,
    borderWidth: 5,
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
    color: COLORS.progressOverflowStart,
    fontSize: 13,
    fontWeight: '800',
  },
});
