import { useEffect, useRef, useState } from 'react';
import { Animated, TextStyle } from 'react-native';

type AnimatedStepCountProps = {
  replayKey?: number;
  steps: number;
  style: TextStyle;
};

export const AnimatedStepCount = ({ replayKey = 0, steps, style }: AnimatedStepCountProps) => {
  const [displaySteps, setDisplaySteps] = useState(steps);
  const animatedSteps = useRef(new Animated.Value(steps)).current;
  const previousSteps = useRef(steps);
  const replayKeyRef = useRef(replayKey);
  const blinkOpacity = useRef(new Animated.Value(1)).current;
  const bounceScale = useRef(new Animated.Value(1)).current;

  const playFinishAnimation = (): void => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(blinkOpacity, {
          duration: 85,
          toValue: 0.2,
          useNativeDriver: true,
        }),
        Animated.timing(blinkOpacity, {
          duration: 130,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.spring(bounceScale, {
          friction: 4,
          tension: 190,
          toValue: 1.12,
          useNativeDriver: true,
        }),
        Animated.spring(bounceScale, {
          friction: 6,
          tension: 160,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  useEffect(() => {
    const listenerId = animatedSteps.addListener(({ value }) => {
      setDisplaySteps(Math.max(0, Math.floor(value)));
    });

    return () => {
      animatedSteps.removeListener(listenerId);
    };
  }, [animatedSteps]);

  useEffect(() => {
    if (replayKey !== replayKeyRef.current) {
      return;
    }

    Animated.timing(animatedSteps, {
      duration: steps > previousSteps.current ? 700 : 360,
      toValue: steps,
      useNativeDriver: false,
    }).start(() => {
      if (steps !== previousSteps.current) {
        playFinishAnimation();
      }

      previousSteps.current = steps;
    });
  }, [animatedSteps, replayKey, steps]);

  useEffect(() => {
    if (replayKey === replayKeyRef.current) {
      return;
    }

    replayKeyRef.current = replayKey;
    animatedSteps.stopAnimation();
    animatedSteps.setValue(0);
    setDisplaySteps(0);
    blinkOpacity.setValue(1);
    bounceScale.setValue(1);

    Animated.timing(animatedSteps, {
      duration: 780,
      toValue: steps,
      useNativeDriver: false,
    }).start(() => {
      playFinishAnimation();

      previousSteps.current = steps;
    });
  }, [animatedSteps, replayKey, steps]);

  return <Animated.Text style={[style, { opacity: blinkOpacity, transform: [{ scale: bounceScale }] }]}>{displaySteps.toLocaleString()}</Animated.Text>;
};
