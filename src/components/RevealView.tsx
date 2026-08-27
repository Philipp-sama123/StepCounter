import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

type RevealViewProps = {
  children: ReactNode;
  delay?: number;
  replayKey?: number;
  style?: StyleProp<ViewStyle>;
};

export const RevealView = ({ children, delay = 0, replayKey = 0, style }: RevealViewProps) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const scale = useRef(new Animated.Value(0.985)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(14);
    scale.setValue(0.985);

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, {
          duration: 260,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          damping: 18,
          stiffness: 160,
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          damping: 18,
          stiffness: 150,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [delay, opacity, replayKey, scale, translateY]);

  return <Animated.View style={[style, { opacity, transform: [{ translateY }, { scale }] }]}>{children}</Animated.View>;
};
