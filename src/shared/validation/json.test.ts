import { describe, expect, it } from 'vitest';

import { isRecord, parseJsonArray } from './json';

const isNamedRecord = (value: unknown): value is { name: string } => isRecord(value) && typeof value.name === 'string';

describe('JSON validation', () => {
  it('returns validated arrays', () => {
    expect(parseJsonArray('[{"name":"Ada"}]', isNamedRecord)).toEqual([{ name: 'Ada' }]);
  });

  it('rejects structurally invalid persisted data', () => {
    expect(() => parseJsonArray('{"name":"Ada"}', isNamedRecord)).toThrow(TypeError);
    expect(() => parseJsonArray('[{"name":42}]', isNamedRecord)).toThrow(TypeError);
  });
});
