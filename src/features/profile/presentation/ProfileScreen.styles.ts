import { StyleSheet } from 'react-native';

import { COLORS } from '../../../constants';

export const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 13,
  },
  logoutText: {
    color: COLORS.onDanger,
    fontSize: 13,
    fontWeight: '900',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    minHeight: 86,
  },
  actionPanel: {
    gap: 10,
  },
});
