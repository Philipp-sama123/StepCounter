import { readTodayStepsFromSystemHealth } from '../health/stepsProvider';
import { SingleFlight } from '../shared/async/SingleFlight';
import { getTodayString, readGoal, readStepsForDate, saveStepsForDate } from '../storage/stepStorage';

import { syncDailyStepSnapshot } from './dailyStepSync';

import type { DailySyncSnapshot } from './dailyStepSync';
import type { StepDataSource } from '../health/types';

type SyncTodayParams = {
  fallbackSource?: StepDataSource;
  fallbackSteps?: number;
  userId: string | null;
};

const syncCoordinator = new SingleFlight<string>();

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

  return syncSnapshotAndBackfill(snapshot);
};

export const syncSnapshotAndBackfill = (
  snapshot: DailySyncSnapshot,
  options?: Parameters<typeof syncDailyStepSnapshot>[1],
): ReturnType<typeof syncDailyStepSnapshot> =>
  syncCoordinator.run(snapshot.userId ?? 'anonymous', () => syncDailyStepSnapshot(snapshot, options));
