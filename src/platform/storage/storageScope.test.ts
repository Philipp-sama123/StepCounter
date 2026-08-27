import { describe, expect, it } from 'vitest';

import { isLegacyUserStorageKey, scopeStorageKey, unscopeStorageKey } from './storageScope';

describe('user storage scope', () => {
  it('round trips scoped keys', () => {
    const scoped = scopeStorageKey('user-123', 'steps:2026-08-26');
    expect(scoped).toBe('@stepcounter/user/user-123/steps:2026-08-26');
    expect(unscopeStorageKey('user-123', scoped)).toBe('steps:2026-08-26');
    expect(unscopeStorageKey('another-user', scoped)).toBeNull();
  });

  it('only migrates known application keys', () => {
    expect(isLegacyUserStorageKey('goal')).toBe(true);
    expect(isLegacyUserStorageKey('challenge:2026-08-26')).toBe(true);
    expect(isLegacyUserStorageKey('firebase:authUser:example')).toBe(false);
  });
});
