import {
  CHALLENGE_SESSION_KEY_PREFIX,
  DEFAULT_GOAL,
  LAST_SEVEN_DAYS,
  STEP_HISTORY_KEY_PREFIX,
  STORAGE_KEYS,
} from '../constants';
import { isChallengeSession } from '../features/challenges/domain/models';
import { userScopedStorage as AsyncStorage } from '../platform/storage/userScopedStorage';
import { getRecentDateStrings, parseLocalDate } from '../shared/date/localDate';
import { parseJsonArray } from '../shared/validation/json';

import type { ChallengeSession } from '../features/challenges/domain/models';
import type { StepHistoryEntry } from '../features/steps/domain/models';

export type { ChallengeSession } from '../features/challenges/domain/models';
export type { StepHistoryEntry } from '../features/steps/domain/models';

export type StepCounterState = {
  baseline: number;
  lastDate: string | null;
};

export { getTodayString } from '../shared/date/localDate';

const parseStoredNumber = (value: string | null, fallback: number): number => {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getHistoryKey = (date: string): string => `${STEP_HISTORY_KEY_PREFIX}${date}`;

export const readStepCounterState = async (): Promise<StepCounterState> => {
  try {
    const [baselineValue, lastDate] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.baseline),
      AsyncStorage.getItem(STORAGE_KEYS.lastDate),
    ]);

    return {
      baseline: parseStoredNumber(baselineValue, 0),
      lastDate,
    };
  } catch (error) {
    console.warn('Unable to read step counter state.', error);
    return {
      baseline: 0,
      lastDate: null,
    };
  }
};

export const saveStepCounterState = async (baseline: number, lastDate: string): Promise<void> => {
  try {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.baseline, String(Math.max(0, Math.floor(baseline)))],
      [STORAGE_KEYS.lastDate, lastDate],
    ]);
  } catch (error) {
    console.warn('Unable to save step counter state.', error);
  }
};

export const saveStepsForDate = async (date: string, steps: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(getHistoryKey(date), String(Math.max(0, Math.floor(steps))));
  } catch (error) {
    console.warn(`Unable to save steps for ${date}.`, error);
  }
};

export const readStepsForDate = async (date: string): Promise<number> => {
  try {
    const value = await AsyncStorage.getItem(getHistoryKey(date));
    return parseStoredNumber(value, 0);
  } catch (error) {
    console.warn(`Unable to read steps for ${date}.`, error);
    return 0;
  }
};

export const readGoal = async (): Promise<number> => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.goal);
    return parseStoredNumber(value, DEFAULT_GOAL);
  } catch (error) {
    console.warn('Unable to read goal.', error);
    return DEFAULT_GOAL;
  }
};

export const saveGoal = async (goal: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.goal, String(Math.max(1, Math.floor(goal))));
  } catch (error) {
    console.warn('Unable to save goal.', error);
  }
};

export const readChallengeGoal = async (): Promise<number> => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.challengeGoal);
    return parseStoredNumber(value, DEFAULT_GOAL);
  } catch (error) {
    console.warn('Unable to read challenge goal.', error);
    return DEFAULT_GOAL;
  }
};

export const saveChallengeGoal = async (goal: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.challengeGoal, String(Math.max(1, Math.floor(goal))));
  } catch (error) {
    console.warn('Unable to save challenge goal.', error);
  }
};

export const readDailyChallengeGoal = async (): Promise<number> => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.dailyChallengeGoal);
    return parseStoredNumber(value, DEFAULT_GOAL);
  } catch (error) {
    console.warn('Unable to read daily challenge goal.', error);
    return DEFAULT_GOAL;
  }
};

export const saveDailyChallengeGoal = async (goal: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.dailyChallengeGoal, String(Math.max(1, Math.floor(goal))));
  } catch (error) {
    console.warn('Unable to save daily challenge goal.', error);
  }
};

export const readRecentDays = async (dayCount: number): Promise<StepHistoryEntry[]> => {
  const dates = getRecentDateStrings(dayCount);

  try {
    const values = await AsyncStorage.multiGet(dates.map(getHistoryKey));

    return dates.map((date, index) => {
      const steps = parseStoredNumber(values[index]?.[1] ?? null, 0);
      const dayName = parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' });

      return {
        date,
        dayName,
        steps,
      };
    });
  } catch (error) {
    console.warn('Unable to read step history.', error);
    return dates.map((date) => ({
      date,
      dayName: parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' }),
      steps: 0,
    }));
  }
};

export const readLastSevenDays = async (): Promise<StepHistoryEntry[]> => readRecentDays(LAST_SEVEN_DAYS);

export const getChallengeKey = (date: string): string => `${CHALLENGE_SESSION_KEY_PREFIX}${date}`;

export const saveChallengeSession = async (date: string, session: ChallengeSession): Promise<void> => {
  try {
    const key = getChallengeKey(date);
    const existing = await AsyncStorage.getItem(key);
    const arr = parseJsonArray(existing, isChallengeSession);
    arr.push(session);
    await AsyncStorage.setItem(key, JSON.stringify(arr));
  } catch (error) {
    console.warn(`Unable to save challenge session for ${date}.`, error);
  }
};

export const mergeChallengeSessionsForDate = async (date: string, sessions: ChallengeSession[]): Promise<void> => {
  try {
    const key = getChallengeKey(date);
    const existing = await AsyncStorage.getItem(key);
    const storedSessions = parseJsonArray(existing, isChallengeSession);
    const sessionMap = new Map<string, ChallengeSession>();

    [...storedSessions, ...sessions].forEach((session) => {
      sessionMap.set(`${session.startedAt}-${session.endedAt}`, session);
    });

    await AsyncStorage.setItem(
      key,
      JSON.stringify(
        [...sessionMap.values()].sort(
          (left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime(),
        ),
      ),
    );
  } catch (error) {
    console.warn(`Unable to merge challenge sessions for ${date}.`, error);
  }
};

export const readChallengeSessions = async (date: string): Promise<ChallengeSession[]> => {
  try {
    const key = getChallengeKey(date);
    const raw = await AsyncStorage.getItem(key);
    return parseJsonArray(raw, isChallengeSession);
  } catch (error) {
    console.warn(`Unable to read challenge sessions for ${date}.`, error);
    return [];
  }
};

export const readRecentChallengeSessions = async (): Promise<(ChallengeSession & { date: string })[]> => {
  return readChallengeSessionsForRecentDays(LAST_SEVEN_DAYS);
};

export const readChallengeSessionsForRecentDays = async (
  dayCount: number,
): Promise<(ChallengeSession & { date: string })[]> => {
  const dates = getRecentDateStrings(dayCount);

  const sessionsByDate = await Promise.all(
    dates.map(async (date) => ({
      date,
      sessions: await readChallengeSessions(date),
    })),
  );

  return sessionsByDate
    .flatMap(({ date, sessions }) => sessions.map((session) => ({ ...session, date })))
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
};

export const readAllChallengeSessions = async (): Promise<(ChallengeSession & { date: string })[]> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const challengeKeys = keys
      .filter((key) => key.startsWith(CHALLENGE_SESSION_KEY_PREFIX))
      .sort()
      .reverse();
    const values = await AsyncStorage.multiGet(challengeKeys);

    return values
      .flatMap(([key, raw]) => {
        if (raw === null) {
          return [];
        }

        const date = key.replace(CHALLENGE_SESSION_KEY_PREFIX, '');
        const sessions = parseJsonArray(raw, isChallengeSession);
        return sessions.map((session) => ({ ...session, date }));
      })
      .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
  } catch (error) {
    console.warn('Unable to read all challenge sessions.', error);
    return [];
  }
};
