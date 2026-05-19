import { publishSharedProfile } from '../firebase/shareSync';
import { firebaseAuth } from '../firebase/config';
import { readOwnShareCode } from '../storage/shareStorage';

export const publishOwnSharedProfileSnapshot = async ({
  displayName,
  userId,
}: {
  displayName?: string | null;
  userId: string;
}): Promise<void> => {
  const shareCode = await readOwnShareCode();
  if (shareCode === null) {
    return;
  }

  const authUser = firebaseAuth?.currentUser ?? null;
  const fallbackName = authUser?.displayName ?? authUser?.email?.split('@')[0] ?? 'Shared profile';

  const result = await publishSharedProfile({
    code: shareCode,
    displayName: displayName?.trim() || fallbackName,
    userId,
  });

  if (!result.ok) {
    console.warn('Unable to refresh own shared profile snapshot.', result.message);
  }
};
