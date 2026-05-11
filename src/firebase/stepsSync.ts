import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { firestore } from './config';
import { StepDataSource } from '../health/types';

type SyncDailyStepsParams = {
  date: string;
  goal: number;
  source: StepDataSource;
  steps: number;
  userId: string;
};

export const syncDailySteps = async ({ date, goal, source, steps, userId }: SyncDailyStepsParams): Promise<void> => {
  if (firestore === null) {
    return;
  }

  try {
    await setDoc(
      doc(firestore, 'users', userId, 'dailySteps', date),
      {
        date,
        goal,
        source,
        steps: Math.max(0, Math.floor(steps)),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.warn('Unable to sync daily steps to Firestore.', error);
  }
};
