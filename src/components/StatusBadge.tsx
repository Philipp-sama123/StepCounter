import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { COLORS } from '../constants';
import { WalkingStatus } from '../hooks/useStepCounter';

type StatusBadgeProps = {
  attention?: boolean;
  status: WalkingStatus;
};

export const StatusBadge = ({ attention = false, status }: StatusBadgeProps) => {
  const isWalking = status === 'walking';
  const isUnknown = status === 'unknown';
  const shouldBlink = isWalking || attention;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!shouldBlink) {
      opacity.setValue(1);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          duration: 520,
          toValue: 0.35,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          duration: 520,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [opacity, shouldBlink]);

  return (
    <Animated.View
      style={[
        styles.badge,
        attention ? styles.challengeBadge : isWalking ? styles.walkingBadge : isUnknown ? styles.unknownBadge : styles.stoppedBadge,
        { opacity },
      ]}
    >
      <Animated.View style={[styles.dot, attention ? styles.challengeDot : isWalking ? styles.walkingDot : isUnknown ? styles.unknownDot : styles.stoppedDot]} />
      <Text style={[styles.text, attention ? styles.challengeText : isWalking ? styles.walkingText : isUnknown ? styles.unknownText : styles.stoppedText]}>
        {attention ? 'Challenge running' : isWalking ? 'Walking' : isUnknown ? 'No information' : 'Stopped'}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  badge: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  walkingBadge: {
    backgroundColor: COLORS.successSoft,
  },
  challengeBadge: {
    backgroundColor: COLORS.challengeSoft,
  },
  stoppedBadge: {
    backgroundColor: COLORS.stoppedSoft,
  },
  unknownBadge: {
    backgroundColor: COLORS.surface,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  walkingDot: {
    backgroundColor: COLORS.success,
  },
  challengeDot: {
    backgroundColor: COLORS.challenge,
  },
  stoppedDot: {
    backgroundColor: COLORS.stopped,
  },
  unknownDot: {
    backgroundColor: COLORS.mutedText,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
  },
  walkingText: {
    color: COLORS.success,
  },
  challengeText: {
    color: COLORS.challenge,
  },
  stoppedText: {
    color: COLORS.stopped,
  },
  unknownText: {
    color: COLORS.mutedText,
  },
});
