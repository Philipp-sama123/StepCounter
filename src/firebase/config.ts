import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Auth, getAuth, initializeAuth, Persistence } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

export const firebaseApp: FirebaseApp | null = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

const asyncStoragePersistence = {
  type: 'LOCAL',
  async _isAvailable(): Promise<boolean> {
    try {
      const key = 'firebase:persistence-check';
      await AsyncStorage.setItem(key, '1');
      await AsyncStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
  _set(key: string, value: string): Promise<void> {
    return AsyncStorage.setItem(key, value);
  },
  _get(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  },
  _remove(key: string): Promise<void> {
    return AsyncStorage.removeItem(key);
  },
} as unknown as Persistence;

const getFirebaseAuth = (app: FirebaseApp): Auth => {
  try {
    return initializeAuth(app, {
      persistence: asyncStoragePersistence,
    });
  } catch {
    return getAuth(app);
  }
};

export const firebaseAuth: Auth | null = firebaseApp === null ? null : getFirebaseAuth(firebaseApp);
export const firestore: Firestore | null = firebaseApp === null ? null : getFirestore(firebaseApp);
