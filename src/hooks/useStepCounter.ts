import { useEffect, useRef, useState } from 'react';
import { Pedometer } from 'expo-sensors';

import { STATUS_STOPPED_DELAY_MS } from '../constants';
import {
  getTodayString,
  readStepCounterState,
  saveStepCounterState,
  saveStepsForDate,
} from '../storage/stepStorage';

export type WalkingStatus = 'walking' | 'stopped' | 'unknown';

export type UseStepCounterResult = {
  todaySteps: number;
  isAvailable: boolean;
  status: WalkingStatus;
};

const getStartOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const useStepCounter = (): UseStepCounterResult => {
  const [todaySteps, setTodaySteps] = useState(0);
  const [isAvailable, setIsAvailable] = useState(false);
  const [status, setStatus] = useState<WalkingStatus>('unknown');

  const baselineRef = useRef(0);
  const lastDateRef = useRef<string | null>(null);
  const todayStepsRef = useRef(0);
  const previousSensorStepsRef = useRef<number | null>(null);
  const canQueryRangesRef = useRef(true);
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

  const handleStepUpdate = async (currentSteps: number): Promise<void> => {
    const today = getTodayString();

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

    const queriedSteps = await readTodayStepsFromRange();
    const nextSteps = queriedSteps ?? currentSteps - baselineRef.current;
    updateTodaySteps(nextSteps);

    const previousSteps = previousSensorStepsRef.current;
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

        const initialSteps = await readTodayStepsFromRange();
        if (isMounted && initialSteps !== null) {
          updateTodaySteps(initialSteps);
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

    return () => {
      isMounted = false;
      subscription?.remove();

      if (stoppedTimerRef.current !== null) {
        clearTimeout(stoppedTimerRef.current);
      }
    };
  }, []);

  return {
    todaySteps,
    isAvailable,
    status,
  };
};
