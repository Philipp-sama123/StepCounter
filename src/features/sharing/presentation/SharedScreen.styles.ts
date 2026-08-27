import { StyleSheet } from 'react-native';

import { COLORS } from '../../../constants';

import { CHART_HEIGHT, HORIZONTAL_PADDING, POINT_WIDTH } from './SharedScreen.layout';

export const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: COLORS.challenge,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  codePanel: {
    backgroundColor: COLORS.challengeSoft,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  selectorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  codeLabel: {
    color: COLORS.challenge,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  codeValue: {
    color: COLORS.challenge,
    fontSize: 24,
    fontWeight: '900',
  },
  codeMeta: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },
  dropdownButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  dropdownButtonText: {
    color: COLORS.challenge,
    fontSize: 13,
    fontWeight: '900',
  },
  dropdownList: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownItem: {
    alignItems: 'center',
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownItemActive: {
    backgroundColor: COLORS.challengeSoft,
  },
  dropdownItemTextWrap: {
    flex: 1,
  },
  dropdownItemName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  dropdownItemCode: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chartPanel: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  chartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sectionMeta: {
    color: COLORS.challenge,
    fontSize: 12,
    fontWeight: '800',
  },
  legendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  legendDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  legendText: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  trendCanvas: {
    minHeight: 192,
  },
  svgWindow: {
    height: CHART_HEIGHT,
    overflow: 'hidden',
  },
  revealMask: {
    height: CHART_HEIGHT,
    overflow: 'hidden',
  },
  pointLayer: {
    height: CHART_HEIGHT,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  pointDot: {
    backgroundColor: COLORS.surface,
    borderRadius: 5,
    borderWidth: 3,
    height: 10,
    position: 'absolute',
    width: 10,
  },
  axis: {
    flexDirection: 'row',
    paddingHorizontal: HORIZONTAL_PADDING - 8,
  },
  axisItem: {
    alignItems: 'center',
    gap: 3,
    width: POINT_WIDTH,
  },
  axisDay: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '900',
  },
  axisValue: {
    color: COLORS.action,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  axisChallengeValue: {
    color: COLORS.challenge,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  graphEmpty: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  list: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sessionRow: {
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  sessionDay: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    width: 64,
  },
  sessionTime: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '800',
  },
  sessionBody: {
    flex: 1,
  },
  sessionSteps: {
    color: COLORS.challenge,
    fontSize: 16,
    fontWeight: '900',
  },
  sessionMeta: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyState: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 18,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  emptyListItem: {
    padding: 16,
  },
});
