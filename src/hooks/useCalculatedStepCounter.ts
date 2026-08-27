import { Accelerometer, Gyroscope } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';

import { getVectorMagnitude } from '../shared/math/vector';
import {
  readCalculatedStepHistory,
  readCalculatedStepsForDate,
  saveCalculatedStepsForDate,
} from '../storage/calculatedStepStorage';
import { readBodyProfile } from '../storage/profileStorage';
import { getTodayString } from '../storage/stepStorage';

import type { StepHistoryEntry } from '../features/steps/domain/models';

type CalculatedStepLogEntry = {
  accelerationG: number;
  confidence: number;
  motionG: number;
  rotationRadPerSecond: number;
  steps: number;
  thresholdG: number;
  timestamp: string;
};

export type DetectorSample = {
  elapsedMsSinceStep: number | null;
  motionG: number;
  rotationRadPerSecond: number;
  thresholdG: number;
  timestamp: string;
};

type DetectorDecision = 'accepted' | 'rejected' | 'waiting';

export type UseCalculatedStepCounterResult = {
  cadenceStepsPerMinute: number;
  caloriesKcal: number;
  confidence: number;
  detectorDecision: DetectorDecision;
  detectorReason: string;
  debugMessage: string;
  distanceKm: number;
  elapsedMsSinceStep: number | null;
  history: StepHistoryEntry[];
  isRotationTooHigh: boolean;
  isTimingTooFast: boolean;
  isAvailable: boolean;
  lastAccelerationG: number;
  lastMotionG: number;
  lastRotationRadPerSecond: number;
  motionThresholdG: number;
  log: CalculatedStepLogEntry[];
  samples: DetectorSample[];
  sampleCount: number;
  steps: number;
};

export const CALCULATED_STEP_DETECTOR_LIMITS = {
  accelerometerIntervalMs: 80,
  gyroscopeIntervalMs: 120,
  maxStepIntervalMs: 1400,
  minStepIntervalMs: 260,
  rotationLimitRadPerSecond: 7.5,
  sequenceResetIntervalMs: 2200,
  warmupSampleCount: 8,
} as const;

const {
  accelerometerIntervalMs: ACCELEROMETER_INTERVAL_MS,
  gyroscopeIntervalMs: GYROSCOPE_INTERVAL_MS,
  maxStepIntervalMs: MAX_STEP_INTERVAL_MS,
  minStepIntervalMs: MIN_STEP_INTERVAL_MS,
  rotationLimitRadPerSecond: ROTATION_LIMIT_RAD_PER_SECOND,
  sequenceResetIntervalMs: SEQUENCE_RESET_INTERVAL_MS,
  warmupSampleCount: WARMUP_SAMPLE_COUNT,
} = CALCULATED_STEP_DETECTOR_LIMITS;
const HISTORY_DAYS = 14;

export const useCalculatedStepCounter = (enabled = true): UseCalculatedStepCounterResult => {
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
  const [lastMotionG, setLastMotionG] = useState(0);
  const [motionThresholdG, setMotionThresholdG] = useState(0);
  const [elapsedMsSinceStep, setElapsedMsSinceStep] = useState<number | null>(null);
  const [isRotationTooHigh, setIsRotationTooHigh] = useState(false);
  const [isTimingTooFast, setIsTimingTooFast] = useState(false);
  const [detectorDecision, setDetectorDecision] = useState<DetectorDecision>('waiting');
  const [detectorReason, setDetectorReason] = useState('Waiting for enough sensor samples.');
  const [sampleCount, setSampleCount] = useState(0);
  const [log, setLog] = useState<CalculatedStepLogEntry[]>([]);
  const [samples, setSamples] = useState<DetectorSample[]>([]);
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

    if (!enabled) {
      return () => {
        isMounted = false;
      };
    }

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

      setDebugMessage(
        hasGyroscope
          ? 'Calculated detector is running from acceleration peaks with rotation filtering.'
          : 'Calculated detector is running from acceleration peaks. Rotation filtering unavailable.',
      );

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
      const canStartNewSequence = !hasPreviousStep || elapsedMs > SEQUENCE_RESET_INTERVAL_MS;
      const hasHumanTiming = hasPreviousStep
        ? canStartNewSequence || (elapsedMs >= MIN_STEP_INTERVAL_MS && elapsedMs <= MAX_STEP_INTERVAL_MS)
        : sampleCountRef.current > WARMUP_SAMPLE_COUNT;
      const hasEnoughStillness = rotationMagnitude < ROTATION_LIMIT_RAD_PER_SECOND;
      const timingTooFast = hasPreviousStep && !canStartNewSequence && elapsedMs < MIN_STEP_INTERVAL_MS;
      const rotationTooHigh = !hasEnoughStillness;
      const rejectReason = getRejectReason({
        hasEnoughStillness,
        hasHumanTiming,
        isPeak,
        sampleCount: sampleCountRef.current,
      });

      setLastAccelerationG(magnitudeG);
      setLastMotionG(motion);
      setMotionThresholdG(adaptiveThreshold);
      setElapsedMsSinceStep(hasPreviousStep ? elapsedMs : null);
      setIsTimingTooFast(timingTooFast);
      setIsRotationTooHigh(rotationTooHigh);
      setSampleCount(sampleCountRef.current);
      setSamples((currentSamples) =>
        [
          ...currentSamples,
          {
            elapsedMsSinceStep: hasPreviousStep ? elapsedMs : null,
            motionG: motion,
            rotationRadPerSecond: rotationMagnitude,
            thresholdG: adaptiveThreshold,
            timestamp: new Date().toISOString(),
          },
        ].slice(-48),
      );
      previousMotionRef.current = motion;

      if (!isPeak || !hasHumanTiming || !hasEnoughStillness) {
        setDetectorDecision('rejected');
        setDetectorReason(rejectReason);
        return;
      }

      lastStepAtRef.current = now;
      if (canStartNewSequence) {
        stepTimestampsRef.current = [];
      }
      const nextSteps = stepsRef.current + 1;
      stepsRef.current = nextSteps;
      const nextConfidence = getConfidence(motion, adaptiveThreshold, rotationMagnitude);
      const nextTimestamp = new Date().toISOString();

      setSteps(nextSteps);
      setConfidence(nextConfidence);
      setDetectorDecision('accepted');
      setDetectorReason(
        'Accepted: motion crossed the threshold, timing looked like walking, and rotation was calm enough.',
      );
      setCadenceStepsPerMinute(updateCadence(now, stepTimestampsRef.current));
      updateBodyEstimates(nextSteps);
      setLog((currentLog) =>
        [
          {
            accelerationG: magnitudeG,
            confidence: nextConfidence,
            motionG: motion,
            rotationRadPerSecond: rotationMagnitude,
            steps: nextSteps,
            thresholdG: adaptiveThreshold,
            timestamp: nextTimestamp,
          },
          ...currentLog,
        ].slice(0, 20),
      );

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
  }, [enabled]);

  return {
    cadenceStepsPerMinute,
    caloriesKcal,
    confidence,
    detectorDecision,
    detectorReason,
    debugMessage,
    distanceKm,
    elapsedMsSinceStep,
    history,
    isRotationTooHigh,
    isTimingTooFast,
    isAvailable,
    lastAccelerationG,
    lastMotionG,
    lastRotationRadPerSecond,
    motionThresholdG,
    log,
    samples,
    sampleCount,
    steps,
  };
};

const getRejectReason = ({
  hasEnoughStillness,
  hasHumanTiming,
  isPeak,
  sampleCount,
}: {
  hasEnoughStillness: boolean;
  hasHumanTiming: boolean;
  isPeak: boolean;
  sampleCount: number;
}): string => {
  if (sampleCount <= WARMUP_SAMPLE_COUNT) {
    return `Warming up sensor baseline (${sampleCount}/${WARMUP_SAMPLE_COUNT} samples).`;
  }

  if (!isPeak) {
    return 'Rejected: movement did not cross the adaptive step threshold.';
  }

  if (!hasHumanTiming) {
    return `Rejected: timing was too fast. A new sequence can start after ${SEQUENCE_RESET_INTERVAL_MS}ms.`;
  }

  if (!hasEnoughStillness) {
    return 'Rejected: phone rotation was too chaotic, likely hand movement.';
  }

  return 'Rejected: sample did not look like a clean walking step.';
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
