import { describe, expect, it } from 'vitest';

import { normalizeStepCount, reconcileStepTotal } from './stepReconciliation';

describe('step reconciliation', () => {
  it('normalizes invalid and fractional totals', () => {
    expect(normalizeStepCount(-12)).toBe(0);
    expect(normalizeStepCount(Number.NaN)).toBe(0);
    expect(normalizeStepCount(42.9)).toBe(42);
  });

  it('preserves the existing highest-wins sync behavior', () => {
    expect(reconcileStepTotal({ existingSteps: 9_000, incomingSteps: 8_500 })).toBe(9_000);
    expect(reconcileStepTotal({ existingSteps: 9_000, incomingSteps: 9_500 })).toBe(9_500);
  });

  it('supports authoritative corrections as an explicit policy', () => {
    expect(
      reconcileStepTotal({
        existingSteps: 9_000,
        incomingSteps: 8_500,
        policy: 'incoming-authoritative',
      }),
    ).toBe(8_500);
  });
});
