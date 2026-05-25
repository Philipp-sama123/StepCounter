import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { COLORS, THEME } from '../../constants';

type SurfacePanelProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'primary' | 'warning';
};

export const SurfacePanel = ({ children, style, tone = 'default' }: SurfacePanelProps) => (
  <View style={[styles.panel, styles[tone], style]}>{children}</View>
);

const styles = StyleSheet.create({
  panel: {
    borderRadius: THEME.radius.panel,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  default: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  primary: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  warning: {
    backgroundColor: COLORS.challengeSoft,
    borderColor: COLORS.challenge,
  },
});
