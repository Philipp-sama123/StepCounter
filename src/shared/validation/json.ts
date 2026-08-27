export type TypeGuard<T> = (value: unknown) => value is T;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseJsonArray = <T>(raw: string | null, isItem: TypeGuard<T>): T[] => {
  if (raw === null) {
    return [];
  }

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(isItem)) {
    throw new TypeError('Stored value does not match the expected array schema.');
  }

  return parsed;
};
