import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants';
import { WalkingStatus } from '../hooks/useStepCounter';

type StatusBadgeProps = {
  status: WalkingStatus;
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const isWalking = status === 'walking';
  const isUnknown = status === 'unknown';

  return (
    <View style={[styles.badge, isWalking ? styles.walkingBadge : isUnknown ? styles.unknownBadge : styles.stoppedBadge]}>
      <View style={[styles.dot, isWalking ? styles.walkingDot : isUnknown ? styles.unknownDot : styles.stoppedDot]} />
      <Text style={[styles.text, isWalking ? styles.walkingText : isUnknown ? styles.unknownText : styles.stoppedText]}>
        {isWalking ? 'Walking' : isUnknown ? 'No information' : 'Stopped'}
      </Text>
    </View>
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
  stoppedDot: {
    backgroundColor: COLORS.stopped,
  },
  unknownDot: {
    backgroundColor: COLORS.textSecondary,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
  },
  walkingText: {
    color: COLORS.success,
  },
  stoppedText: {
    color: COLORS.stopped,
  },
  unknownText: {
    color: COLORS.textSecondary,
  },
});
