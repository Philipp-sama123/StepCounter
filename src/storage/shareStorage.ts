import { userScopedStorage as AsyncStorage } from '../platform/storage/userScopedStorage';

const IMPORTED_SHARE_CODE_KEY = 'share:imported-code';
const IMPORTED_SHARE_PROFILES_KEY = 'share:imported-profiles';
const OWN_SHARE_CODE_KEY = 'share:own-code';
const SELECTED_IMPORTED_SHARE_CODE_KEY = 'share:selected-imported-code';

export type ImportedShareProfile = {
  code: string;
  displayName: string;
  importedAt: string;
};

const normalizeShareCode = (code: string): string =>
  code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

export const readImportedShareProfiles = async (): Promise<ImportedShareProfile[]> => {
  try {
    const [rawProfiles, legacyCode] = await Promise.all([
      AsyncStorage.getItem(IMPORTED_SHARE_PROFILES_KEY),
      AsyncStorage.getItem(IMPORTED_SHARE_CODE_KEY),
    ]);
    const parsedProfiles = rawProfiles === null ? [] : JSON.parse(rawProfiles);
    const profiles = Array.isArray(parsedProfiles)
      ? parsedProfiles
          .map((profile): ImportedShareProfile | null => {
            const code = typeof profile?.code === 'string' ? normalizeShareCode(profile.code) : '';
            const displayName =
              typeof profile?.displayName === 'string' && profile.displayName.trim().length > 0
                ? profile.displayName.trim()
                : code;
            const importedAt = typeof profile?.importedAt === 'string' ? profile.importedAt : new Date().toISOString();

            return code.length === 0 ? null : { code, displayName, importedAt };
          })
          .filter((profile): profile is ImportedShareProfile => profile !== null)
      : [];

    if (legacyCode !== null) {
      const normalizedLegacyCode = normalizeShareCode(legacyCode);
      if (normalizedLegacyCode.length > 0 && profiles.every((profile) => profile.code !== normalizedLegacyCode)) {
        profiles.push({
          code: normalizedLegacyCode,
          displayName: normalizedLegacyCode,
          importedAt: new Date().toISOString(),
        });
      }
    }

    return dedupeImportedProfiles(profiles);
  } catch (error) {
    console.warn('Unable to read imported share profiles.', error);
    return [];
  }
};

export const readImportedShareCode = async (): Promise<string | null> => {
  try {
    const [selectedCode, profiles] = await Promise.all([
      AsyncStorage.getItem(SELECTED_IMPORTED_SHARE_CODE_KEY),
      readImportedShareProfiles(),
    ]);
    const normalizedSelectedCode = selectedCode === null ? null : normalizeShareCode(selectedCode);
    if (normalizedSelectedCode !== null && profiles.some((profile) => profile.code === normalizedSelectedCode)) {
      return normalizedSelectedCode;
    }

    return profiles[0]?.code ?? null;
  } catch (error) {
    console.warn('Unable to read imported share code.', error);
    return null;
  }
};

export const saveImportedShareCode = async (code: string, displayName?: string): Promise<string> => {
  const normalizedCode = normalizeShareCode(code);
  const profiles = await readImportedShareProfiles();
  const nextProfiles = dedupeImportedProfiles([
    {
      code: normalizedCode,
      displayName: displayName?.trim() || normalizedCode,
      importedAt: new Date().toISOString(),
    },
    ...profiles,
  ]);

  await AsyncStorage.multiSet([
    [IMPORTED_SHARE_CODE_KEY, normalizedCode],
    [IMPORTED_SHARE_PROFILES_KEY, JSON.stringify(nextProfiles)],
    [SELECTED_IMPORTED_SHARE_CODE_KEY, normalizedCode],
  ]);
  return normalizedCode;
};

export const saveSelectedImportedShareCode = async (code: string): Promise<string> => {
  const normalizedCode = normalizeShareCode(code);
  await AsyncStorage.setItem(SELECTED_IMPORTED_SHARE_CODE_KEY, normalizedCode);
  return normalizedCode;
};

export const readOwnShareCode = async (): Promise<string | null> => {
  try {
    const code = await AsyncStorage.getItem(OWN_SHARE_CODE_KEY);
    return code === null ? null : normalizeShareCode(code);
  } catch (error) {
    console.warn('Unable to read own share code.', error);
    return null;
  }
};

export const saveOwnShareCode = async (code: string): Promise<string> => {
  const normalizedCode = normalizeShareCode(code);
  await AsyncStorage.setItem(OWN_SHARE_CODE_KEY, normalizedCode);
  return normalizedCode;
};

export const sanitizeShareCode = normalizeShareCode;

const dedupeImportedProfiles = (profiles: ImportedShareProfile[]): ImportedShareProfile[] => {
  const profilesByCode = new Map<string, ImportedShareProfile>();

  profiles.forEach((profile) => {
    if (!profilesByCode.has(profile.code)) {
      profilesByCode.set(profile.code, profile);
    }
  });

  return [...profilesByCode.values()].sort((left, right) => right.importedAt.localeCompare(left.importedAt));
};
