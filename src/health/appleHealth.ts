import { Platform } from 'react-native';

import { SystemStepResult } from './types';

const getStartOfToday = (): Date => getStartOfLocalDate(new Date());

const getStartOfLocalDate = (date: Date): Date => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getLocalDateRange = (dateString: string): { end: Date; start: Date } => {
  const [year, month, day] = dateString.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const nextDay = new Date(start);
  nextDay.setDate(start.getDate() + 1);
  const todayStart = getStartOfToday();

  return {
    end: start.getTime() === todayStart.getTime() ? new Date() : nextDay,
    start,
  };
};

export const readTodayStepsFromAppleHealth = async (): Promise<SystemStepResult> => {
  const today = getStartOfToday();
  const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return readStepsForDateFromAppleHealth(dateString);
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
    const result = await healthKit.queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      {
        filter: {
          date: {
            startDate: start,
            endDate: end,
          },
        },
        unit: 'count',
      },
    );

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
