import {
  readBodyProfileFromFirestore,
  readWeightEntriesFromFirestore,
  syncBodyProfile,
  syncWeightEntry,
} from '../../../firebase/profileSync';
import {
  createWeightEntry,
  readBodyProfile,
  readRecentWeightEntries,
  saveBodyProfile,
  saveWeightEntry,
} from '../../../storage/profileStorage';
import { readImportedShareCode, readOwnShareCode } from '../../../storage/shareStorage';
import { readGoal } from '../../../storage/stepStorage';

import type { UserBodyProfile, WeightEntry } from '../domain/models';

export type ProfileSnapshot = {
  bodyProfile: UserBodyProfile | null;
  goal: number;
  importedShareCode: string;
  ownShareCode: string | null;
  weightEntries: WeightEntry[];
};

export const mergeWeightEntries = (localEntries: WeightEntry[], remoteEntries: WeightEntry[]): WeightEntry[] => {
  const entriesById = new Map<string, WeightEntry>();
  [...localEntries, ...remoteEntries].forEach((entry) => entriesById.set(entry.id, entry));
  return [...entriesById.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
};

export const getNewestProfile = (
  localProfile: UserBodyProfile | null,
  remoteProfile: UserBodyProfile | null,
): UserBodyProfile | null => {
  if (localProfile === null) return remoteProfile;
  if (remoteProfile === null) return localProfile;

  const localUpdatedAt = localProfile.updatedAt ?? '';
  const remoteUpdatedAt = remoteProfile.updatedAt ?? '';
  return remoteUpdatedAt > localUpdatedAt ? remoteProfile : localProfile;
};

export const loadProfileSnapshot = async (userId: string | null): Promise<ProfileSnapshot> => {
  const [goal, localProfile, localWeights, ownShareCode, importedShareCode] = await Promise.all([
    readGoal(),
    readBodyProfile(),
    readRecentWeightEntries(),
    readOwnShareCode(),
    readImportedShareCode(),
  ]);
  const [remoteProfile, remoteWeights] =
    userId === null
      ? [null, []]
      : await Promise.all([readBodyProfileFromFirestore(userId), readWeightEntriesFromFirestore(userId)]);
  const bodyProfile = getNewestProfile(localProfile, remoteProfile);
  const weightEntries = mergeWeightEntries(localWeights, remoteWeights);

  if (remoteProfile !== null) {
    await saveBodyProfile(remoteProfile);
  }
  await Promise.all(weightEntries.map(saveWeightEntry));

  return {
    bodyProfile,
    goal,
    importedShareCode: importedShareCode ?? '',
    ownShareCode,
    weightEntries,
  };
};

export const saveProfileSnapshot = async ({
  profile,
  userId,
}: {
  profile: UserBodyProfile;
  userId: string | null;
}): Promise<{ message: string; newWeightEntry: WeightEntry | null; ok: boolean }> => {
  const shouldWriteWeight = profile.weightTrackingEnabled && profile.currentWeightKg > 0;
  const newWeightEntry = shouldWriteWeight ? createWeightEntry(profile.currentWeightKg) : null;

  await saveBodyProfile(profile);
  if (newWeightEntry !== null) {
    await saveWeightEntry(newWeightEntry);
  }

  if (userId === null) {
    return { message: 'Profile saved locally. Sign in to sync it.', newWeightEntry, ok: true };
  }

  const profileResult = await syncBodyProfile(userId, profile);
  const weightResult =
    newWeightEntry === null
      ? { message: 'Profile saved to Firestore.', ok: true }
      : await syncWeightEntry(userId, newWeightEntry);
  const ok = profileResult.ok && weightResult.ok;
  return {
    message: ok ? 'Profile saved to Firestore.' : 'Could not save all profile data.',
    newWeightEntry,
    ok,
  };
};
