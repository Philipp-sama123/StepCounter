import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { COLORS } from '../../constants';

type PageHeaderProps = {
  accessory?: ReactNode;
  subtitle?: string;
  title: string;
  style?: StyleProp<ViewStyle>;
};

export const PageHeader = ({ accessory, style, subtitle, title }: PageHeaderProps) => (
  <View style={[styles.header, style]}>
    <View style={styles.copy}>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <Text style={styles.title}>{title}</Text>
    </View>
    {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '900',
  },
  accessory: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
});
