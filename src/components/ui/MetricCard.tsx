import { StyleSheet, Text, View } from 'react-native';

import { COLORS, THEME } from '../../constants';

import type { ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

type MetricCardProps = {
  children?: ReactNode;
  label: string;
  value: string;
  valueStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
};

export const MetricCard = ({ children, label, style, value, valueStyle }: MetricCardProps) => (
  <View style={[styles.card, style]}>
    <Text style={styles.label}>{label}</Text>
    {children ?? <Text style={[styles.value, valueStyle]}>{value}</Text>}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: THEME.radius.panel,
    borderWidth: 1,
    justifyContent: 'space-between',
    minHeight: 92,
    padding: 16,
    width: '48%',
  },
  label: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  value: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
  },
});
