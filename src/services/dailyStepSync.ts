import {
  getDailyChallengeStats,
  readDailyStepsFromFirestore,
  syncDailySteps,
} from '../firebase/stepsSync';
import { StepDataSource } from '../health/types';
import { getTodayString, readChallengeSessions } from '../storage/stepStorage';
import { publishOwnSharedProfileSnapshot } from './sharedProfilePublish';

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
  skipUnchanged?: boolean;
};

type ExistingDailySteps = Awaited<ReturnType<typeof readDailyStepsFromFirestore>>[string];

export const syncDailyStepSnapshot = async (
  snapshot: DailySyncSnapshot,
  options: SyncDailyStepSnapshotOptions = { skipUnchanged: true },
): Promise<{ changed: boolean; message: string; ok: boolean }> => {
  if (snapshot.userId === null) {
    return { changed: false, message: 'Sign in before saving to Firestore.', ok: false };
  }

  if (snapshot.steps === 0) {
    return { changed: false, message: 'No steps to save yet.', ok: false };
  }

  const today = getTodayString();
  const sessions = await readChallengeSessions(today);
  const challengeStats = getDailyChallengeStats(sessions);
  const existingDailySteps = await readDailyStepsFromFirestore(snapshot.userId, [today]);
  const existing = existingDailySteps[today];

  if (options.skipUnchanged !== false && existing !== undefined && hasNoDailyStepChanges(existing, {
    ...challengeStats,
    goal: snapshot.goal,
    source: snapshot.source,
    steps: snapshot.steps,
  })) {
    return { changed: false, message: 'No changes to save.', ok: true };
  }

  const result = await syncDailySteps({
    ...challengeStats,
    date: today,
    goal: snapshot.goal,
    source: snapshot.source,
    steps: snapshot.steps,
    userId: snapshot.userId,
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

const hasNoDailyStepChanges = (existing: ExistingDailySteps, next: ComparableDailySteps): boolean =>
  existing.steps === Math.max(0, Math.floor(next.steps))
  && (existing.goal ?? 0) === next.goal
  && existing.source === next.source
  && (existing.challengeSessionCount ?? 0) === next.challengeSessionCount
  && (existing.firstChallengeAt ?? null) === next.firstChallengeAt
  && (existing.lastChallengeAt ?? null) === next.lastChallengeAt
  && (existing.paceStepsPerMinute ?? 0) === Math.max(0, Math.floor(next.paceStepsPerMinute))
  && (existing.walkingTimeMs ?? 0) === Math.max(0, Math.floor(next.walkingTimeMs));
