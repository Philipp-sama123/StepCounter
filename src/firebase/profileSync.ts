import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';

import { firestore } from './config';
import { FirestoreSyncResult } from './stepsSync';
import { getBmi, UserBodyProfile, WeightEntry } from '../storage/profileStorage';

export const syncBodyProfile = async (userId: string, profile: UserBodyProfile): Promise<FirestoreSyncResult> => {
  if (firestore === null) {
    return { message: 'Firestore is not configured.', ok: false };
  }

  try {
    await setDoc(
      doc(firestore, 'users', userId),
      {
        bmi: getBmi(profile.heightCm, profile.currentWeightKg),
        currentWeightKg: profile.currentWeightKg,
        heightCm: profile.heightCm,
        profileUpdatedAt: profile.updatedAt ?? new Date().toISOString(),
        updatedAt: serverTimestamp(),
        weightTrackingEnabled: profile.weightTrackingEnabled,
      },
      { merge: true },
    );

    return { message: 'Profile saved to Firestore.', ok: true };
  } catch (error) {
    console.warn('Unable to sync body profile to Firestore.', { userId, error });
    return { message: 'Could not save profile to Firestore.', ok: false };
  }
};

export const syncWeightEntry = async (userId: string, entry: WeightEntry): Promise<FirestoreSyncResult> => {
  if (firestore === null) {
    return { message: 'Firestore is not configured.', ok: false };
  }

  try {
    await setDoc(
      doc(firestore, 'users', userId, 'weights', entry.id),
      {
        date: entry.date,
        id: entry.id,
        timestamp: entry.timestamp,
        updatedAt: serverTimestamp(),
        weightKg: entry.weightKg,
      },
      { merge: true },
    );

    return { message: `Saved ${entry.weightKg.toLocaleString()} kg to Firestore.`, ok: true };
  } catch (error) {
    console.warn('Unable to sync weight entry to Firestore.', { userId, error });
    return { message: 'Could not save weight to Firestore.', ok: false };
  }
};

export const readBodyProfileFromFirestore = async (userId: string): Promise<UserBodyProfile | null> => {
  if (firestore === null) {
    return null;
  }

  try {
    const snapshot = await getDoc(doc(firestore, 'users', userId));
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    const currentWeightKg = typeof data.currentWeightKg === 'number' ? data.currentWeightKg : 0;
    const heightCm = typeof data.heightCm === 'number' ? data.heightCm : 0;

    return {
      currentWeightKg,
      heightCm,
      updatedAt: typeof data.profileUpdatedAt === 'string' ? data.profileUpdatedAt : undefined,
      weightTrackingEnabled: data.weightTrackingEnabled === true,
    };
  } catch (error) {
    console.warn('Unable to read body profile from Firestore.', { userId, error });
    return null;
  }
};

export const readWeightEntriesFromFirestore = async (userId: string): Promise<WeightEntry[]> => {
  if (firestore === null) {
    return [];
  }

  try {
    const snapshot = await getDocs(collection(firestore, 'users', userId, 'weights'));
    return snapshot.docs
      .map((weightDoc): WeightEntry | null => {
        const data = weightDoc.data();
        const date = typeof data.date === 'string' ? data.date : weightDoc.id;
        const timestamp = typeof data.timestamp === 'string' ? data.timestamp : new Date(`${date}T12:00:00`).toISOString();
        const weightKg = typeof data.weightKg === 'number' ? data.weightKg : 0;

        if (weightKg <= 0) {
          return null;
        }

        return {
          date,
          id: typeof data.id === 'string' ? data.id : weightDoc.id,
          timestamp,
          weightKg,
        };
      })
      .filter((entry): entry is WeightEntry => entry !== null)
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  } catch (error) {
    console.warn('Unable to read weight entries from Firestore.', { userId, error });
    return [];
  }
};
