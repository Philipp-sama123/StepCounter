import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { StepDataSource } from '../health/types';
import { ToastMessageItem } from '../components/ToastMessage';
import { DailySyncSnapshot } from '../services/dailyStepSync';
import { syncSnapshotAndBackfill } from '../services/syncService';

type DailyStepSyncParams = {
  goal: number;
  onMessage: (message: string, variant: ToastMessageItem['variant']) => void;
  source: StepDataSource;
  steps: number;
  userId: string | null;
};

export const useDailyStepSync = ({ goal, onMessage, source, steps, userId }: DailyStepSyncParams) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const hasSyncedOnOpenRef = useRef(false);
  const latestSyncSnapshotRef = useRef<DailySyncSnapshot>({
    goal,
    source,
    steps,
    userId,
  });

  useEffect(() => {
    latestSyncSnapshotRef.current = {
      goal,
      source,
      steps,
      userId,
    };
  }, [goal, source, steps, userId]);

  const syncSnapshot = useCallback(async (
    snapshot: DailySyncSnapshot,
    options: { backfillDays?: number; notify: boolean; showNoChanges?: boolean } = { notify: false },
  ): Promise<void> => {
    const result = await syncSnapshotAndBackfill(snapshot, { backfillDays: options.backfillDays, skipUnchanged: true });
    if (options.notify && (result.changed || options.showNoChanges || !result.ok)) {
      onMessage(result.message, result.ok ? 'standard' : 'error');
    }
  }, [onMessage]);

  const syncNow = useCallback(async (): Promise<void> => {
    setIsSyncing(true);
    try {
      await syncSnapshot(latestSyncSnapshotRef.current, { backfillDays: 1, notify: true, showNoChanges: true });
    } finally {
      setIsSyncing(false);
    }
  }, [syncSnapshot]);

  useEffect(() => {
    if (hasSyncedOnOpenRef.current || userId === null) {
      return;
    }

    hasSyncedOnOpenRef.current = true;
    void syncSnapshot(latestSyncSnapshotRef.current);
  }, [steps, syncSnapshot, userId]);

  useEffect(() => {
    let appState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const wasBackgrounded = appState === 'background' || appState === 'inactive';
      const willBackground = nextAppState === 'background' || nextAppState === 'inactive';

      if ((wasBackgrounded && nextAppState === 'active') || willBackground) {
        void syncSnapshot(latestSyncSnapshotRef.current);
      }

      appState = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [syncSnapshot]);

  return {
    isSyncing,
    syncNow,
  };
};
