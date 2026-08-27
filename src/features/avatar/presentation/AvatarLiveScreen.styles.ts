import { StyleSheet } from 'react-native';

import { COLORS } from '../../../constants';

import { AVATAR_SIZE, RING_SIZE } from './AvatarLiveScreen.layout';

export const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: COLORS.button,
    borderColor: COLORS.buttonBorder,
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  heroPanel: {
    gap: 18,
    padding: 16,
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  avatarName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '900',
  },
  avatarStatus: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
    textTransform: 'capitalize',
  },
  statePill: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 7,
    textTransform: 'uppercase',
  },
  idlePill: {
    backgroundColor: COLORS.stoppedSoft,
    color: COLORS.stopped,
  },
  walkPill: {
    backgroundColor: COLORS.challengeSoft,
    color: COLORS.challenge,
  },
  runPill: {
    backgroundColor: COLORS.danger,
    color: COLORS.onDanger,
  },
  avatarStage: {
    alignItems: 'center',
    height: RING_SIZE,
    justifyContent: 'center',
    width: '100%',
  },
  progressRing: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  avatarFrame: {
    alignItems: 'center',
    borderRadius: AVATAR_SIZE / 2,
    height: AVATAR_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
    width: AVATAR_SIZE,
  },
  spriteViewport: {
    height: AVATAR_SIZE,
    overflow: 'hidden',
    width: AVATAR_SIZE,
  },
  fallbackAvatar: {
    alignItems: 'center',
    borderRadius: AVATAR_SIZE / 2,
    height: AVATAR_SIZE,
    justifyContent: 'center',
    width: AVATAR_SIZE,
  },
  idleAvatar: {
    backgroundColor: COLORS.stoppedSoft,
  },
  walkAvatar: {
    backgroundColor: COLORS.challengeSoft,
  },
  runAvatar: {
    backgroundColor: COLORS.danger,
  },
  fallbackFace: {
    color: COLORS.text,
    fontSize: 86,
    fontWeight: '900',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 76,
    padding: 12,
  },
  metricLabel: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 7,
  },
  reasonPanel: {
    gap: 7,
  },
  reasonTitle: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  reasonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  reasonMeta: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  graphPanel: {
    gap: 12,
  },
  graphPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  graphPanelTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  graphPanelSubtitle: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  signalGraph: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  signalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  signalTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },
  signalValue: {
    color: COLORS.progressOverflowStart,
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '900',
  },
  signalBars: {
    alignItems: 'flex-end',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    height: 84,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingTop: 6,
    position: 'relative',
  },
  signalLimit: {
    backgroundColor: COLORS.progressDangerStart,
    height: 2,
    left: 0,
    opacity: 0.78,
    position: 'absolute',
    right: 0,
  },
  signalTimingMin: {
    backgroundColor: COLORS.progressOverflowStart,
  },
  signalBar: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    flex: 1,
    minWidth: 3,
  },
  signalBarPass: {
    backgroundColor: COLORS.progressOverflowStart,
  },
  signalBarFail: {
    backgroundColor: COLORS.progressDangerStart,
  },
  signalEmpty: {
    alignSelf: 'center',
    color: COLORS.mutedText,
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  signalLimitLabel: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
  },
  pickerPanel: {
    gap: 12,
  },
  pickerTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  avatarPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarOption: {
    alignItems: 'center',
    backgroundColor: COLORS.button,
    borderColor: COLORS.buttonBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minHeight: 42,
    minWidth: 86,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  avatarOptionSelected: {
    backgroundColor: COLORS.challenge,
    borderColor: COLORS.challenge,
  },
  avatarOptionText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },
  avatarOptionTextSelected: {
    color: COLORS.onDanger,
  },
});
