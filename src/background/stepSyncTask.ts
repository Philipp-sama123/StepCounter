import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { onAuthStateChanged, User } from '@firebase/auth';

import { firebaseAuth } from '../firebase/config';
import { syncTodayAndBackfill } from '../services/syncService';

const BACKGROUND_STEP_SYNC_TASK = 'background-step-sync';
const BACKGROUND_STEP_SYNC_INTERVAL_MINUTES = 60;
const AUTH_RESTORE_TIMEOUT_MS = 2000;

const getBackgroundUser = async (): Promise<User | null> => {
  const auth = firebaseAuth;
  if (auth === null) {
    return null;
  }

  if (auth.currentUser !== null) {
    return auth.currentUser;
  }

  return new Promise((resolve) => {
    let unsubscribe: (() => void) | null = null;
    const timeout = setTimeout(() => {
      unsubscribe?.();
      resolve(auth.currentUser);
    }, AUTH_RESTORE_TIMEOUT_MS);

    unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timeout);
      unsubscribe?.();
      resolve(user);
    });
  });
};

TaskManager.defineTask(BACKGROUND_STEP_SYNC_TASK, async () => {
  try {
    const user = await getBackgroundUser();
    if (user === null) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const result = await syncTodayAndBackfill({
      userId: user.uid,
    });

    return result.ok ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed;
  } catch (error) {
    console.warn('Background step sync failed.', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export const registerBackgroundStepSync = async (): Promise<void> => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_STEP_SYNC_TASK);
    if (isRegistered) {
      return;
    }

    await BackgroundTask.registerTaskAsync(BACKGROUND_STEP_SYNC_TASK, {
      minimumInterval: BACKGROUND_STEP_SYNC_INTERVAL_MINUTES,
    });
  } catch (error) {
    console.warn('Unable to register background step sync.', error);
  }
};

export const unregisterBackgroundStepSync = async (): Promise<void> => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_STEP_SYNC_TASK);
    if (!isRegistered) {
      return;
    }

    await BackgroundTask.unregisterTaskAsync(BACKGROUND_STEP_SYNC_TASK);
  } catch (error) {
    console.warn('Unable to unregister background step sync.', error);
  }
};
