import type { StepDataSource } from '../health/types';

export const getStepSourceLabel = (source: StepDataSource): string => {
  if (source === 'apple-health') {
    return 'Apple Health';
  }

  if (source === 'health-connect') {
    return 'Health Connect';
  }

  if (source === 'live-sensor') {
    return 'Live sensor';
  }

  return 'Local';
};

export const getStepSourceSentenceLabel = (source: StepDataSource): string => {
  if (source === 'live-sensor') {
    return 'device sensors';
  }

  return getStepSourceLabel(source);
};
