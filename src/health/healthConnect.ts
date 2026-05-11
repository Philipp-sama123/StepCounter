import { Platform } from 'react-native';

type HealthConnectPermission = {
  accessType: 'read' | 'write';
  recordType: 'Steps';
};

export type HealthConnectStepResult =
  | {
      available: true;
      steps: number;
    }
  | {
      available: false;
      reason: string;
    };

const READ_STEPS_PERMISSION: HealthConnectPermission = {
  accessType: 'read',
  recordType: 'Steps',
};

const getStartOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const hasReadStepsPermission = (permissions: HealthConnectPermission[]): boolean =>
  permissions.some((permission) => permission.accessType === 'read' && permission.recordType === 'Steps');

export const readTodayStepsFromHealthConnect = async (): Promise<HealthConnectStepResult> => {
  if (Platform.OS !== 'android') {
    return {
      available: false,
      reason: 'Health Connect is Android only.',
    };
  }

  try {
    const healthConnect = await import('react-native-health-connect');
    const status = await healthConnect.getSdkStatus();

    if (status !== healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE) {
      return {
        available: false,
        reason: 'Health Connect is not available on this device.',
      };
    }

    const initialized = await healthConnect.initialize();
    if (!initialized) {
      return {
        available: false,
        reason: 'Health Connect could not be initialized.',
      };
    }

    const grantedPermissions = await healthConnect.requestPermission([READ_STEPS_PERMISSION]);
    if (!hasReadStepsPermission(grantedPermissions as HealthConnectPermission[])) {
      return {
        available: false,
        reason: 'Health Connect steps permission was not granted.',
      };
    }

    const result = await healthConnect.aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: getStartOfToday().toISOString(),
        endTime: new Date().toISOString(),
      },
    });

    return {
      available: true,
      steps: Math.max(0, Math.floor(result.COUNT_TOTAL ?? 0)),
    };
  } catch (error) {
    console.warn('Unable to read steps from Health Connect.', error);
    return {
      available: false,
      reason: 'Health Connect read failed.',
    };
  }
};
