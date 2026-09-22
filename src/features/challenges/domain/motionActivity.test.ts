import { describe, expect, it } from 'vitest';

import { getAvatarStateForMotion, getCadenceStepsPerMinute, getStepActivity } from './motionActivity';

describe('motion activity', () => {
  it('maps detector states to avatar animations', () => {
    expect(getAvatarStateForMotion('idle')).toBe('idle');
    expect(getAvatarStateForMotion('moving')).toBe('move');
    expect(getAvatarStateForMotion('walking')).toBe('walk');
    expect(getAvatarStateForMotion('running')).toBe('run');
  });

  it('calculates cadence from step timestamps', () => {
    expect(getCadenceStepsPerMinute([0, 500, 1000])).toBe(120);
  });

  it('separates walking and running at the threshold', () => {
    expect(getStepActivity(144, 145)).toBe('walking');
    expect(getStepActivity(145, 145)).toBe('running');
  });
});
