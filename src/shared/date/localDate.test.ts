import { describe, expect, it } from 'vitest';

import { addLocalDays, getRecentDateStrings, parseLocalDate, toLocalDateString } from './localDate';

describe('local date utilities', () => {
  it('round trips calendar dates without UTC conversion', () => {
    expect(toLocalDateString(parseLocalDate('2026-08-26'))).toBe('2026-08-26');
  });

  it('uses calendar arithmetic across daylight-saving boundaries', () => {
    expect(addLocalDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addLocalDays('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('creates inclusive recent ranges', () => {
    expect(getRecentDateStrings(3, '2026-01-01')).toEqual(['2025-12-30', '2025-12-31', '2026-01-01']);
  });

  it('rejects malformed dates', () => {
    expect(() => parseLocalDate('2026-02-30')).toThrow('Invalid local date');
  });
});
