import { readGoal, readRecentDays, saveStepsForDate } from '../infrastructure/localStepRepository';
import { readDailyStepsFromFirestore, syncDailySteps } from '../infrastructure/remoteStepsRepository';
import { readStepsForDatesFromSystemHealth } from '../infrastructure/systemStepsGateway';

import type { StepHistoryEntry } from '../domain/models';

export type StepHistorySource = 'device-health' | 'firestore' | 'local-cache' | 'merged';

export type StepHistorySnapshot = {
  entries: StepHistoryEntry[];
  goal: number;
  source: StepHistorySource;
};

const getSource = ({ hasRemote, hasSystem }: { hasRemote: boolean; hasSystem: boolean }): StepHistorySource => {
  if (hasRemote && hasSystem) {
    return 'merged';
  }

  if (hasSystem) {
    return 'device-health';
  }

  return hasRemote ? 'firestore' : 'local-cache';
};

/**
 * Reads one coherent history view and repairs the offline cache with the best
 * value available for each day. The reconciliation rule stays `highest-wins`
 * to preserve the app's existing data behaviour.
 */
export const loadStepHistory = async ({
  dayCount,
  userId,
}: {
  dayCount: number;
  userId: string | null;
}): Promise<StepHistorySnapshot> => {
  const [localEntries, goal] = await Promise.all([readRecentDays(dayCount), readGoal()]);
  const dates = localEntries.map((entry) => entry.date);
  const [remoteByDate, systemResults] = await Promise.all([
    userId === null
      ? Promise.resolve({} as Awaited<ReturnType<typeof readDailyStepsFromFirestore>>)
      : readDailyStepsFromFirestore(userId, dates),
    readStepsForDatesFromSystemHealth(dates),
  ]);

  const systemByDate = Object.entries(systemResults).reduce<Record<string, number>>((result, [date, systemResult]) => {
    if (systemResult.available && systemResult.steps > 0) {
      result[date] = systemResult.steps;
    }
    return result;
  }, {});
  const entries = localEntries.map((entry) => ({
    ...entry,
    steps: Math.max(entry.steps, remoteByDate[entry.date]?.steps ?? 0, systemByDate[entry.date] ?? 0),
  }));

  await Promise.all(entries.map((entry) => saveStepsForDate(entry.date, entry.steps)));

  if (userId !== null) {
    await Promise.all(
      entries.map((entry) =>
        syncDailySteps({
          date: entry.date,
          goal,
          source: 'live-sensor',
          steps: entry.steps,
          userId,
        }),
      ),
    );
  }

  return {
    entries,
    goal,
    source: getSource({
      hasRemote: Object.keys(remoteByDate).length > 0,
      hasSystem: Object.keys(systemByDate).length > 0,
    }),
  };
};
