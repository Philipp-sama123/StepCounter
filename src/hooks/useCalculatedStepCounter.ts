import { useEffect, useRef, useState } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';

import {
  readCalculatedStepHistory,
  readCalculatedStepsForDate,
  saveCalculatedStepsForDate,
} from '../storage/calculatedStepStorage';
import { readBodyProfile } from '../storage/profileStorage';
import { getTodayString, StepHistoryEntry } from '../storage/stepStorage';

type CalculatedStepLogEntry = {
  accelerationG: number;
  confidence: number;
  rotationRadPerSecond: number;
  steps: number;
  timestamp: string;
};

export type UseCalculatedStepCounterResult = {
  cadenceStepsPerMinute: number;
  caloriesKcal: number;
  confidence: number;
  debugMessage: string;
  distanceKm: number;
  history: StepHistoryEntry[];
  isAvailable: boolean;
  lastAccelerationG: number;
  lastRotationRadPerSecond: number;
  log: CalculatedStepLogEntry[];
  steps: number;
};

const ACCELEROMETER_INTERVAL_MS = 80;
const GYROSCOPE_INTERVAL_MS = 120;
const MIN_STEP_INTERVAL_MS = 260;
const MAX_STEP_INTERVAL_MS = 1400;
const WARMUP_SAMPLE_COUNT = 8;
const HISTORY_DAYS = 14;

export const useCalculatedStepCounter = (): UseCalculatedStepCounterResult => {
  const [steps, setSteps] = useState(0);
  const [history, setHistory] = useState<StepHistoryEntry[]>([]);
  const [isAvailable, setIsAvailable] = useState(false);
  const [debugMessage, setDebugMessage] = useState('Loading calculated step detector...');
  const [lastAccelerationG, setLastAccelerationG] = useState(0);
  const [lastRotationRadPerSecond, setLastRotationRadPerSecond] = useState(0);
  const [cadenceStepsPerMinute, setCadenceStepsPerMinute] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [caloriesKcal, setCaloriesKcal] = useState(0);
  const [log, setLog] = useState<CalculatedStepLogEntry[]>([]);
  const stepsRef = useRef(0);
  const dateRef = useRef(getTodayString());
  const gravityBaselineRef = useRef(1);
  const previousMotionRef = useRef(0);
  const lastStepAtRef = useRef(0);
  const sampleCountRef = useRef(0);
  const stepTimestampsRef = useRef<number[]>([]);
  const rotationMagnitudeRef = useRef(0);
  const profileRef = useRef({ heightCm: 0, weightKg: 0 });

  useEffect(() => {
    let isMounted = true;
    let accelerometerSubscription: ReturnType<typeof Accelerometer.addListener> | null = null;
    let gyroscopeSubscription: ReturnType<typeof Gyroscope.addListener> | null = null;

    const loadInitialState = async (): Promise<void> => {
      const [storedSteps, storedHistory, profile] = await Promise.all([
        readCalculatedStepsForDate(getTodayString()),
        readCalculatedStepHistory(HISTORY_DAYS),
        readBodyProfile(),
      ]);

      if (!isMounted) {
        return;
      }

      profileRef.current = {
        heightCm: profile?.heightCm ?? 0,
        weightKg: profile?.currentWeightKg ?? 0,
      };
      stepsRef.current = storedSteps;
      setSteps(storedSteps);
      setHistory(storedHistory);
      updateBodyEstimates(storedSteps);
    };

    const startSensors = async (): Promise<void> => {
      await loadInitialState();
      const [hasAccelerometer, hasGyroscope] = await Promise.all([
        Accelerometer.isAvailableAsync(),
        Gyroscope.isAvailableAsync(),
      ]);

      if (!isMounted) {
        return;
      }

      setIsAvailable(hasAccelerometer);
      if (!hasAccelerometer) {
        setDebugMessage('Accelerometer unavailable. Calculated steps cannot run on this device.');
        return;
      }

      setDebugMessage(hasGyroscope
        ? 'Calculated detector is running from acceleration peaks with rotation filtering.'
        : 'Calculated detector is running from acceleration peaks. Rotation filtering unavailable.');

      if (hasGyroscope) {
        Gyroscope.setUpdateInterval(GYROSCOPE_INTERVAL_MS);
        gyroscopeSubscription = Gyroscope.addListener(({ x, y, z }) => {
          rotationMagnitudeRef.current = getVectorMagnitude(x, y, z);
          setLastRotationRadPerSecond(rotationMagnitudeRef.current);
        });
      }

      Accelerometer.setUpdateInterval(ACCELEROMETER_INTERVAL_MS);
      accelerometerSubscription = Accelerometer.addListener(({ x, y, z }) => {
        void handleAccelerationSample(getVectorMagnitude(x, y, z));
      });
    };

    const handleAccelerationSample = async (magnitudeG: number): Promise<void> => {
      const today = getTodayString();
      if (dateRef.current !== today) {
        dateRef.current = today;
        stepsRef.current = 0;
        stepTimestampsRef.current = [];
        setSteps(0);
        setHistory(await readCalculatedStepHistory(HISTORY_DAYS));
      }

      gravityBaselineRef.current = gravityBaselineRef.current * 0.92 + magnitudeG * 0.08;
      const motion = Math.abs(magnitudeG - gravityBaselineRef.current);
      const now = Date.now();
      const elapsedMs = now - lastStepAtRef.current;
      sampleCountRef.current += 1;
      const rotationMagnitude = rotationMagnitudeRef.current;
      const adaptiveThreshold = getAdaptiveThreshold(profileRef.current.heightCm, rotationMagnitude);
      const isPeak = previousMotionRef.current <= adaptiveThreshold && motion > adaptiveThreshold;
      const hasPreviousStep = lastStepAtRef.current > 0;
      const hasHumanTiming = hasPreviousStep
        ? elapsedMs >= MIN_STEP_INTERVAL_MS && elapsedMs <= MAX_STEP_INTERVAL_MS
        : sampleCountRef.current > WARMUP_SAMPLE_COUNT;
      const hasEnoughStillness = rotationMagnitude < 7.5;

      setLastAccelerationG(magnitudeG);
      previousMotionRef.current = motion;

      if (!isPeak || !hasHumanTiming || !hasEnoughStillness) {
        return;
      }

      lastStepAtRef.current = now;
      const nextSteps = stepsRef.current + 1;
      stepsRef.current = nextSteps;
      const nextConfidence = getConfidence(motion, adaptiveThreshold, rotationMagnitude);
      const nextTimestamp = new Date().toISOString();

      setSteps(nextSteps);
      setConfidence(nextConfidence);
      setCadenceStepsPerMinute(updateCadence(now, stepTimestampsRef.current));
      updateBodyEstimates(nextSteps);
      setLog((currentLog) => [{
        accelerationG: magnitudeG,
        confidence: nextConfidence,
        rotationRadPerSecond: rotationMagnitude,
        steps: nextSteps,
        timestamp: nextTimestamp,
      }, ...currentLog].slice(0, 20));

      await saveCalculatedStepsForDate(today, nextSteps);
      setHistory(await readCalculatedStepHistory(HISTORY_DAYS));
    };

    const updateBodyEstimates = (nextSteps: number): void => {
      const strideMeters = getStrideMeters(profileRef.current.heightCm);
      const nextDistanceKm = (nextSteps * strideMeters) / 1000;
      const weightKg = profileRef.current.weightKg;
      setDistanceKm(nextDistanceKm);
      setCaloriesKcal(weightKg > 0 ? Math.round(nextDistanceKm * weightKg * 0.57) : 0);
    };

    void startSensors();

    return () => {
      isMounted = false;
      accelerometerSubscription?.remove();
      gyroscopeSubscription?.remove();
    };
  }, []);

  return {
    cadenceStepsPerMinute,
    caloriesKcal,
    confidence,
    debugMessage,
    distanceKm,
    history,
    isAvailable,
    lastAccelerationG,
    lastRotationRadPerSecond,
    log,
    steps,
  };
};

const getAdaptiveThreshold = (heightCm: number, rotationMagnitude: number): number => {
  const heightAdjustment = heightCm > 0 ? Math.max(-0.025, Math.min(0.025, (170 - heightCm) / 4000)) : 0;
  const rotationAdjustment = rotationMagnitude > 2 ? 0.025 : 0;
  return 0.11 + heightAdjustment + rotationAdjustment;
};

const getConfidence = (motion: number, threshold: number, rotationMagnitude: number): number => {
  const motionConfidence = Math.min(1, Math.max(0, (motion - threshold) / 0.28));
  const rotationPenalty = Math.min(0.35, rotationMagnitude / 24);
  return Math.round(Math.max(0.25, motionConfidence - rotationPenalty) * 100);
};

const updateCadence = (timestamp: number, timestamps: number[]): number => {
  const oneMinuteAgo = timestamp - 60000;
  const recentTimestamps = [...timestamps.filter((stepTimestamp) => stepTimestamp >= oneMinuteAgo), timestamp];
  timestamps.splice(0, timestamps.length, ...recentTimestamps);
  return recentTimestamps.length;
};

const getStrideMeters = (heightCm: number): number => {
  if (heightCm <= 0) {
    return 0.72;
  }

  return Math.max(0.45, Math.min(1.05, heightCm * 0.00415));
};

const getVectorMagnitude = (x: number, y: number, z: number): number =>
  Math.sqrt(x * x + y * y + z * z);
