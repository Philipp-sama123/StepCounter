export const DEFAULT_GOAL = 10000;

export const STORAGE_KEYS = {
  baseline: 'baseline',
  challengeGoal: 'challengeGoal',
  dailyChallengeGoal: 'dailyChallengeGoal',
  goal: 'goal',
  lastDate: 'lastDate',
} as const;

export const STEP_HISTORY_KEY_PREFIX = 'steps:';
export const CHALLENGE_SESSION_KEY_PREFIX = 'challenge:';

export const HOME_PROGRESS_RING_SIZE = 236;
export const HOME_PROGRESS_RING_WIDTH = 18;
export const HOME_PROGRESS_RING_PADDING = 10;
export const STATUS_STOPPED_DELAY_MS = 45000;
export const LAST_SEVEN_DAYS = 7;
export const MIN_GOAL = 1;
export const MAX_GOAL = 100000;
export const BAR_MAX_HEIGHT = 180;
export const BAR_MIN_HEIGHT = 8;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const COLORS = {
  background: '#111315',
  backgroundGradientEnd: '#4A525A',
  backgroundGradientMiddle: '#343A40',
  backgroundGradientStart: '#252A2E',
  surface: '#1A1D20',
  text: '#F3F7EF',
  mutedText: '#9DA9A0',
  border: '#26332A',
  primary: '#DDEED7',
  primarySoft: '#1C2A20',
  action: '#DDEED7',
  success: '#67D391',
  successSoft: '#17261D',
  challenge: '#2F8F46',
  challengeSoft: '#14321E',
  challengeText: '#DDEED7',
  ink: '#0B0F0D',
  modalBackdrop: 'rgba(0, 0, 0, 0.62)',
  onAccent: '#080D0A',
  onDanger: '#FFF7ED',
  overlay: 'rgba(0, 0, 0, 0.78)',
  overlaySoft: 'rgba(0, 0, 0, 0.62)',
  warning: '#7FCB74',
  stopped: '#6F7A72',
  stoppedSoft: '#1A221D',
  bar: '#DDEED7',
  barSoft: '#1C2A20',
  button: '#2A2E32',
  buttonBorder: '#3A3F44',
  danger: '#EF4444',
  avatarGradientStart: '#D9F7D0',
  avatarGradientMiddle: '#A7E594',
  avatarGradientEnd: '#63BD5B',
  progressOverflowStart: '#1F7A3A',
  progressOverflowEnd: '#0D4F27',
  progressOverflowSoft: '#14321E',
  progressDangerStart: '#EF4444',
  progressDangerEnd: '#7F1D1D',
} as const;

export const THEME = {
  color: {
    appBackground: COLORS.background,
    card: COLORS.surface,
    cardBorder: COLORS.border,
    danger: COLORS.danger,
    primary: COLORS.primary,
    primaryMuted: COLORS.primarySoft,
    primaryText: COLORS.text,
    secondaryText: COLORS.mutedText,
    success: COLORS.success,
    successMuted: COLORS.successSoft,
    warning: COLORS.warning,
    workout: COLORS.challenge,
    workoutMuted: COLORS.challengeSoft,
    tabActive: COLORS.primary,
    tabBackground: COLORS.surface,
    tabInactive: COLORS.mutedText,
    tabSelectedText: COLORS.text,
    tabText: COLORS.text,
  },
  radius: {
    control: 8,
    panel: 8,
    pill: 999,
  },
  spacing: {
    sectionGap: 18,
    screenBottom: 28,
    screenHorizontal: 24,
    screenTop: 18,
  },
} as const;
