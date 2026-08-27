import { getDailyChallengeStats } from '../features/challenges/domain/challengeMetrics';
import { reconcileStepTotal } from '../features/steps/domain/stepReconciliation';
import { readDailyStepsFromFirestore, syncDailySteps } from '../firebase/stepsSync';
import { readStepsForDatesFromSystemHealth } from '../health/stepsProvider';
import { getRecentDateStrings } from '../shared/date/localDate';
import { getTodayString, readChallengeSessions, saveStepsForDate } from '../storage/stepStorage';

import { publishOwnSharedProfileSnapshot } from './sharedProfilePublish';
import { appendSyncDiagnostic } from './syncDiagnostics';

import type { StepDataSource } from '../health/types';

export type DailySyncSnapshot = {
  goal: number;
  source: StepDataSource;
  steps: number;
  userId: string | null;
};

type ComparableDailySteps = {
  challengeSessionCount: number;
  firstChallengeAt: string | null;
  goal: number;
  lastChallengeAt: string | null;
  paceStepsPerMinute: number;
  source: StepDataSource;
  steps: number;
  walkingTimeMs: number;
};

type SyncDailyStepSnapshotOptions = {
  backfillDays?: number;
  skipUnchanged?: boolean;
};

type ExistingDailySteps = Awaited<ReturnType<typeof readDailyStepsFromFirestore>>[string];
const DEFAULT_BACKFILL_DAYS = 30;

export const syncDailyStepSnapshot = async (
  snapshot: DailySyncSnapshot,
  options: SyncDailyStepSnapshotOptions = { backfillDays: DEFAULT_BACKFILL_DAYS, skipUnchanged: true },
): Promise<{ changed: boolean; message: string; ok: boolean }> => {
  if (snapshot.userId === null) {
    return { changed: false, message: 'Sign in before saving to Firestore.', ok: false };
  }

  const today = getTodayString();
  const sessions = await readChallengeSessions(today);
  const challengeStats = getDailyChallengeStats(sessions);
  const existingDailySteps = await readDailyStepsFromFirestore(snapshot.userId, [today]);
  const existing = existingDailySteps[today];
  const backfillResult = await backfillRecentDailySteps({
    days: options.backfillDays ?? DEFAULT_BACKFILL_DAYS,
    goal: snapshot.goal,
    userId: snapshot.userId,
  });

  if (snapshot.steps === 0) {
    if (backfillResult.changed > 0) {
      await publishOwnSharedProfileSnapshot({
        userId: snapshot.userId,
      });
      return {
        changed: true,
        message: `Backfilled ${backfillResult.changed} missing day${backfillResult.changed === 1 ? '' : 's'} from Health Connect.`,
        ok: true,
      };
    }

    await appendSyncDiagnostic({
      date: today,
      existingSteps: existing?.steps ?? null,
      finalSteps: existing?.steps ?? null,
      reason: 'today-zero-no-backfill',
      source: snapshot.source,
      status: 'skipped',
      systemSteps: 0,
    });
    return { changed: false, message: 'No Health Connect changes to save.', ok: true };
  }

  const bestTodaySteps = getBestStepTotal(existing, snapshot.steps);
  if (
    options.skipUnchanged !== false &&
    existing !== undefined &&
    hasNoDailyStepChanges(existing, {
      ...challengeStats,
      goal: snapshot.goal,
      source: snapshot.source,
      steps: bestTodaySteps,
    })
  ) {
    if (backfillResult.changed > 0) {
      await publishOwnSharedProfileSnapshot({
        userId: snapshot.userId,
      });
      return {
        changed: true,
        message: `Backfilled ${backfillResult.changed} missing day${backfillResult.changed === 1 ? '' : 's'} from Health Connect.`,
        ok: true,
      };
    }

    await appendSyncDiagnostic({
      date: today,
      existingSteps: existing.steps,
      finalSteps: bestTodaySteps,
      reason: 'today-unchanged',
      source: snapshot.source,
      status: 'skipped',
      systemSteps: snapshot.steps,
    });
    return { changed: false, message: 'No changes to save.', ok: true };
  }

  const result = await syncDailySteps({
    ...challengeStats,
    date: today,
    goal: snapshot.goal,
    source: snapshot.source,
    steps: bestTodaySteps,
    userId: snapshot.userId,
  });

  await appendSyncDiagnostic({
    date: today,
    existingSteps: existing?.steps ?? null,
    finalSteps: result.ok ? bestTodaySteps : (existing?.steps ?? null),
    reason: result.ok ? 'today-saved' : result.message,
    source: snapshot.source,
    status: result.ok ? 'changed' : 'failed',
    systemSteps: snapshot.steps,
  });

  if (result.ok) {
    await publishOwnSharedProfileSnapshot({
      userId: snapshot.userId,
    });
  }

  return {
    changed: result.ok,
    message: result.message,
    ok: result.ok,
  };
};

const backfillRecentDailySteps = async ({
  days,
  goal,
  userId,
}: {
  days: number;
  goal: number;
  userId: string;
}): Promise<{ changed: number; checked: number; failed: number }> => {
  const dates = getRecentDateStrings(days).filter((date) => date !== getTodayString());
  if (dates.length === 0) {
    return { changed: 0, checked: 0, failed: 0 };
  }

  const existingDailySteps = await readDailyStepsFromFirestore(userId, dates);
  const systemResults = await readStepsForDatesFromSystemHealth(dates);
  let changed = 0;
  let failed = 0;

  for (const date of dates) {
    try {
      const systemResult = systemResults[date];
      if (systemResult === undefined) {
        failed += 1;
        await appendSyncDiagnostic({
          date,
          existingSteps: existingDailySteps[date]?.steps ?? null,
          finalSteps: existingDailySteps[date]?.steps ?? null,
          reason: 'backfill-missing-system-result',
          source: 'unavailable',
          status: 'failed',
          systemSteps: null,
        });
        continue;
      }

      if (!systemResult.available || systemResult.steps === 0) {
        await appendSyncDiagnostic({
          date,
          existingSteps: existingDailySteps[date]?.steps ?? null,
          finalSteps: existingDailySteps[date]?.steps ?? null,
          reason: systemResult.available ? 'backfill-zero-system-steps' : systemResult.reason,
          source: systemResult.source,
          status: 'skipped',
          systemSteps: systemResult.available ? systemResult.steps : null,
        });
        continue;
      }

      const sessions = await readChallengeSessions(date);
      const challengeStats = getDailyChallengeStats(sessions);
      const existing = existingDailySteps[date];
      const nextComparable = {
        ...challengeStats,
        goal,
        source: systemResult.source,
        steps: systemResult.steps,
      };

      const steps = getBestStepTotal(existing, systemResult.steps);
      if (
        existing !== undefined &&
        hasNoDailyStepChanges(existing, {
          ...nextComparable,
          steps,
        })
      ) {
        await appendSyncDiagnostic({
          date,
          existingSteps: existing.steps,
          finalSteps: steps,
          reason: 'backfill-unchanged',
          source: systemResult.source,
          status: 'skipped',
          systemSteps: systemResult.steps,
        });
        continue;
      }

      await saveStepsForDate(date, steps);
      const result = await syncDailySteps({
        ...challengeStats,
        date,
        goal,
        source: systemResult.source,
        steps,
        userId,
      });

      if (result.ok) {
        changed += 1;
      } else {
        failed += 1;
      }
      await appendSyncDiagnostic({
        date,
        existingSteps: existing?.steps ?? null,
        finalSteps: result.ok ? steps : (existing?.steps ?? null),
        reason: result.ok ? 'backfill-saved' : result.message,
        source: systemResult.source,
        status: result.ok ? 'changed' : 'failed',
        systemSteps: systemResult.steps,
      });
    } catch (error) {
      failed += 1;
      console.warn('Unable to backfill daily Health Connect steps.', { date, error });
      await appendSyncDiagnostic({
        date,
        existingSteps: existingDailySteps[date]?.steps ?? null,
        finalSteps: existingDailySteps[date]?.steps ?? null,
        reason: 'backfill-error',
        source: 'unavailable',
        status: 'failed',
        systemSteps: null,
      });
    }
  }

  return {
    changed,
    checked: dates.length,
    failed,
  };
};

const getBestStepTotal = (existing: ExistingDailySteps | undefined, nextSteps: number): number =>
  reconcileStepTotal({ existingSteps: existing?.steps, incomingSteps: nextSteps });

const hasNoDailyStepChanges = (existing: ExistingDailySteps, next: ComparableDailySteps): boolean =>
  existing.steps === Math.max(0, Math.floor(next.steps)) &&
  (existing.goal ?? 0) === next.goal &&
  existing.source === next.source &&
  (existing.challengeSessionCount ?? 0) === next.challengeSessionCount &&
  (existing.firstChallengeAt ?? null) === next.firstChallengeAt &&
  (existing.lastChallengeAt ?? null) === next.lastChallengeAt &&
  (existing.paceStepsPerMinute ?? 0) === Math.max(0, Math.floor(next.paceStepsPerMinute)) &&
  (existing.walkingTimeMs ?? 0) === Math.max(0, Math.floor(next.walkingTimeMs));
