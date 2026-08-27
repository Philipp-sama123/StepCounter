import { Platform } from 'react-native';

import { getLocalDateRange, getTodayString } from '../shared/date/localDate';

import type { SystemStepResult } from './types';

export const readTodayStepsFromAppleHealth = async (): Promise<SystemStepResult> => {
  return readStepsForDateFromAppleHealth(getTodayString());
};

export const readStepsForDateFromAppleHealth = async (dateString: string): Promise<SystemStepResult> => {
  if (Platform.OS !== 'ios') {
    return {
      available: false,
      reason: 'Apple Health is iOS only.',
      source: 'unavailable',
    };
  }

  try {
    const healthKit = await import('@kingstinct/react-native-healthkit');
    const isAvailable = await healthKit.isHealthDataAvailableAsync();

    if (!isAvailable) {
      return {
        available: false,
        reason: 'Apple Health is not available on this device.',
        source: 'unavailable',
      };
    }

    const granted = await healthKit.requestAuthorization({
      toRead: ['HKQuantityTypeIdentifierStepCount'],
    });

    if (!granted) {
      return {
        available: false,
        reason: 'Apple Health steps permission was not granted.',
        source: 'unavailable',
      };
    }

    const { end, start } = getLocalDateRange(dateString);
    const result = await healthKit.queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], {
      filter: {
        date: {
          startDate: start,
          endDate: end,
        },
      },
      unit: 'count',
    });

    return {
      available: true,
      source: 'apple-health',
      steps: Math.max(0, Math.floor(result.sumQuantity?.quantity ?? 0)),
    };
  } catch (error) {
    console.warn('Unable to read steps from Apple Health.', error);
    return {
      available: false,
      reason: 'Apple Health read failed.',
      source: 'unavailable',
    };
  }
};
