export type StepDataSource = 'apple-health' | 'health-connect' | 'live-sensor' | 'unavailable';

export type StepTrackingMode = 'live' | 'system' | 'combined';

export type StepHistoryEntry = {
  date: string;
  dayName: string;
  steps: number;
};

export type SystemStepResult =
  | {
      available: true;
      source: Exclude<StepDataSource, 'live-sensor' | 'unavailable'>;
      steps: number;
    }
  | {
      available: false;
      reason: string;
      source: 'unavailable';
    };

export const isStepDataSource = (value: unknown): value is StepDataSource =>
  value === 'apple-health' || value === 'health-connect' || value === 'live-sensor' || value === 'unavailable';
