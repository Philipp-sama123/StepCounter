import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { AVATAR_VARIANTS, AvatarVariantKey } from '../config/avatarSprites';
import { firestore } from './config';

export const readAvatarPreferenceFromFirestore = async (userId: string): Promise<AvatarVariantKey | null> => {
  if (firestore === null) {
    return null;
  }

  try {
    const snapshot = await getDoc(doc(firestore, 'users', userId));
    const data = snapshot.data();
    const avatarKey = data?.avatarVariant;
    return isAvatarVariantKey(avatarKey) ? avatarKey : null;
  } catch (error) {
    console.warn('Unable to read avatar preference from Firestore.', { error, userId });
    return null;
  }
};

export const saveAvatarPreferenceToFirestore = async (userId: string, avatarVariant: AvatarVariantKey): Promise<void> => {
  if (firestore === null) {
    return;
  }

  try {
    await setDoc(
      doc(firestore, 'users', userId),
      {
        avatarUpdatedAt: serverTimestamp(),
        avatarVariant,
      },
      { merge: true },
    );
  } catch (error) {
    console.warn('Unable to save avatar preference to Firestore.', { avatarVariant, error, userId });
  }
};

const isAvatarVariantKey = (value: unknown): value is AvatarVariantKey =>
  typeof value === 'string' && AVATAR_VARIANTS.some((variant) => variant.key === value);
