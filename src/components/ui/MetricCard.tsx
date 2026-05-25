import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { COLORS, THEME } from '../../constants';

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
    minHeight: 84,
    padding: 14,
    width: '48%',
  },
  label: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  value: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: '900',
  },
});
