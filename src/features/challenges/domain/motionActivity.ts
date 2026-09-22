export type MotionActivityState = 'idle' | 'moving' | 'running' | 'walking';

export const getAvatarStateForMotion = (activity: MotionActivityState): 'idle' | 'move' | 'run' | 'walk' => {
  if (activity === 'moving') return 'move';
  if (activity === 'walking') return 'walk';
  if (activity === 'running') return 'run';
  return 'idle';
};

export const getCadenceStepsPerMinute = (timestamps: number[]): number => {
  if (timestamps.length < 2) return 0;
  const elapsedMinutes = (timestamps[timestamps.length - 1] - timestamps[0]) / 60000;
  return elapsedMinutes > 0 ? Math.round((timestamps.length - 1) / elapsedMinutes) : 0;
};

export const getStepActivity = (cadence: number, runningThreshold: number): MotionActivityState =>
  cadence >= runningThreshold ? 'running' : 'walking';
