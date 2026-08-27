import { describe, expect, it } from 'vitest';

import { getDailyChallengeStats, getSessionPace } from './challengeMetrics';

describe('challenge metrics', () => {
  it('calculates session pace without dividing by zero', () => {
    expect(getSessionPace({ durationMs: 0, steps: 120 })).toBe(120);
    expect(getSessionPace({ durationMs: 120_000, steps: 240 })).toBe(120);
  });

  it('summarizes sessions in chronological order', () => {
    expect(
      getDailyChallengeStats([
        { durationMs: 60_000, endedAt: '2026-01-01T11:01:00Z', startedAt: '2026-01-01T11:00:00Z', steps: 100 },
        { durationMs: 60_000, endedAt: '2026-01-01T10:01:00Z', startedAt: '2026-01-01T10:00:00Z', steps: 100 },
      ]),
    ).toEqual({
      challengeSessionCount: 2,
      firstChallengeAt: '2026-01-01T10:00:00Z',
      lastChallengeAt: '2026-01-01T11:01:00Z',
      paceStepsPerMinute: 100,
      walkingTimeMs: 120_000,
    });
  });
});
