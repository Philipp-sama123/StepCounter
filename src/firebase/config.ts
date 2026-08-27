import * as FirebaseAuth from '@firebase/auth';
import { getAuth, initializeAuth } from '@firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

import type { Auth, Persistence } from '@firebase/auth';
import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';

const firebaseEnv = {
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const firebaseConfig = {
  apiKey: firebaseEnv.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: firebaseEnv.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseEnv.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: firebaseEnv.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: firebaseEnv.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: firebaseEnv.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const missingFirebaseConfigKeys = Object.entries(firebaseEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const isFirebaseConfigured = missingFirebaseConfigKeys.length === 0;

export const firebaseApp: FirebaseApp | null = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

const getReactNativePersistence = (
  FirebaseAuth as typeof FirebaseAuth & {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
  }
).getReactNativePersistence;

const getFirebaseAuth = (app: FirebaseApp): Auth => {
  try {
    if (getReactNativePersistence === undefined) {
      throw new Error('React Native Firebase auth persistence export is unavailable.');
    }

    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    console.warn('Firebase auth persistence unavailable. Falling back to memory persistence.', error);
    return getAuth(app);
  }
};

export const firebaseAuth: Auth | null = firebaseApp === null ? null : getFirebaseAuth(firebaseApp);
export const firestore: Firestore | null = firebaseApp === null ? null : getFirestore(firebaseApp);
