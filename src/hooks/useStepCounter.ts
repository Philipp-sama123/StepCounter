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
import { StepDataSource } from '../health/types';

export type WalkingStatus = 'walking' | 'stopped' | 'unknown';

export type UseStepCounterResult = {
  todaySteps: number;
  isAvailable: boolean;
  status: WalkingStatus;
  isSystemTotalAvailable: boolean;
  source: StepDataSource;
};

const getStartOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const useStepCounter = (): UseStepCounterResult => {
  const [todaySteps, setTodaySteps] = useState(0);
  const [isAvailable, setIsAvailable] = useState(false);
  const [source, setSource] = useState<StepDataSource>('unavailable');
  const [status, setStatus] = useState<WalkingStatus>('unknown');

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

  const scheduleStoppedStatus = (): void => {
    if (stoppedTimerRef.current !== null) {
      clearTimeout(stoppedTimerRef.current);
    }

    stoppedTimerRef.current = setTimeout(() => {
      setStatus('stopped');
    }, STATUS_STOPPED_DELAY_MS);
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

  const syncSystemHealthSteps = async (): Promise<boolean> => {
    const result = await readTodayStepsFromSystemHealth();

    if (!result.available) {
      isSystemHealthActiveRef.current = false;
      setSource((currentSource) => (currentSource === 'unavailable' ? 'unavailable' : currentSource));
      return false;
    }

    const today = getTodayString();
    isSystemHealthActiveRef.current = true;
    setSource(result.source);
    updateTodaySteps(result.steps);
    await saveStepsForDate(today, result.steps);
    setStatus('stopped');
    return true;
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
        const available = await Pedometer.isAvailableAsync();
        if (!isMounted) {
          return;
        }

        setIsAvailable(available);

        if (!available) {
          setStatus('unknown');
          return;
        }

        const permission = await Pedometer.requestPermissionsAsync();
        if (!isMounted || !permission.granted) {
          setStatus('unknown');
          return;
        }

        const hasSystemHealthSteps = await syncSystemHealthSteps();

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
            setSource(Platform.OS === 'ios' ? 'apple-health' : 'live-sensor');
            updateTodaySteps(initialSteps);
            await saveStepsForDate(today, initialSteps);
          } else if (isMounted) {
            setSource('live-sensor');
            updateTodaySteps(await readStepsForDate(today));
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
        }
      }
    };

    void startPedometer();

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
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

  return {
    todaySteps,
    isAvailable,
    status,
    isSystemTotalAvailable: canQueryRangesRef.current || isSystemHealthActiveRef.current,
    source,
  };
};
