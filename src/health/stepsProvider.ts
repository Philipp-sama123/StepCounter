import { Platform } from 'react-native';

import { readTodayStepsFromAppleHealth } from './appleHealth';
import { readTodayStepsFromHealthConnect } from './healthConnect';
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
