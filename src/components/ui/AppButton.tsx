import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { COLORS, THEME } from '../../constants';
import { AnimatedPressable } from '../AnimatedPressable';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

type AppButtonVariant = 'danger' | 'primary' | 'secondary' | 'warning';

type AppButtonProps = {
  accessibilityLabel: string;
  busy?: boolean;
  children?: ReactNode;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: AppButtonVariant;
};

export const AppButton = ({
  accessibilityLabel,
  busy = false,
  children,
  disabled = false,
  icon,
  label,
  onPress,
  style,
  variant = 'primary',
}: AppButtonProps) => {
  const isSecondary = variant === 'secondary';
  const foregroundColor = variant === 'primary' ? COLORS.onAccent : COLORS.text;

  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        disabled || busy ? styles.disabled : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      {children ?? (
        <>
          {busy ? (
            <ActivityIndicator color={foregroundColor} />
          ) : icon ? (
            <Ionicons color={foregroundColor} name={icon} size={18} />
          ) : null}
          <Text style={[styles.label, isSecondary ? styles.secondaryLabel : null, { color: foregroundColor }]}>
            {busy ? getBusyLabel(label) : label}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
};

const getBusyLabel = (label: string): string => {
  if (label.toLowerCase().startsWith('save')) {
    return 'Saving';
  }

  if (label.toLowerCase().startsWith('sync')) {
    return 'Syncing';
  }

  if (label.toLowerCase().startsWith('refresh')) {
    return 'Refreshing';
  }

  return label;
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: THEME.radius.control,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.button,
    borderColor: COLORS.buttonBorder,
    borderWidth: 1,
  },
  warning: {
    backgroundColor: COLORS.challenge,
    borderColor: COLORS.success,
    borderWidth: 1,
  },
  danger: {
    backgroundColor: COLORS.danger,
  },
  disabled: {
    opacity: 0.82,
  },
  pressed: {
    opacity: 0.84,
  },
  label: {
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryLabel: {
    color: COLORS.text,
  },
});
