import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';

import { STATUS_STOPPED_DELAY_MS } from '../constants';
import {
  getTodayString,
  readStepCounterState,
  readStepsForDate,
  saveStepCounterState,
  saveStepsForDate,
} from '../storage/stepStorage';
import { readTodayStepsFromSystemHealth } from '../health/stepsProvider';
import { StepDataSource, StepTrackingMode } from '../health/types';
import { getStepSourceSentenceLabel } from '../utils/stepSource';

export type WalkingStatus = 'walking' | 'stopped' | 'unknown';

export type StepSensorLogEntry = {
  delta: number;
  rawSteps: number;
  timestamp: string;
  totalSteps: number;
};

export type UseStepCounterResult = {
  debugMessage: string;
  todaySteps: number;
  sensorLog: StepSensorLogEntry[];
  isAvailable: boolean;
  isRefreshing: boolean;
  lastSyncedAt: string | null;
  refreshSteps: () => Promise<string>;
  requestPermissions: () => Promise<boolean>;
  status: WalkingStatus;
  isSystemTotalAvailable: boolean;
  source: StepDataSource;
  canRefresh: boolean;
};

const getStartOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const useStepCounter = (mode: StepTrackingMode = 'combined'): UseStepCounterResult => {
  const [todaySteps, setTodaySteps] = useState(0);
  const [debugMessage, setDebugMessage] = useState('Loading local step data...');
  const [isAvailable, setIsAvailable] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [source, setSource] = useState<StepDataSource>('unavailable');
  const [status, setStatus] = useState<WalkingStatus>('unknown');
  const [sensorLog, setSensorLog] = useState<StepSensorLogEntry[]>([]);

  const baselineRef = useRef(0);
  const lastDateRef = useRef<string | null>(null);
  const todayStepsRef = useRef(0);
  const isSystemHealthActiveRef = useRef(false);
  const previousSensorStepsRef = useRef<number | null>(null);
  const canQueryRangesRef = useRef(Platform.OS !== 'android');
  const stoppedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateTodaySteps = (steps: number): void => {
    const safeSteps = Math.max(0, Math.floor(steps));
    todayStepsRef.current = safeSteps;
    setTodaySteps(safeSteps);
  };

  const addSensorLogEntry = (entry: StepSensorLogEntry): void => {
    setSensorLog((currentLog) => [entry, ...currentLog].slice(0, 120));
  };

  const scheduleStoppedStatus = (): void => {
    if (stoppedTimerRef.current !== null) {
      clearTimeout(stoppedTimerRef.current);
    }

    stoppedTimerRef.current = setTimeout(() => {
      setStatus('stopped');
    }, STATUS_STOPPED_DELAY_MS);
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const permission = await Pedometer.requestPermissionsAsync();
      if (permission.granted) {
        setIsAvailable(true);
        setDebugMessage('Permissions granted. Starting step tracking...');
        // Could restart the pedometer here, but for simplicity, just update state
        return true;
      } else {
        setDebugMessage('Permissions denied. Please enable in device settings.');
        return false;
      }
    } catch (error) {
      console.warn('Failed to request permissions.', error);
      setDebugMessage('Failed to request permissions.');
      return false;
    }
  };

  const readTodayStepsFromRange = async (): Promise<number | null> => {
    if (!canQueryRangesRef.current) {
      return null;
    }

    try {
      const result = await Pedometer.getStepCountAsync(getStartOfToday(), new Date());
      return result.steps;
    } catch (error) {
      canQueryRangesRef.current = false;
      console.warn('Pedometer date-range step count is unavailable on this device.', error);
      return null;
    }
  };

  const syncSystemHealthSteps = async (): Promise<number | null> => {
    setIsRefreshing(true);
    const result = await readTodayStepsFromSystemHealth();

    if (!result.available) {
      isSystemHealthActiveRef.current = false;
      setSource((currentSource) => (currentSource === 'unavailable' ? 'unavailable' : currentSource));
      setDebugMessage(result.reason);
      setIsRefreshing(false);
      return null;
    }

    const today = getTodayString();
    const syncedAt = new Date().toISOString();
    isSystemHealthActiveRef.current = true;
    setSource(result.source);
    updateTodaySteps(result.steps);
    await saveStepsForDate(today, result.steps);
    setStatus('stopped');
    setLastSyncedAt(syncedAt);
    setDebugMessage(`Loaded ${result.steps.toLocaleString()} steps from ${getStepSourceSentenceLabel(result.source)}.`);
    setIsRefreshing(false);
    return result.steps;
  };

  const handleStepUpdate = async (currentSteps: number): Promise<void> => {
    const today = getTodayString();

    if (isSystemHealthActiveRef.current) {
      if (currentSteps > (previousSensorStepsRef.current ?? 0)) {
        setStatus('walking');
        scheduleStoppedStatus();
      }
      previousSensorStepsRef.current = currentSteps;
      return;
    }

    if (lastDateRef.current === null) {
      baselineRef.current = currentSteps;
      lastDateRef.current = today;
      await saveStepCounterState(currentSteps, today);
    }

    if (lastDateRef.current !== today) {
      await saveStepsForDate(lastDateRef.current, todayStepsRef.current);
      baselineRef.current = currentSteps;
      lastDateRef.current = today;
      updateTodaySteps(0);
      await saveStepCounterState(currentSteps, today);
    }

    const previousSteps = previousSensorStepsRef.current;
    const liveStepDelta = previousSteps === null ? currentSteps : Math.max(0, currentSteps - previousSteps);
    const queriedSteps = await readTodayStepsFromRange();
    const nextSteps = queriedSteps ?? todayStepsRef.current + liveStepDelta;
    updateTodaySteps(nextSteps);
    await saveStepsForDate(today, nextSteps);
    addSensorLogEntry({
      delta: liveStepDelta,
      rawSteps: currentSteps,
      timestamp: new Date().toISOString(),
      totalSteps: nextSteps,
    });

    if (previousSteps === null || currentSteps > previousSteps) {
      setStatus('walking');
      scheduleStoppedStatus();
    }
    previousSensorStepsRef.current = currentSteps;
  };

  useEffect(() => {
    let isMounted = true;
    let subscription: Pedometer.Subscription | null = null;

    const startPedometer = async (): Promise<void> => {
      try {
        if (mode === 'system') {
          // Only system health
          const hasSystemHealthSteps = (await syncSystemHealthSteps()) !== null;
          if (!hasSystemHealthSteps) {
            setDebugMessage('System health data unavailable.');
          }
          return;
        }

        // For 'live' and 'combined', check pedometer
        const available = await Pedometer.isAvailableAsync();
        if (!isMounted) {
          return;
        }

        setIsAvailable(available);

        if (!available) {
          setStatus('unknown');
          if (mode === 'live') {
            setDebugMessage('Pedometer unavailable for live tracking.');
          }
          return;
        }

        const permission = await Pedometer.requestPermissionsAsync();
        if (!isMounted || !permission.granted) {
          setStatus('unknown');
          if (mode === 'live') {
            setDebugMessage('Pedometer permission denied.');
          }
          return;
        }

        const hasSystemHealthSteps = mode === 'combined' ? (await syncSystemHealthSteps()) !== null : false;

        const storedState = await readStepCounterState();
        baselineRef.current = storedState.baseline;
        lastDateRef.current = storedState.lastDate;

        const today = getTodayString();
        if (lastDateRef.current !== null && lastDateRef.current !== today) {
          await saveStepsForDate(lastDateRef.current, todayStepsRef.current);
          baselineRef.current = 0;
          lastDateRef.current = today;
          await saveStepCounterState(0, today);
        }

        if (!hasSystemHealthSteps) {
          const initialSteps = await readTodayStepsFromRange();
          if (isMounted && initialSteps !== null) {
            setSource(mode === 'live' ? 'live-sensor' : (Platform.OS === 'ios' ? 'apple-health' : 'live-sensor'));
            updateTodaySteps(initialSteps);
            await saveStepsForDate(today, initialSteps);
            setDebugMessage(`Loaded ${initialSteps.toLocaleString()} steps from device sensors.`);
          } else if (isMounted) {
            setSource('live-sensor');
            updateTodaySteps(await readStepsForDate(today));
            setDebugMessage('Using local step data.');
          }
        }

        subscription = Pedometer.watchStepCount((result) => {
          void handleStepUpdate(result.steps);
        });
      } catch (error) {
        console.warn('Unable to start pedometer.', error);
        if (isMounted) {
          setIsAvailable(false);
          setStatus('unknown');
          setDebugMessage('Step tracking is unavailable on this device.');
        }
      }
    };

    void startPedometer();

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && mode !== 'live') {
        void syncSystemHealthSteps();
      }
    });
    const healthConnectRefreshInterval = setInterval(() => {
      if (isSystemHealthActiveRef.current) {
        void syncSystemHealthSteps();
      }
    }, 60000);

    return () => {
      isMounted = false;
      subscription?.remove();
      appStateSubscription.remove();
      clearInterval(healthConnectRefreshInterval);

      if (stoppedTimerRef.current !== null) {
        clearTimeout(stoppedTimerRef.current);
      }
    };
  }, []);

  const isSystemTotalAvailable =
    mode === 'system'
      ? isSystemHealthActiveRef.current
      : mode === 'combined'
        ? canQueryRangesRef.current || isSystemHealthActiveRef.current
        : canQueryRangesRef.current;

  return {
    debugMessage,
    todaySteps,
    sensorLog,
    isAvailable,
    isRefreshing,
    lastSyncedAt,
    refreshSteps: async () => {
      try {
        if (mode === 'live') {
          if (Platform.OS === 'android') {
            const message = 'Live sensor refresh is not available on Android. Steps update in real-time.';
            setDebugMessage(message);
            return message;
          }
          // For live on iOS, refresh from pedometer range
          const steps = await readTodayStepsFromRange();
          if (steps !== null) {
            updateTodaySteps(steps);
            await saveStepsForDate(getTodayString(), steps);
            const message = `Loaded ${steps.toLocaleString()} steps from device sensors.`;
            setDebugMessage(`Refreshed ${steps.toLocaleString()} steps from sensors.`);
            return message;
          } else {
            const message = 'Unable to refresh sensor data.';
            setDebugMessage(message);
            return message;
          }
        } else {
          // For system and combined, refresh system health
          const loadedSteps = await syncSystemHealthSteps();
          if (loadedSteps !== null) {
            return `Loaded ${loadedSteps.toLocaleString()} steps from ${getStepSourceSentenceLabel(source)}.`;
          } else {
            return 'Unable to load health data. Check permissions.';
          }
        }
      } catch (error) {
        console.warn('Manual step refresh failed.', error);
        const message = 'Step refresh failed. Check permissions and try again.';
        setDebugMessage(message);
        setIsRefreshing(false);
        return message;
      }
    },
    requestPermissions,
    status,
    isSystemTotalAvailable,
    source,
    canRefresh: !(mode === 'live' && Platform.OS === 'android'),
  };
};
