import { ReactNode, useEffect, useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  PressableStateCallbackType,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';

import { triggerSelectionHaptic } from '../utils/haptics';

type AnimatedPressableProps = Omit<PressableProps, 'style' | 'children' | 'onPressIn' | 'onPressOut'> & {
  activePulse?: boolean;
  children: ReactNode;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
};

export const AnimatedPressable = ({
  activePulse = false,
  children,
  onPressIn,
  onPressOut,
  style,
  ...props
}: AnimatedPressableProps) => {
  const pressScale = useRef(new Animated.Value(1)).current;
  const activeScale = useRef(new Animated.Value(1)).current;
  const activeOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!activePulse) {
      activeScale.setValue(1);
      activeOpacity.setValue(1);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(activeScale, {
            duration: 650,
            toValue: 1.035,
            useNativeDriver: true,
          }),
          Animated.timing(activeOpacity, {
            duration: 650,
            toValue: 0.82,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(activeScale, {
            duration: 650,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(activeOpacity, {
            duration: 650,
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [activeOpacity, activePulse, activeScale]);

  const handlePressIn = (event: GestureResponderEvent): void => {
    if (!props.disabled) {
      triggerSelectionHaptic();
    }

    Animated.spring(pressScale, {
      friction: 5,
      tension: 180,
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent): void => {
    Animated.sequence([
      Animated.spring(pressScale, {
        friction: 4,
        tension: 180,
        toValue: 1.035,
        useNativeDriver: true,
      }),
      Animated.spring(pressScale, {
        friction: 5,
        tension: 180,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
    onPressOut?.(event);
  };

  return (
    <Pressable
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressable}
    >
      {(state) => (
        <Animated.View
          style={[
            typeof style === 'function' ? style(state) : style,
            {
              opacity: activePulse ? activeOpacity : 1,
              transform: [{ scale: Animated.multiply(pressScale, activeScale) }],
            },
          ]}
        >
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'auto',
  },
});
