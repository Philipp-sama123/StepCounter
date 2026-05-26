import { Ionicons } from '@expo/vector-icons';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { COLORS, THEME } from '../../constants';
import { AnimatedPressable } from '../AnimatedPressable';

type HeaderIconButtonProps = {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'neutral' | 'challenge';
};

export const HeaderIconButton = ({
  accessibilityLabel,
  icon,
  onPress,
  style,
  variant = 'neutral',
}: HeaderIconButtonProps) => {
  const isChallenge = variant === 'challenge';

  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.button, isChallenge ? styles.challengeButton : styles.neutralButton, style]}
    >
      <Ionicons color={isChallenge ? COLORS.onAccent : COLORS.text} name={icon} size={22} />
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: THEME.radius.control,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  neutralButton: {
    backgroundColor: COLORS.surface,
  },
  challengeButton: {
    backgroundColor: COLORS.challenge,
  },
});
