import { StyleSheet } from 'react-native';

import { COLORS } from '../../../constants';

export const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timelinePanel: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  timelineHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  timelineHint: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  timeline: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    minHeight: 132,
  },
  timelineColumn: {
    alignItems: 'center',
    gap: 7,
    width: 46,
  },
  timelineBarTrack: {
    backgroundColor: COLORS.challengeSoft,
    borderRadius: 8,
    height: 104,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%',
  },
  timelineBar: {
    backgroundColor: COLORS.challenge,
    borderRadius: 8,
    minHeight: 4,
    width: '100%',
  },
  timelineBarSelected: {
    backgroundColor: COLORS.action,
  },
  timelineLabel: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '800',
  },
  tooltip: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  tooltipTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  tooltipText: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  list: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  sessionRow: {
    minHeight: 88,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sessionDate: {
    width: 68,
    gap: 4,
  },
  sessionDay: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sessionTime: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '800',
  },
  sessionBody: {
    flex: 1,
    gap: 8,
  },
  sessionTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sessionSteps: {
    color: COLORS.challenge,
    fontSize: 17,
    fontWeight: '900',
  },
  sessionPace: {
    color: COLORS.action,
    fontSize: 13,
    fontWeight: '900',
  },
  sessionBarTrack: {
    height: 9,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: COLORS.challengeSoft,
  },
  sessionBarFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: COLORS.challenge,
  },
  sessionMeta: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    padding: 20,
    gap: 6,
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
});
