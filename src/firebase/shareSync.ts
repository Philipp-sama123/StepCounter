import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';

import { isStepDataSource } from '../features/steps/domain/models';
import { getRecentDateStrings } from '../shared/date/localDate';

import { firestore } from './config';
import { readChallengeSessionsFromFirestore, readDailyStepsFromFirestore } from './stepsSync';

import type { StoredChallengeSession } from '../features/challenges/domain/models';
import type { StepDataSource } from '../health/types';

export type SharedDailyStepEntry = {
  challengeSessionCount?: number;
  date: string;
  goal?: number;
  paceStepsPerMinute?: number;
  source?: StepDataSource;
  steps: number;
  walkingTimeMs?: number;
};

export type SharedProfile = {
  code: string;
  displayName: string;
  ownerId: string;
};

export type SharedProfileData = SharedProfile & {
  dailySteps: SharedDailyStepEntry[];
  sessions: StoredChallengeSession[];
};

const SHARE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SHARE_DAYS = 14;

export const createShareCode = (): string =>
  Array.from({ length: 6 }, () => SHARE_CODE_ALPHABET[Math.floor(Math.random() * SHARE_CODE_ALPHABET.length)]).join('');

export const publishSharedProfile = async ({
  code,
  displayName,
  userId,
}: {
  code: string;
  displayName: string;
  userId: string;
}): Promise<{ code: string; ok: boolean; message: string }> => {
  if (firestore === null) {
    return { code, ok: false, message: 'Firestore is not configured.' };
  }

  try {
    const dates = getRecentDateStrings(SHARE_DAYS);
    const [dailyStepsByDate, sessions] = await Promise.all([
      readDailyStepsFromFirestore(userId, dates),
      readChallengeSessionsFromFirestore(userId),
    ]);
    const shareRef = doc(firestore, 'sharedProfiles', code);

    await setDoc(
      shareRef,
      {
        code,
        displayName,
        ownerId: userId,
        publishedAt: serverTimestamp(),
      },
      { merge: true },
    );

    await Promise.all([
      ...dates.map((date) => {
        const entry = dailyStepsByDate[date];
        return setDoc(
          doc(shareRef, 'dailySteps', date),
          {
            challengeSessionCount: entry?.challengeSessionCount ?? 0,
            date,
            goal: entry?.goal ?? 0,
            paceStepsPerMinute: entry?.paceStepsPerMinute ?? 0,
            source: entry?.source ?? 'unavailable',
            steps: entry?.steps ?? 0,
            walkingTimeMs: entry?.walkingTimeMs ?? 0,
          },
          { merge: true },
        );
      }),
      ...sessions.slice(0, 30).map((session) =>
        setDoc(
          doc(shareRef, 'challengeSessions', getSharedSessionId(session)),
          {
            challengeGoal: session.challengeGoal ?? null,
            date: session.date,
            durationMs: session.durationMs,
            endedAt: session.endedAt,
            source: session.source ?? 'live-sensor',
            startedAt: session.startedAt,
            steps: session.steps,
          },
          { merge: true },
        ),
      ),
    ]);

    return { code, ok: true, message: `Share code ${code} is ready.` };
  } catch (error) {
    console.warn('Unable to publish shared profile.', { code, userId, error });
    return { code, ok: false, message: 'Could not publish share data.' };
  }
};

export const readSharedProfile = async (code: string): Promise<SharedProfileData | null> => {
  if (firestore === null) {
    return null;
  }

  try {
    const shareRef = doc(firestore, 'sharedProfiles', code);
    const shareDoc = await getDoc(shareRef);
    if (!shareDoc.exists()) {
      return null;
    }

    const data = shareDoc.data();
    const ownerId = typeof data.ownerId === 'string' ? data.ownerId : null;
    const displayName = typeof data.displayName === 'string' ? data.displayName : 'Shared profile';
    if (ownerId === null) {
      return null;
    }

    const [dailySnapshot, sessionSnapshot] = await Promise.all([
      getDocs(collection(shareRef, 'dailySteps')),
      getDocs(collection(shareRef, 'challengeSessions')),
    ]);

    return {
      code,
      dailySteps: dailySnapshot.docs
        .map((dailyDoc): SharedDailyStepEntry | null => {
          const entry = dailyDoc.data();
          const date = typeof entry.date === 'string' ? entry.date : dailyDoc.id;
          const steps = typeof entry.steps === 'number' ? entry.steps : 0;
          return {
            challengeSessionCount:
              typeof entry.challengeSessionCount === 'number' ? entry.challengeSessionCount : undefined,
            date,
            goal: typeof entry.goal === 'number' ? entry.goal : undefined,
            paceStepsPerMinute: typeof entry.paceStepsPerMinute === 'number' ? entry.paceStepsPerMinute : undefined,
            source: isStepDataSource(entry.source) ? entry.source : undefined,
            steps: Math.max(0, Math.floor(steps)),
            walkingTimeMs: typeof entry.walkingTimeMs === 'number' ? entry.walkingTimeMs : undefined,
          };
        })
        .filter((entry): entry is SharedDailyStepEntry => entry !== null)
        .sort((left, right) => left.date.localeCompare(right.date)),
      displayName,
      ownerId,
      sessions: sessionSnapshot.docs
        .map((sessionDoc): StoredChallengeSession | null => {
          const session = sessionDoc.data();
          const date = typeof session.date === 'string' ? session.date : null;
          const startedAt = typeof session.startedAt === 'string' ? session.startedAt : null;
          const endedAt = typeof session.endedAt === 'string' ? session.endedAt : null;
          const durationMs = typeof session.durationMs === 'number' ? session.durationMs : null;
          const steps = typeof session.steps === 'number' ? session.steps : null;
          if (date === null || startedAt === null || endedAt === null || durationMs === null || steps === null) {
            return null;
          }

          return {
            challengeGoal: typeof session.challengeGoal === 'number' ? session.challengeGoal : undefined,
            date,
            durationMs: Math.max(0, Math.floor(durationMs)),
            endedAt,
            source: isStepDataSource(session.source) ? session.source : undefined,
            startedAt,
            steps: Math.max(0, Math.floor(steps)),
          };
        })
        .filter((session): session is StoredChallengeSession => session !== null)
        .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()),
    };
  } catch (error) {
    console.warn('Unable to read shared profile.', { code, error });
    return null;
  }
};

const getSharedSessionId = (session: StoredChallengeSession): string =>
  `${session.date}_${session.startedAt.replace(/[^a-zA-Z0-9-]/g, '-')}`;
