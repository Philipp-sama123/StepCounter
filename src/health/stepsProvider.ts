import { Platform } from 'react-native';

import { readStepsForDateFromAppleHealth, readTodayStepsFromAppleHealth } from './appleHealth';
import { readStepsForDateFromHealthConnect, readTodayStepsFromHealthConnect } from './healthConnect';
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
