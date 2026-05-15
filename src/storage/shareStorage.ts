import AsyncStorage from '@react-native-async-storage/async-storage';

const IMPORTED_SHARE_CODE_KEY = 'share:imported-code';
const OWN_SHARE_CODE_KEY = 'share:own-code';

const normalizeShareCode = (code: string): string => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

export const readImportedShareCode = async (): Promise<string | null> => {
  try {
    const code = await AsyncStorage.getItem(IMPORTED_SHARE_CODE_KEY);
    return code === null ? null : normalizeShareCode(code);
  } catch (error) {
    console.warn('Unable to read imported share code.', error);
    return null;
  }
};

export const saveImportedShareCode = async (code: string): Promise<string> => {
  const normalizedCode = normalizeShareCode(code);
  await AsyncStorage.setItem(IMPORTED_SHARE_CODE_KEY, normalizedCode);
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
