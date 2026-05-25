import { Platform } from 'react-native';

import { SystemStepResult } from './types';

type HealthConnectPermission = {
  accessType: 'read' | 'write';
  recordType: 'Steps';
};

type HealthConnectModule = typeof import('react-native-health-connect');

const READ_STEPS_PERMISSION: HealthConnectPermission = {
  accessType: 'read',
  recordType: 'Steps',
};

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

const hasReadStepsPermission = (permissions: HealthConnectPermission[]): boolean =>
  permissions.some((permission) => permission.accessType === 'read' && permission.recordType === 'Steps');

let readyHealthConnectPromise: Promise<HealthConnectModule | null> | null = null;

export const readTodayStepsFromHealthConnect = async (): Promise<SystemStepResult> => {
  const today = getStartOfToday();
  const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return readStepsForDateFromHealthConnect(dateString);
};

export const readStepsForDateFromHealthConnect = async (dateString: string): Promise<SystemStepResult> => {
  const results = await readStepsForDatesFromHealthConnect([dateString]);
  return results[dateString] ?? {
    available: false,
    reason: 'Health Connect read failed.',
    source: 'unavailable',
  };
};

export const readStepsForDatesFromHealthConnect = async (dateStrings: string[]): Promise<Record<string, SystemStepResult>> => {
  if (Platform.OS !== 'android') {
    return toUnavailableResults(dateStrings, {
      available: false,
      reason: 'Health Connect is Android only.',
      source: 'unavailable',
    });
  }

  try {
    const healthConnect = await getReadyHealthConnect();

    if (healthConnect === null) {
      return toUnavailableResults(dateStrings, {
        available: false,
        reason: 'Health Connect is unavailable or steps permission was not granted.',
        source: 'unavailable',
      });
    }

    const entries = await Promise.all(dateStrings.map(async (dateString): Promise<[string, SystemStepResult]> => {
      const { end, start } = getLocalDateRange(dateString);
      const result = await healthConnect.aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });

      return [dateString, {
        available: true,
        source: 'health-connect',
        steps: Math.max(0, Math.floor(result.COUNT_TOTAL ?? 0)),
      }];
    }));

    return Object.fromEntries(entries);
  } catch (error) {
    console.warn('Unable to read steps from Health Connect.', error);
    return toUnavailableResults(dateStrings, {
      available: false,
      reason: 'Health Connect read failed.',
      source: 'unavailable',
    });
  }
};

const getReadyHealthConnect = async (): Promise<HealthConnectModule | null> => {
  readyHealthConnectPromise ??= initializeHealthConnect();
  const healthConnect = await readyHealthConnectPromise;

  if (healthConnect === null) {
    readyHealthConnectPromise = null;
  }

  return healthConnect;
};

const initializeHealthConnect = async (): Promise<HealthConnectModule | null> => {
  const healthConnect = await import('react-native-health-connect');
  const status = await healthConnect.getSdkStatus();

  if (status !== healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE) {
    return null;
  }

  const initialized = await healthConnect.initialize();
  if (!initialized) {
    return null;
  }

  const grantedPermissions = await healthConnect.requestPermission([READ_STEPS_PERMISSION]);
  if (!hasReadStepsPermission(grantedPermissions as HealthConnectPermission[])) {
    return null;
  }

  return healthConnect;
};

const toUnavailableResults = (
  dateStrings: string[],
  result: Extract<SystemStepResult, { available: false }>,
): Record<string, SystemStepResult> =>
  Object.fromEntries(dateStrings.map((dateString) => [dateString, result]));
