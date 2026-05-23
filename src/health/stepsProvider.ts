import { Platform } from 'react-native';

import { readStepsForDateFromAppleHealth, readTodayStepsFromAppleHealth } from './appleHealth';
import { readStepsForDateFromHealthConnect, readStepsForDatesFromHealthConnect, readTodayStepsFromHealthConnect } from './healthConnect';
import { SystemStepResult } from './types';

export const readTodayStepsFromSystemHealth = async (): Promise<SystemStepResult> => {
  if (Platform.OS === 'ios') {
    return readTodayStepsFromAppleHealth();
  }

  if (Platform.OS === 'android') {
    return readTodayStepsFromHealthConnect();
  }

  return {
    available: false,
    reason: 'System health step data is not available on this platform.',
    source: 'unavailable',
  };
};

export const readStepsForDateFromSystemHealth = async (date: string): Promise<SystemStepResult> => {
  if (Platform.OS === 'ios') {
    return readStepsForDateFromAppleHealth(date);
  }

  if (Platform.OS === 'android') {
    return readStepsForDateFromHealthConnect(date);
  }

  return {
    available: false,
    reason: 'System health step data is not available on this platform.',
    source: 'unavailable',
  };
};

export const readStepsForDatesFromSystemHealth = async (dates: string[]): Promise<Record<string, SystemStepResult>> => {
  if (Platform.OS === 'android') {
    return readStepsForDatesFromHealthConnect(dates);
  }

  const entries = await Promise.all(dates.map(async (date) => [
    date,
    await readStepsForDateFromSystemHealth(date),
  ] as const));
  return Object.fromEntries(entries);
};
