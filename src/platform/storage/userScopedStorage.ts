import AsyncStorage from '@react-native-async-storage/async-storage';

import { getUserStoragePrefix, isLegacyUserStorageKey, scopeStorageKey, unscopeStorageKey } from './storageScope';

const LEGACY_OWNER_KEY = '@stepcounter/storage-owner-v1';
let activeUserId: string | null = null;

const getStorageKey = (key: string): string => (activeUserId === null ? key : scopeStorageKey(activeUserId, key));

export const activateUserStorage = async (userId: string): Promise<void> => {
  activeUserId = userId;

  try {
    const legacyOwner = await AsyncStorage.getItem(LEGACY_OWNER_KEY);
    if (legacyOwner !== null && legacyOwner !== userId) {
      return;
    }

    const allKeys = await AsyncStorage.getAllKeys();
    const legacyKeys = allKeys.filter(isLegacyUserStorageKey);
    if (legacyKeys.length > 0) {
      const legacyEntries = await AsyncStorage.multiGet(legacyKeys);
      const targetKeys = legacyKeys.map((key) => scopeStorageKey(userId, key));
      const existingTargets = new Map(await AsyncStorage.multiGet(targetKeys));
      const entriesToMigrate = legacyEntries.flatMap(([key, value]) => {
        if (value === null || existingTargets.get(scopeStorageKey(userId, key)) !== null) {
          return [];
        }
        return [[scopeStorageKey(userId, key), value] as [string, string]];
      });

      if (entriesToMigrate.length > 0) {
        await AsyncStorage.multiSet(entriesToMigrate);
      }
    }

    await AsyncStorage.setItem(LEGACY_OWNER_KEY, userId);
  } catch (error) {
    console.warn('Unable to migrate legacy user storage.', { error, userId });
  }
};

export const deactivateUserStorage = (): void => {
  activeUserId = null;
};

export const userScopedStorage = {
  getAllKeys: async (): Promise<readonly string[]> => {
    const keys = await AsyncStorage.getAllKeys();
    if (activeUserId === null) {
      return keys.filter(isLegacyUserStorageKey);
    }

    return keys.flatMap((key) => {
      const unscopedKey = unscopeStorageKey(activeUserId as string, key);
      return unscopedKey === null ? [] : [unscopedKey];
    });
  },
  getItem: (key: string): Promise<string | null> => AsyncStorage.getItem(getStorageKey(key)),
  multiGet: async (keys: readonly string[]): Promise<readonly [string, string | null][]> => {
    const entries = await AsyncStorage.multiGet(keys.map(getStorageKey));
    return entries.map(([, value], index) => [keys[index], value]);
  },
  multiRemove: (keys: readonly string[]): Promise<void> => AsyncStorage.multiRemove(keys.map(getStorageKey)),
  multiSet: (entries: readonly (readonly [string, string])[]): Promise<void> =>
    AsyncStorage.multiSet(entries.map(([key, value]) => [getStorageKey(key), value])),
  removeItem: (key: string): Promise<void> => AsyncStorage.removeItem(getStorageKey(key)),
  setItem: (key: string, value: string): Promise<void> => AsyncStorage.setItem(getStorageKey(key), value),
};

export const getActiveUserStoragePrefix = (): string | null =>
  activeUserId === null ? null : getUserStoragePrefix(activeUserId);
