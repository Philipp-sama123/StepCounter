import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from '@firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { registerBackgroundStepSync, unregisterBackgroundStepSync } from '../background/stepSyncTask';
import { firebaseAuth, firestore, isFirebaseConfigured } from '../firebase/config';
import { activateUserStorage, deactivateUserStorage } from '../platform/storage/userScopedStorage';

import type { User } from '@firebase/auth';
import type { ReactNode } from 'react';

type AuthContextValue = {
  isConfigured: boolean;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

const upsertUserProfile = async (user: User): Promise<void> => {
  if (firestore === null) {
    return;
  }

  try {
    await setDoc(
      doc(firestore, 'users', user.uid),
      {
        displayName: user.displayName ?? null,
        email: user.email,
        photoURL: user.photoURL ?? null,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.warn('Unable to sync Firebase user profile.', { userId: user.uid, error });
  }
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (firebaseAuth === null) {
      setIsLoading(false);
      return undefined;
    }

    let authRevision = 0;
    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      const revision = ++authRevision;
      void (async () => {
        if (nextUser !== null) {
          await activateUserStorage(nextUser.uid);
          await upsertUserProfile(nextUser);
          void registerBackgroundStepSync();
        } else {
          deactivateUserStorage();
          void unregisterBackgroundStepSync();
        }

        if (revision !== authRevision) {
          return;
        }
        setUser(nextUser);
        setIsLoading(false);
      })();
    });

    return () => {
      authRevision += 1;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: isFirebaseConfigured,
      isLoading,
      user,
      signInWithEmail: async (email, password) => {
        if (firebaseAuth === null) {
          throw new Error('Firebase is not configured.');
        }

        const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await upsertUserProfile(credential.user);
      },
      sendPasswordReset: async (email) => {
        if (firebaseAuth === null) {
          throw new Error('Firebase is not configured.');
        }

        await sendPasswordResetEmail(firebaseAuth, email.trim());
      },
      registerWithEmail: async (name, email, password) => {
        if (firebaseAuth === null) {
          throw new Error('Firebase is not configured.');
        }

        const cleanName = name.trim();
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await updateProfile(credential.user, {
          displayName: cleanName.length > 0 ? cleanName : email.trim().split('@')[0],
        });
        await upsertUserProfile(credential.user);
      },
      signInWithGoogleIdToken: async (idToken) => {
        if (firebaseAuth === null) {
          throw new Error('Firebase is not configured.');
        }

        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(firebaseAuth, credential);
        await upsertUserProfile(userCredential.user);
      },
      signOutUser: async () => {
        if (firebaseAuth !== null) {
          await unregisterBackgroundStepSync();
          await signOut(firebaseAuth);
        }
      },
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
};
