import type { ChallengeSession } from './models';

export type DailyChallengeStats = {
  challengeSessionCount: number;
  firstChallengeAt: string | null;
  lastChallengeAt: string | null;
  paceStepsPerMinute: number;
  walkingTimeMs: number;
};

export const getSessionPace = (session: Pick<ChallengeSession, 'durationMs' | 'steps'>): number => {
  const minutes = Math.max(1, session.durationMs / 60_000);
  return Math.round(session.steps / minutes);
};

export const getDailyChallengeStats = (sessions: ChallengeSession[]): DailyChallengeStats => {
  const walkingTimeMs = sessions.reduce((total, session) => total + Math.max(0, Math.floor(session.durationMs)), 0);
  const challengeSteps = sessions.reduce((total, session) => total + Math.max(0, Math.floor(session.steps)), 0);
  const sortedSessions = [...sessions].sort(
    (left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime(),
  );

  return {
    challengeSessionCount: sessions.length,
    firstChallengeAt: sortedSessions[0]?.startedAt ?? null,
    lastChallengeAt: sortedSessions.at(-1)?.endedAt ?? null,
    paceStepsPerMinute: walkingTimeMs > 0 ? Math.round(challengeSteps / (walkingTimeMs / 60_000)) : 0,
    walkingTimeMs,
  };
};
