import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  User,
} from '@firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { firebaseAuth, firestore, isFirebaseConfigured } from '../firebase/config';

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

    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);

      if (nextUser !== null) {
        void upsertUserProfile(nextUser);
      }
    });
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
