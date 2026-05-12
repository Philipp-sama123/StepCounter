import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';

import { firestore } from './config';
import { StepDataSource } from '../health/types';
import { ChallengeSession, StepHistoryEntry } from '../storage/stepStorage';

type SyncDailyStepsParams = {
  date: string;
  challengeSessionCount?: number;
  firstChallengeAt?: string | null;
  goal: number;
  lastChallengeAt?: string | null;
  paceStepsPerMinute?: number;
  source: StepDataSource;
  steps: number;
  walkingTimeMs?: number;
  userId: string;
};

export type FirestoreSyncResult = {
  message: string;
  ok: boolean;
};

export const syncDailySteps = async ({
  challengeSessionCount = 0,
  date,
  firstChallengeAt = null,
  goal,
  lastChallengeAt = null,
  paceStepsPerMinute = 0,
  source,
  steps,
  walkingTimeMs = 0,
  userId,
}: SyncDailyStepsParams): Promise<FirestoreSyncResult> => {
  if (firestore === null) {
    return { message: 'Firestore is not configured.', ok: false };
  }

  try {
    await setDoc(
      doc(firestore, 'users', userId, 'dailySteps', date),
      {
        date,
        challengeSessionCount,
        firstChallengeAt,
        goal,
        lastChallengeAt,
        paceStepsPerMinute: Math.max(0, Math.floor(paceStepsPerMinute)),
        progress: goal > 0 ? Math.min(1, Math.max(0, Math.floor(steps)) / goal) : 0,
        source,
        steps: Math.max(0, Math.floor(steps)),
        updatedAt: serverTimestamp(),
        walkingTimeMs: Math.max(0, Math.floor(walkingTimeMs)),
      },
      { merge: true },
    );
    return { message: `Saved ${Math.max(0, Math.floor(steps)).toLocaleString()} steps to Firestore.`, ok: true };
  } catch (error) {
    console.warn('Unable to sync daily steps to Firestore.', { date, userId, error });
    return { message: 'Could not save daily steps to Firestore.', ok: false };
  }
};

type SyncChallengeSessionParams = {
  date: string;
  session: ChallengeSession;
  source: StepDataSource;
  userId: string;
};

const getSessionId = (date: string, startedAt: string): string => `${date}_${startedAt.replace(/[^a-zA-Z0-9-]/g, '-')}`;

export const syncChallengeSession = async ({ date, session, source, userId }: SyncChallengeSessionParams): Promise<FirestoreSyncResult> => {
  if (firestore === null) {
    return { message: 'Firestore is not configured.', ok: false };
  }

  try {
    const paceStepsPerMinute = getSessionPace(session);
    await setDoc(
      doc(firestore, 'users', userId, 'challengeSessions', getSessionId(date, session.startedAt)),
      {
        date,
        durationMs: Math.max(0, Math.floor(session.durationMs)),
        endedAt: session.endedAt,
        paceStepsPerMinute,
        source,
        startedAt: session.startedAt,
        steps: Math.max(0, Math.floor(session.steps)),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return { message: `Saved challenge session with ${session.steps.toLocaleString()} steps.`, ok: true };
  } catch (error) {
    console.warn('Unable to sync challenge session to Firestore.', { date, userId, error });
    return { message: 'Could not save challenge session to Firestore.', ok: false };
  }
};

type FirestoreDailySteps = {
  challengeSessionCount?: number;
  firstChallengeAt?: string | null;
  goal?: number;
  lastChallengeAt?: string | null;
  paceStepsPerMinute?: number;
  source?: StepDataSource;
  steps: number;
  walkingTimeMs?: number;
};

export const readDailyStepsFromFirestore = async (userId: string, dates: string[]): Promise<Record<string, FirestoreDailySteps>> => {
  if (firestore === null) {
    return {};
  }

  try {
    const db = firestore;
    const snapshots = await Promise.all(dates.map((date) => getDoc(doc(db, 'users', userId, 'dailySteps', date))));

    return snapshots.reduce<Record<string, FirestoreDailySteps>>((result, snapshot, index) => {
      if (!snapshot.exists()) {
        return result;
      }

      const data = snapshot.data();
      const steps = typeof data.steps === 'number' ? data.steps : 0;
      const goal = typeof data.goal === 'number' ? data.goal : undefined;
      const source = isStepDataSource(data.source) ? data.source : undefined;
      result[dates[index]] = {
        challengeSessionCount: typeof data.challengeSessionCount === 'number' ? data.challengeSessionCount : undefined,
        firstChallengeAt: typeof data.firstChallengeAt === 'string' ? data.firstChallengeAt : null,
        goal,
        lastChallengeAt: typeof data.lastChallengeAt === 'string' ? data.lastChallengeAt : null,
        paceStepsPerMinute: typeof data.paceStepsPerMinute === 'number' ? data.paceStepsPerMinute : undefined,
        source,
        steps: Math.max(0, Math.floor(steps)),
        walkingTimeMs: typeof data.walkingTimeMs === 'number' ? data.walkingTimeMs : undefined,
      };
      return result;
    }, {});
  } catch (error) {
    console.warn('Unable to read daily steps from Firestore.', { userId, error });
    return {};
  }
};

export const readChallengeSessionSumsFromFirestore = async (userId: string, dates: string[]): Promise<Record<string, number>> => {
  if (firestore === null) {
    return {};
  }

  try {
    const dateSet = new Set(dates);
    const snapshot = await getDocs(collection(firestore, 'users', userId, 'challengeSessions'));

    return snapshot.docs.reduce<Record<string, number>>((result, sessionDoc) => {
      const data = sessionDoc.data();
      const date = typeof data.date === 'string' ? data.date : null;
      const steps = typeof data.steps === 'number' ? data.steps : 0;

      if (date === null || !dateSet.has(date)) {
        return result;
      }

      result[date] = (result[date] ?? 0) + Math.max(0, Math.floor(steps));
      return result;
    }, {});
  } catch (error) {
    console.warn('Unable to read challenge sessions from Firestore.', { userId, error });
    return {};
  }
};

export type StoredChallengeSession = ChallengeSession & {
  date: string;
  source?: StepDataSource;
};

export const readChallengeSessionsFromFirestore = async (userId: string): Promise<StoredChallengeSession[]> => {
  if (firestore === null) {
    return [];
  }

  try {
    const snapshot = await getDocs(collection(firestore, 'users', userId, 'challengeSessions'));

    return snapshot.docs
      .map((sessionDoc): StoredChallengeSession | null => {
        const data = sessionDoc.data();
        const date = typeof data.date === 'string' ? data.date : null;
        const startedAt = typeof data.startedAt === 'string' ? data.startedAt : null;
        const endedAt = typeof data.endedAt === 'string' ? data.endedAt : null;
        const durationMs = typeof data.durationMs === 'number' ? data.durationMs : null;
        const steps = typeof data.steps === 'number' ? data.steps : null;

        if (date === null || startedAt === null || endedAt === null || durationMs === null || steps === null) {
          return null;
        }

        return {
          date,
          durationMs: Math.max(0, Math.floor(durationMs)),
          endedAt,
          source: isStepDataSource(data.source) ? data.source : undefined,
          startedAt,
          steps: Math.max(0, Math.floor(steps)),
        };
      })
      .filter((session): session is StoredChallengeSession => session !== null)
      .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
  } catch (error) {
    console.warn('Unable to read challenge session list from Firestore.', { userId, error });
    return [];
  }
};

type SyncLocalStepDataParams = {
  entries: StepHistoryEntry[];
  goal: number;
  localSessionsByDate: Record<string, ChallengeSession[]>;
  userId: string;
};

export const syncLocalStepDataToFirestore = async ({ entries, goal, localSessionsByDate, userId }: SyncLocalStepDataParams): Promise<void> => {
  await Promise.all([
    ...entries.map((entry) => syncDailySteps({
      ...getDailyChallengeStats(localSessionsByDate[entry.date] ?? []),
      date: entry.date,
      goal,
      source: 'live-sensor',
      steps: entry.steps,
      userId,
    })),
    ...Object.entries(localSessionsByDate).flatMap(([date, sessions]) =>
      sessions.map((session) => syncChallengeSession({
        date,
        session,
        source: 'live-sensor',
        userId,
      })),
    ),
  ]);
};

const isStepDataSource = (value: unknown): value is StepDataSource =>
  value === 'apple-health' || value === 'health-connect' || value === 'live-sensor' || value === 'unavailable';

export const getDailyChallengeStats = (sessions: ChallengeSession[]) => {
  const walkingTimeMs = sessions.reduce((total, session) => total + Math.max(0, Math.floor(session.durationMs)), 0);
  const challengeSteps = sessions.reduce((total, session) => total + Math.max(0, Math.floor(session.steps)), 0);
  const sortedSessions = [...sessions].sort((left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime());

  return {
    challengeSessionCount: sessions.length,
    firstChallengeAt: sortedSessions[0]?.startedAt ?? null,
    lastChallengeAt: sortedSessions[sortedSessions.length - 1]?.endedAt ?? null,
    paceStepsPerMinute: walkingTimeMs > 0 ? Math.round(challengeSteps / (walkingTimeMs / 60000)) : 0,
    walkingTimeMs,
  };
};

const getSessionPace = (session: ChallengeSession): number => {
  const minutes = Math.max(1, session.durationMs / 60000);
  return Math.round(session.steps / minutes);
};
