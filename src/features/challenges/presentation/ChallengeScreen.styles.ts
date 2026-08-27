import { StyleSheet } from 'react-native';

import { COLORS } from '../../../constants';

export const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  modeTabs: {
    marginBottom: 18,
  },
  challengeAvatarPanel: {
    marginBottom: 18,
  },
  stepBlock: {
    alignItems: 'center',
    marginBottom: 8,
  },
  stepCount: {
    color: COLORS.action,
    fontSize: 48,
    fontWeight: 'bold',
  },
  sessionStepsPanel: {
    alignItems: 'center',
    backgroundColor: COLORS.challengeSoft,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 190,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sessionStepCount: {
    color: COLORS.challenge,
    fontSize: 46,
    fontWeight: 'bold',
  },
  sessionStepLabel: {
    color: COLORS.challenge,
    fontSize: 14,
    fontWeight: '800',
  },
  stepLabel: {
    color: COLORS.text,
    fontSize: 16,
  },
  goalText: {
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 6,
  },
  modeHint: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginBottom: 16,
    maxWidth: 310,
    textAlign: 'center',
  },
  goalButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  goalPill: {
    backgroundColor: COLORS.challengeSoft,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  goalPillText: {
    color: COLORS.challenge,
    fontSize: 12,
    fontWeight: '900',
  },
  statusRow: {
    marginBottom: 16,
  },
  unsupported: {
    color: COLORS.stopped,
    fontSize: 14,
    textAlign: 'center',
  },
  permissionContainer: {
    alignItems: 'center',
    gap: 12,
  },
  permissionButton: {
    alignItems: 'center',
    backgroundColor: COLORS.button,
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  permissionButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  refreshButton: {
    height: 40,
    minHeight: 40,
  },
  pressed: {
    opacity: 0.8,
  },
  goalBanner: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  goalBannerText: {
    color: COLORS.onAccent,
    fontSize: 14,
    fontWeight: '600',
  },
  challengeAction: {
    alignItems: 'center',
    marginTop: 12,
  },
  challengeButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  challengeStartButton: {
    backgroundColor: COLORS.button,
  },
  challengeStopButton: {
    backgroundColor: COLORS.danger,
  },
  challengeButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  historyPanel: {
    gap: 14,
  },
  historyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  historySubtitle: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 2,
  },
  historyGoal: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  historyMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyMetricCard: {
    flexGrow: 1,
    minHeight: 72,
    minWidth: '47%',
    width: undefined,
  },
  challengeGraphPanel: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  challengeGraphHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  challengeGraphTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },
  challengeGraphHint: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '800',
  },
  challengeGraph: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    minHeight: 134,
    paddingTop: 8,
  },
  challengeGraphColumn: {
    alignItems: 'center',
    gap: 6,
    width: 48,
  },
  challengeGraphTrack: {
    backgroundColor: COLORS.challengeSoft,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    height: 90,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%',
  },
  challengeGraphFill: {
    backgroundColor: COLORS.challenge,
    borderRadius: 7,
    minHeight: 5,
    width: '100%',
  },
  challengeGraphLabel: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '900',
  },
  challengeGraphValue: {
    color: COLORS.challenge,
    fontSize: 10,
    fontWeight: '900',
  },
  emptyGraphBar: {
    backgroundColor: COLORS.stoppedSoft,
    borderRadius: 8,
    height: 90,
    width: 48,
  },
  historyList: {
    gap: 10,
  },
  emptyHistory: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 14,
  },
  emptyHistoryTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
  },
  emptyHistoryText: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  historyRow: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  historyDateBlock: {
    width: 58,
  },
  historyDay: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
  },
  historyTime: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  historyBody: {
    flex: 1,
    gap: 7,
  },
  historyTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historySteps: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },
  historyPace: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  historyTrack: {
    backgroundColor: COLORS.border,
    borderRadius: 999,
    height: 9,
    overflow: 'hidden',
  },
  historyFill: {
    backgroundColor: COLORS.challenge,
    borderRadius: 999,
    height: '100%',
  },
  historyMeta: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '700',
  },
});
