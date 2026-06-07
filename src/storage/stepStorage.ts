import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CHALLENGE_SESSION_KEY_PREFIX,
  DEFAULT_GOAL,
  LAST_SEVEN_DAYS,
  ONE_DAY_MS,
  STEP_HISTORY_KEY_PREFIX,
  STORAGE_KEYS,
  WANK_SESSION_KEY_PREFIX,
} from '../constants';
import { StepDataSource } from '../health/types';

const MAX_WANK_SESSIONS_PER_DAY = 20;
const MAX_WANK_SESSIONS_TOTAL = 120;

export type StepHistoryEntry = {
  date: string;
  dayName: string;
  steps: number;
};

export type StepCounterState = {
  baseline: number;
  lastDate: string | null;
};

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTodayString = (): string => toLocalDateString(new Date());

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
  const safeDayCount = Math.max(1, Math.floor(dayCount));
  const today = new Date(getTodayString());
  const dates = Array.from({ length: safeDayCount }, (_, index) => {
    const date = new Date(today.getTime() - (safeDayCount - 1 - index) * ONE_DAY_MS);
    return toLocalDateString(date);
  });

  try {
    const values = await AsyncStorage.multiGet(dates.map(getHistoryKey));

    return dates.map((date, index) => {
      const steps = parseStoredNumber(values[index]?.[1] ?? null, 0);
      const dayName = new Date(date).toLocaleDateString(undefined, { weekday: 'short' });

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
      dayName: new Date(date).toLocaleDateString(undefined, { weekday: 'short' }),
      steps: 0,
    }));
  }
};

export const readLastSevenDays = async (): Promise<StepHistoryEntry[]> => readRecentDays(LAST_SEVEN_DAYS);

export type ChallengeSession = {
  startedAt: string;
  endedAt: string;
  challengeGoal?: number;
  steps: number;
  durationMs: number;
  source?: StepDataSource;
};

export const getChallengeKey = (date: string): string => `${CHALLENGE_SESSION_KEY_PREFIX}${date}`;

export const saveChallengeSession = async (date: string, session: ChallengeSession): Promise<void> => {
  try {
    const key = getChallengeKey(date);
    const existing = await AsyncStorage.getItem(key);
    const arr: ChallengeSession[] = existing ? JSON.parse(existing) : [];
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
    const storedSessions: ChallengeSession[] = existing ? JSON.parse(existing) : [];
    const sessionMap = new Map<string, ChallengeSession>();

    [...storedSessions, ...sessions].forEach((session) => {
      sessionMap.set(`${session.startedAt}-${session.endedAt}`, session);
    });

    await AsyncStorage.setItem(
      key,
      JSON.stringify([...sessionMap.values()].sort((left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime())),
    );
  } catch (error) {
    console.warn(`Unable to merge challenge sessions for ${date}.`, error);
  }
};

export const readChallengeSessions = async (date: string): Promise<ChallengeSession[]> => {
  try {
    const key = getChallengeKey(date);
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ChallengeSession[]) : [];
  } catch (error) {
    console.warn(`Unable to read challenge sessions for ${date}.`, error);
    return [];
  }
};

export const readRecentChallengeSessions = async (): Promise<Array<ChallengeSession & { date: string }>> => {
  return readChallengeSessionsForRecentDays(LAST_SEVEN_DAYS);
};

export const readChallengeSessionsForRecentDays = async (dayCount: number): Promise<Array<ChallengeSession & { date: string }>> => {
  const safeDayCount = Math.max(1, Math.floor(dayCount));
  const today = new Date(getTodayString());
  const dates = Array.from({ length: safeDayCount }, (_, index) => {
    const date = new Date(today.getTime() - (safeDayCount - 1 - index) * ONE_DAY_MS);
    return toLocalDateString(date);
  });

  const sessionsByDate = await Promise.all(dates.map(async (date) => ({
    date,
    sessions: await readChallengeSessions(date),
  })));

  return sessionsByDate
    .flatMap(({ date, sessions }) => sessions.map((session) => ({ ...session, date })))
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
};

export const readAllChallengeSessions = async (): Promise<Array<ChallengeSession & { date: string }>> => {
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
        const sessions = JSON.parse(raw) as ChallengeSession[];
        return sessions.map((session) => ({ ...session, date }));
      })
      .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
  } catch (error) {
    console.warn('Unable to read all challenge sessions.', error);
    return [];
  }
};

export type WankSession = {
  averageMotionG: number;
  averageRotationRadPerSecond: number;
  bestCombo: number;
  durationMs: number;
  endedAt: string;
  replayEvents?: WankReplayEvent[];
  replaySamples?: WankReplaySample[];
  startedAt: string;
  swings: number;
};

export type WankReplayEvent = {
  combo: number;
  direction: 'down' | 'still' | 'up';
  motionG: number;
  offsetMs: number;
  rotationRadPerSecond: number;
  swingNumber: number;
};

export type WankReplaySample = {
  direction: 'down' | 'still' | 'up';
  motionG: number;
  offsetMs: number;
  passed: boolean;
  rotationRadPerSecond: number;
};

export const getWankSessionKey = (date: string): string => `${WANK_SESSION_KEY_PREFIX}${date}`;

export const saveWankSession = async (date: string, session: WankSession): Promise<void> => {
  try {
    const key = getWankSessionKey(date);
    const existing = await AsyncStorage.getItem(key);
    const sessions: WankSession[] = existing ? JSON.parse(existing) : [];
    sessions.push(session);
    await AsyncStorage.setItem(key, JSON.stringify(sortWankSessionsNewestFirst(sessions).slice(0, MAX_WANK_SESSIONS_PER_DAY)));
    await pruneWankSessionStorage();
  } catch (error) {
    console.warn(`Unable to save wank session for ${date}.`, error);
  }
};

export const readWankSessions = async (date: string): Promise<WankSession[]> => {
  try {
    const raw = await AsyncStorage.getItem(getWankSessionKey(date));
    return raw ? (JSON.parse(raw) as WankSession[]) : [];
  } catch (error) {
    console.warn(`Unable to read wank sessions for ${date}.`, error);
    return [];
  }
};

const pruneWankSessionStorage = async (): Promise<void> => {
  const keys = await AsyncStorage.getAllKeys();
  const wankKeys = keys.filter((key) => key.startsWith(WANK_SESSION_KEY_PREFIX));
  const values = await AsyncStorage.multiGet(wankKeys);
  const allSessions = values.flatMap(([key, raw]) => {
    if (raw === null) {
      return [];
    }

    const date = key.replace(WANK_SESSION_KEY_PREFIX, '');
    const sessions = JSON.parse(raw) as WankSession[];
    return sessions.map((session) => ({ ...session, date }));
  });
  const sessionsToKeep = sortWankSessionsNewestFirst(allSessions).slice(0, MAX_WANK_SESSIONS_TOTAL);
  const sessionsByDate = sessionsToKeep.reduce<Record<string, WankSession[]>>((result, sessionWithDate) => {
    const { date, ...session } = sessionWithDate;
    result[date] = [...(result[date] ?? []), session];
    return result;
  }, {});
  const nextDates = new Set(Object.keys(sessionsByDate));
  const keysToRemove = wankKeys.filter((key) => !nextDates.has(key.replace(WANK_SESSION_KEY_PREFIX, '')));
  const entriesToWrite = Object.entries(sessionsByDate).map(([sessionDate, sessions]) => [
    getWankSessionKey(sessionDate),
    JSON.stringify(sortWankSessionsNewestFirst(sessions).slice(0, MAX_WANK_SESSIONS_PER_DAY)),
  ] as [string, string]);

  await Promise.all([
    keysToRemove.length === 0 ? Promise.resolve() : AsyncStorage.multiRemove(keysToRemove),
    entriesToWrite.length === 0 ? Promise.resolve() : AsyncStorage.multiSet(entriesToWrite),
  ]);
};

const sortWankSessionsNewestFirst = <T extends Pick<WankSession, 'startedAt'>>(sessions: T[]): T[] =>
  [...sessions].sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());

export const readWankSessionsForRecentDays = async (dayCount: number): Promise<Array<WankSession & { date: string }>> => {
  const safeDayCount = Math.max(1, Math.floor(dayCount));
  const today = new Date(getTodayString());
  const dates = Array.from({ length: safeDayCount }, (_, index) => {
    const date = new Date(today.getTime() - (safeDayCount - 1 - index) * ONE_DAY_MS);
    return toLocalDateString(date);
  });

  const sessionsByDate = await Promise.all(dates.map(async (date) => ({
    date,
    sessions: await readWankSessions(date),
  })));

  return sessionsByDate
    .flatMap(({ date, sessions }) => sessions.map((session) => ({ ...session, date })))
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
};

export const readAllWankSessions = async (): Promise<Array<WankSession & { date: string }>> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const wankKeys = keys
      .filter((key) => key.startsWith(WANK_SESSION_KEY_PREFIX))
      .sort()
      .reverse();
    const values = await AsyncStorage.multiGet(wankKeys);

    return values
      .flatMap(([key, raw]) => {
        if (raw === null) {
          return [];
        }

        const date = key.replace(WANK_SESSION_KEY_PREFIX, '');
        const sessions = JSON.parse(raw) as WankSession[];
        return sessions.map((session) => ({ ...session, date }));
      })
      .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
  } catch (error) {
    console.warn('Unable to read all wank sessions.', error);
    return [];
  }
};
