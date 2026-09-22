import { StyleSheet } from 'react-native';

import { COLORS } from '../../../constants';

export const styles = StyleSheet.create({
  container: { gap: 20 },
  metricCard: { flexGrow: 1, minWidth: '46%', width: undefined },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  notice: { alignItems: 'center', flexDirection: 'row' },
  noticeCopy: { flex: 1 },
  noticeText: { color: COLORS.mutedText, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 3 },
  noticeTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900' },
  privacyNote: { color: COLORS.mutedText, fontSize: 11, fontWeight: '700', lineHeight: 16, textAlign: 'center' },
  rawPanel: { gap: 10 },
  sectionSubtitle: { color: COLORS.mutedText, fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  vectorLabel: { color: COLORS.mutedText, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  vectorRow: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  vectorValue: { color: COLORS.primary, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '800' },
});
