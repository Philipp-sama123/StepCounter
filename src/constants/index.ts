export const DEFAULT_GOAL = 10000;

export const STORAGE_KEYS = {
  baseline: 'baseline',
  goal: 'goal',
  lastDate: 'lastDate',
} as const;

export const STEP_HISTORY_KEY_PREFIX = 'steps:';

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
  background: '#F7F9F6',
  surface: '#FFFFFF',
  text: '#17211B',
  mutedText: '#647067',
  border: '#DDE6DD',
  primary: '#216869',
  primarySoft: '#D9EFEC',
  success: '#2E8B57',
  successSoft: '#E2F5E9',
  warning: '#B45F06',
  stopped: '#8A938C',
  stoppedSoft: '#E8ECE9',
  bar: '#315F72',
  barSoft: '#D8E6EB',
  danger: '#A23B3B',
} as const;
