import { describe, expect, it } from 'vitest';

import { getNewestProfile, mergeWeightEntries } from './profileService';

describe('profile reconciliation', () => {
  it('selects the most recently updated profile', () => {
    const older = { currentWeightKg: 70, heightCm: 175, updatedAt: '2026-01-01', weightTrackingEnabled: true };
    const newer = { ...older, currentWeightKg: 71, updatedAt: '2026-01-02' };
    expect(getNewestProfile(older, newer)).toEqual(newer);
  });

  it('deduplicates weight entries by id', () => {
    const local = { date: '2026-01-01', id: 'entry', timestamp: '2026-01-01T10:00:00Z', weightKg: 70 };
    const remote = { ...local, weightKg: 71 };
    expect(mergeWeightEntries([local], [remote])).toEqual([remote]);
  });
});
