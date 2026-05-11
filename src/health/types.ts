export type StepDataSource = 'apple-health' | 'health-connect' | 'live-sensor' | 'unavailable';

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
