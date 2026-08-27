import { LAST_SEVEN_DAYS } from '../constants';
import { userScopedStorage as AsyncStorage } from '../platform/storage/userScopedStorage';
import { getRecentDateStrings } from '../shared/date/localDate';

import type { StepHistoryEntry } from '../features/steps/domain/models';

const CALCULATED_STEP_HISTORY_KEY_PREFIX = 'calculated-steps:';

const getCalculatedStepsKey = (date: string): string => `${CALCULATED_STEP_HISTORY_KEY_PREFIX}${date}`;

const parseStoredNumber = (value: string | null): number => {
  if (value === null) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

export const readCalculatedStepsForDate = async (date: string): Promise<number> => {
  try {
    return parseStoredNumber(await AsyncStorage.getItem(getCalculatedStepsKey(date)));
  } catch (error) {
    console.warn(`Unable to read calculated steps for ${date}.`, error);
    return 0;
  }
};

export const saveCalculatedStepsForDate = async (date: string, steps: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(getCalculatedStepsKey(date), String(Math.max(0, Math.floor(steps))));
  } catch (error) {
    console.warn(`Unable to save calculated steps for ${date}.`, error);
  }
};

export const readCalculatedStepHistory = async (days = LAST_SEVEN_DAYS): Promise<StepHistoryEntry[]> => {
  const dates = getRecentDateStrings(days);

  try {
    const values = await AsyncStorage.multiGet(dates.map(getCalculatedStepsKey));

    return dates.map((date, index) => ({
      date,
      dayName: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }),
      steps: parseStoredNumber(values[index]?.[1] ?? null),
    }));
  } catch (error) {
    console.warn('Unable to read calculated step history.', error);
    return dates.map((date) => ({
      date,
      dayName: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }),
      steps: 0,
    }));
  }
};
