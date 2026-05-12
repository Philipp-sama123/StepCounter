import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserBodyProfile = {
  currentWeightKg: number;
  heightCm: number;
  updatedAt?: string;
  weightTrackingEnabled: boolean;
};

export type WeightEntry = {
  date: string;
  weightKg: number;
};

const BODY_PROFILE_KEY = 'profile:body';
const WEIGHT_HISTORY_KEY_PREFIX = 'weight:';

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
    await AsyncStorage.setItem(BODY_PROFILE_KEY, JSON.stringify({
      ...profile,
      currentWeightKg: sanitizeBodyNumber(profile.currentWeightKg),
      heightCm: sanitizeBodyNumber(profile.heightCm),
      updatedAt: profile.updatedAt ?? new Date().toISOString(),
    }));
  } catch (error) {
    console.warn('Unable to save body profile.', error);
  }
};

export const saveWeightEntry = async (entry: WeightEntry): Promise<void> => {
  try {
    await AsyncStorage.setItem(getWeightKey(entry.date), String(sanitizeBodyNumber(entry.weightKg)));
  } catch (error) {
    console.warn(`Unable to save weight for ${entry.date}.`, error);
  }
};

export const readRecentWeightEntries = async (days = 30): Promise<WeightEntry[]> => {
  const today = new Date(getLocalDateString(new Date()));
  const dates = Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getTime() - (days - 1 - index) * 24 * 60 * 60 * 1000);
    return getLocalDateString(date);
  });

  try {
    const values = await AsyncStorage.multiGet(dates.map(getWeightKey));
    return values
      .map(([key, value], index) => {
        const weightKg = Number(value);
        if (!Number.isFinite(weightKg) || weightKg <= 0) {
          return null;
        }

        return {
          date: dates[index],
          weightKg,
        };
      })
      .filter((entry): entry is WeightEntry => entry !== null);
  } catch (error) {
    console.warn('Unable to read weight history.', error);
    return [];
  }
};

export const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeightKey = (date: string): string => `${WEIGHT_HISTORY_KEY_PREFIX}${date}`;

const sanitizeBodyNumber = (value: number): number => Math.max(0, Math.round(value * 10) / 10);
