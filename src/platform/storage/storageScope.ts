const USER_STORAGE_PREFIX = '@stepcounter/user/';

export const getUserStoragePrefix = (userId: string): string => `${USER_STORAGE_PREFIX}${userId}/`;

export const scopeStorageKey = (userId: string, key: string): string => `${getUserStoragePrefix(userId)}${key}`;

export const unscopeStorageKey = (userId: string, key: string): string | null => {
  const prefix = getUserStoragePrefix(userId);
  return key.startsWith(prefix) ? key.slice(prefix.length) : null;
};

const LEGACY_EXACT_KEYS = new Set([
  'baseline',
  'challengeGoal',
  'dailyChallengeGoal',
  'dashboard:avatar-visible',
  'debug:selected-avatar',
  'goal',
  'lastDate',
  'profile:body',
  'share:imported-code',
  'share:imported-profiles',
  'share:own-code',
  'share:selected-imported-code',
  'sync:diagnostics',
  'weight:entries',
]);

const LEGACY_KEY_PREFIXES = ['calculated-steps:', 'challenge:', 'steps:', 'wank:', 'weight:'];

export const isLegacyUserStorageKey = (key: string): boolean =>
  LEGACY_EXACT_KEYS.has(key) || LEGACY_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
