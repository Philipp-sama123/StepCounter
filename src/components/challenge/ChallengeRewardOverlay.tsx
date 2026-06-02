import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../../constants';
import { formatDuration } from '../../utils/challengeMetrics';

export type ChallengeReward = {
  durationMs: number;
  goalPercent: number;
  steps: number;
};

type ChallengeRewardOverlayProps = {
  onDone: () => void;
  reward: ChallengeReward | null;
};

export const ChallengeRewardOverlay = ({ onDone, reward }: ChallengeRewardOverlayProps) => {
  const overlayProgress = useRef(new Animated.Value(0)).current;
  const cardProgress = useRef(new Animated.Value(0)).current;
  const exitProgress = useRef(new Animated.Value(0)).current;
  const isDismissingRef = useRef(false);

  useEffect(() => {
    if (reward === null) {
      overlayProgress.setValue(0);
      cardProgress.setValue(0);
      exitProgress.setValue(0);
      isDismissingRef.current = false;
      return undefined;
    }

    overlayProgress.setValue(0);
    cardProgress.setValue(0);
    exitProgress.setValue(0);
    isDismissingRef.current = false;
    const animation = Animated.parallel([
      Animated.timing(overlayProgress, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(cardProgress, {
        friction: 7,
        tension: 140,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [cardProgress, exitProgress, overlayProgress, reward]);

  if (reward === null) {
    return null;
  }

  const dismissReward = (): void => {
    if (isDismissingRef.current) {
      return;
    }

    isDismissingRef.current = true;
    Animated.parallel([
      Animated.timing(exitProgress, {
        duration: 360,
        easing: Easing.in(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(overlayProgress, {
        delay: 120,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onDone();
      }
    });
  };

  const overlayOpacity = overlayProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const cardScale = cardProgress.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [0.72, 1.06, 1],
  });
  const cardTranslateY = cardProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-260, 0],
  });
  const cardTranslateX = exitProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 460],
  });
  const iconScale = cardProgress.interpolate({
    inputRange: [0, 0.35, 0.72, 1],
    outputRange: [0.35, 1.2, 0.96, 1],
  });
  const cardOpacity = cardProgress.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <Animated.View style={[styles.rewardOverlay, { opacity: overlayOpacity }]}>
      <View style={styles.rewardGlow} />
      <Pressable
        accessibilityLabel="Close challenge reward"
        accessibilityRole="button"
        onPress={dismissReward}
      >
        <Animated.View
          style={[
            styles.rewardCard,
            {
              opacity: cardOpacity,
              transform: [
                { translateX: cardTranslateX },
                { translateY: cardTranslateY },
                { scale: cardScale },
              ],
            },
          ]}
        >
          <Animated.View style={[styles.rewardIcon, { transform: [{ scale: iconScale }] }]}>
            <Ionicons color={COLORS.onDanger} name="trophy-outline" size={42} />
          </Animated.View>
          <Text style={styles.rewardEyebrow}>Challenge complete</Text>
          <Text style={styles.rewardSteps}>{`+${reward.steps.toLocaleString()}`}</Text>
          <Text style={styles.rewardLabel}>session steps</Text>
          <View style={styles.rewardStats}>
            <View style={styles.rewardStat}>
              <Text style={styles.rewardStatValue}>{`${reward.goalPercent.toFixed(1)}%`}</Text>
              <Text style={styles.rewardStatLabel}>goal</Text>
            </View>
            <View style={styles.rewardStat}>
              <Text style={styles.rewardStatValue}>{formatDuration(reward.durationMs)}</Text>
              <Text style={styles.rewardStatLabel}>time</Text>
            </View>
          </View>
          <Text style={styles.rewardDismiss}>Tap to continue</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  rewardOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    paddingHorizontal: 26,
    zIndex: 50,
  },
  rewardGlow: {
    backgroundColor: COLORS.challenge,
    borderRadius: 170,
    height: 340,
    opacity: 0.24,
    position: 'absolute',
    width: 340,
  },
  rewardCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 2,
    gap: 8,
    maxWidth: 360,
    paddingHorizontal: 26,
    paddingVertical: 28,
    shadowColor: COLORS.challenge,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    width: '100%',
  },
  rewardIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.challenge,
    borderRadius: 38,
    height: 76,
    justifyContent: 'center',
    marginBottom: 4,
    width: 76,
  },
  rewardEyebrow: {
    color: COLORS.challenge,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  rewardSteps: {
    color: COLORS.challenge,
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 0,
  },
  rewardLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  rewardStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  rewardStat: {
    alignItems: 'center',
    backgroundColor: COLORS.challengeSoft,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  rewardStatValue: {
    color: COLORS.challenge,
    fontSize: 18,
    fontWeight: '900',
  },
  rewardStatLabel: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  rewardDismiss: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
    textTransform: 'uppercase',
  },
});
