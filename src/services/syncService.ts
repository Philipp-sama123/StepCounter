import { readTodayStepsFromSystemHealth } from '../health/stepsProvider';
import { StepDataSource } from '../health/types';
import { getTodayString, readGoal, readStepsForDate, saveStepsForDate } from '../storage/stepStorage';
import { DailySyncSnapshot, syncDailyStepSnapshot } from './dailyStepSync';

type SyncTodayParams = {
  fallbackSource?: StepDataSource;
  fallbackSteps?: number;
  userId: string | null;
};

export const syncTodayAndBackfill = async ({
  fallbackSource = 'unavailable',
  fallbackSteps = 0,
  userId,
}: SyncTodayParams): Promise<{ changed: boolean; message: string; ok: boolean }> => {
  const [goal, localSteps, systemResult] = await Promise.all([
    readGoal(),
    readStepsForDate(getTodayString()),
    readTodayStepsFromSystemHealth(),
  ]);
  const snapshot: DailySyncSnapshot = systemResult.available
    ? {
      goal,
      source: systemResult.source,
      steps: systemResult.steps,
      userId,
    }
    : {
      goal,
      source: fallbackSource,
      steps: Math.max(localSteps, fallbackSteps),
      userId,
    };

  if (systemResult.available && systemResult.steps > 0) {
    await saveStepsForDate(getTodayString(), systemResult.steps);
  }

  return syncDailyStepSnapshot(snapshot);
};

export const syncSnapshotAndBackfill = syncDailyStepSnapshot;
