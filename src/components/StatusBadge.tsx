import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants';
import { WalkingStatus } from '../hooks/useStepCounter';

type StatusBadgeProps = {
  status: WalkingStatus;
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  if (status === 'unknown') {
    return null;
  }

  const isWalking = status === 'walking';

  return (
    <View style={[styles.badge, isWalking ? styles.walkingBadge : styles.stoppedBadge]}>
      <View style={[styles.dot, isWalking ? styles.walkingDot : styles.stoppedDot]} />
      <Text style={[styles.text, isWalking ? styles.walkingText : styles.stoppedText]}>
        {isWalking ? 'Walking' : 'Stopped'}
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
});
