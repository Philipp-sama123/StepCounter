import { userScopedStorage as AsyncStorage } from '../platform/storage/userScopedStorage';
import { getRecentDateStrings, toLocalDateString } from '../shared/date/localDate';
import { isRecord, parseJsonArray } from '../shared/validation/json';

import type { UserBodyProfile, WeightEntry } from '../features/profile/domain/models';

export type { UserBodyProfile, WeightEntry } from '../features/profile/domain/models';

const BODY_PROFILE_KEY = 'profile:body';
const WEIGHT_HISTORY_KEY_PREFIX = 'weight:';
const WEIGHT_HISTORY_LIST_KEY = 'weight:entries';

const parseNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export const getBmi = (heightCm: number, weightKg: number): number => {
  if (heightCm <= 0 || weightKg <= 0) {
    return 0;
  }

  const heightMeters = heightCm / 100;
  return Math.round((weightKg / (heightMeters * heightMeters)) * 10) / 10;
};

export const readBodyProfile = async (): Promise<UserBodyProfile | null> => {
  try {
    const raw = await AsyncStorage.getItem(BODY_PROFILE_KEY);
    if (raw === null) {
      return null;
    }

    const data = JSON.parse(raw) as Partial<UserBodyProfile>;
    return {
      currentWeightKg: parseNumber(data.currentWeightKg),
      heightCm: parseNumber(data.heightCm),
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
      weightTrackingEnabled: data.weightTrackingEnabled === true,
    };
  } catch (error) {
    console.warn('Unable to read body profile.', error);
    return null;
  }
};

export const saveBodyProfile = async (profile: UserBodyProfile): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      BODY_PROFILE_KEY,
      JSON.stringify({
        ...profile,
        currentWeightKg: sanitizeBodyNumber(profile.currentWeightKg),
        heightCm: sanitizeBodyNumber(profile.heightCm),
        updatedAt: profile.updatedAt ?? new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.warn('Unable to save body profile.', error);
  }
};

export const saveWeightEntry = async (entry: WeightEntry): Promise<void> => {
  try {
    const entries = await readRecentWeightEntries(365);
    const nextEntry = normalizeWeightEntry(entry);
    const nextEntries = mergeWeightEntries(entries, [nextEntry]);
    await AsyncStorage.setItem(WEIGHT_HISTORY_LIST_KEY, JSON.stringify(nextEntries));
  } catch (error) {
    console.warn(`Unable to save weight for ${entry.timestamp}.`, error);
  }
};

export const readRecentWeightEntries = async (days = 30): Promise<WeightEntry[]> => {
  const dates = getRecentDateStrings(days);

  try {
    const storedEntries = await AsyncStorage.getItem(WEIGHT_HISTORY_LIST_KEY);
    const parsedEntries = parseJsonArray(storedEntries, (entry): entry is Partial<WeightEntry> => isRecord(entry));
    const normalizedEntries = parsedEntries.map(normalizeWeightEntry).filter((entry) => entry.weightKg > 0);

    if (normalizedEntries.length > 0) {
      return normalizedEntries
        .filter((entry) => dates.includes(entry.date))
        .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    }

    const legacyValues = await AsyncStorage.multiGet(dates.map(getWeightKey));
    return legacyValues
      .map(([, value], index) => {
        const weightKg = Number(value);
        if (!Number.isFinite(weightKg) || weightKg <= 0) {
          return null;
        }

        const timestamp = new Date(`${dates[index]}T12:00:00`).toISOString();
        return {
          date: dates[index],
          id: getWeightEntryId(timestamp),
          timestamp,
          weightKg,
        };
      })
      .filter((entry): entry is WeightEntry => entry !== null);
  } catch (error) {
    console.warn('Unable to read weight history.', error);
    return [];
  }
};

export const getLocalDateString = toLocalDateString;

export const createWeightEntry = (weightKg: number, timestamp = new Date().toISOString()): WeightEntry => ({
  date: getLocalDateString(new Date(timestamp)),
  id: getWeightEntryId(timestamp),
  timestamp,
  weightKg: sanitizeBodyNumber(weightKg),
});

const normalizeWeightEntry = (entry: Partial<WeightEntry>): WeightEntry => {
  const timestamp =
    typeof entry.timestamp === 'string'
      ? entry.timestamp
      : typeof entry.date === 'string'
        ? new Date(`${entry.date}T12:00:00`).toISOString()
        : new Date().toISOString();

  return {
    date: typeof entry.date === 'string' ? entry.date : getLocalDateString(new Date(timestamp)),
    id: typeof entry.id === 'string' ? entry.id : getWeightEntryId(timestamp),
    timestamp,
    weightKg: sanitizeBodyNumber(parseNumber(entry.weightKg)),
  };
};

const mergeWeightEntries = (localEntries: WeightEntry[], nextEntries: WeightEntry[]): WeightEntry[] => {
  const entriesById = new Map<string, WeightEntry>();
  [...localEntries, ...nextEntries].forEach((entry) => {
    entriesById.set(entry.id, entry);
  });

  return Array.from(entriesById.values()).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
};

const getWeightKey = (date: string): string => `${WEIGHT_HISTORY_KEY_PREFIX}${date}`;
const getWeightEntryId = (timestamp: string): string => timestamp.replace(/[^a-zA-Z0-9-]/g, '-');

const sanitizeBodyNumber = (value: number): number => Math.max(0, Math.round(value * 10) / 10);
