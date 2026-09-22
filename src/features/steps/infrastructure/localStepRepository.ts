/**
 * Local persistence boundary for the steps feature.
 *
 * The implementation currently delegates to the established storage module so
 * existing account-scoped keys and migrations remain untouched. New feature
 * code must import this repository instead of importing `storage/stepStorage`
 * directly.
 */
export {
  getTodayString,
  readGoal,
  readLastSevenDays,
  readRecentDays,
  readStepCounterState,
  readStepsForDate,
  saveGoal,
  saveStepCounterState,
  saveStepsForDate,
} from '../../../storage/stepStorage';

export type { StepCounterState } from '../../../storage/stepStorage';
