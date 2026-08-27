import { describe, expect, it } from 'vitest';

import { formatClockDuration, formatLongDuration } from './metrics';

describe('metric formatting', () => {
  it('formats compact clock durations', () => {
    expect(formatClockDuration(61_999)).toBe('1:01');
    expect(formatClockDuration(-1)).toBe('0:00');
  });

  it('formats labeled durations using the nearest second', () => {
    expect(formatLongDuration(61_600)).toBe('1m 02s');
  });
});
