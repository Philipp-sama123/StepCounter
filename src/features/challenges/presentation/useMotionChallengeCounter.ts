import { Accelerometer, Gyroscope } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';

import { getVectorMagnitude } from '../../../shared/math/vector';
import { MOTION_DETECTOR_CONFIG } from '../config/motionDetectorConfig';
import { getCadenceStepsPerMinute, getStepActivity } from '../domain/motionActivity';

import type { WalkingStatus } from '../../steps/presentation/useStepCounter';
import type { MotionActivityState } from '../domain/motionActivity';

type MotionChallengeCounter = {
  activity: MotionActivityState;
  debug: MotionDebugSnapshot;
  isAvailable: boolean;
  speed: number;
  status: WalkingStatus;
  steps: number;
};

type SensorVector = { x: number; y: number; z: number };

export type MotionDebugSample = {
  motionG: number;
  thresholdG: number;
  timestamp: number;
};

export type MotionDebugSnapshot = {
  acceleration: SensorVector;
  accelerationG: number;
  acceptedSteps: number;
  activity: MotionActivityState;
  decision: 'accepted' | 'rejected' | 'waiting';
  gyroscope: SensorVector;
  motionG: number;
  reason: string;
  rotationRadPerSecond: number;
  samples: MotionDebugSample[];
  thresholdG: number;
};

const detectorConfig = MOTION_DETECTOR_CONFIG;

/**
 * Counts steps from live motion while a challenge is active. This deliberately
 * stays independent of Health Connect, whose aggregates can arrive seconds
 * later, so the challenge counter reacts to each detected step immediately.
 */
export const useMotionChallengeCounter = ({
  active,
  debugEnabled,
  enabled,
}: {
  active: boolean;
  debugEnabled: boolean;
  enabled: boolean;
}): MotionChallengeCounter => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [activity, setActivity] = useState<MotionActivityState>('idle');
  const [status, setStatus] = useState<WalkingStatus>('unknown');
  const [speed, setSpeed] = useState(0);
  const [steps, setSteps] = useState(0);
  const [debug, setDebug] = useState<MotionDebugSnapshot>({
    acceleration: { x: 0, y: 0, z: 0 },
    accelerationG: 0,
    acceptedSteps: 0,
    activity: 'idle',
    decision: 'waiting',
    gyroscope: { x: 0, y: 0, z: 0 },
    motionG: 0,
    reason: 'Waiting for sensor samples.',
    rotationRadPerSecond: 0,
    samples: [],
    thresholdG: detectorConfig.stepThresholdG,
  });
  const activeRef = useRef(active);
  const gravityBaselineRef = useRef(1);
  const previousMotionRef = useRef(0);
  const rotationMagnitudeRef = useRef(0);
  const lastStepAtRef = useRef(0);
  const sampleCountRef = useRef(0);
  const stoppedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debugEnabledRef = useRef(debugEnabled);
  const activityRef = useRef<MotionActivityState>('idle');
  const recentStepTimestampsRef = useRef<number[]>([]);
  const gyroscopeVectorRef = useRef<SensorVector>({ x: 0, y: 0, z: 0 });
  const speedRef = useRef(0);

  const updateActivity = (nextActivity: MotionActivityState): void => {
    if (activityRef.current === nextActivity) {
      return;
    }
    activityRef.current = nextActivity;
    setActivity(nextActivity);
  };

  useEffect(() => {
    debugEnabledRef.current = debugEnabled;
    if (!debugEnabled) {
      setDebug((current) => ({ ...current, samples: [] }));
    }
  }, [debugEnabled]);

  useEffect(() => {
    activeRef.current = active;
    if (active) {
      setSteps(0);
      setStatus('unknown');
      lastStepAtRef.current = 0;
      recentStepTimestampsRef.current = [];
    } else {
      setStatus('stopped');
    }
  }, [active]);

  useEffect(() => {
    let isMounted = true;
    let accelerometerSubscription: ReturnType<typeof Accelerometer.addListener> | null = null;
    let gyroscopeSubscription: ReturnType<typeof Gyroscope.addListener> | null = null;

    if (!enabled) {
      updateActivity('idle');
      speedRef.current = 0;
      setSpeed(0);
      setStatus('unknown');
      return () => {
        isMounted = false;
      };
    }

    const scheduleIdleState = (delayMs: number): void => {
      if (stoppedTimerRef.current !== null) {
        clearTimeout(stoppedTimerRef.current);
      }
      stoppedTimerRef.current = setTimeout(() => {
        updateActivity('idle');
        speedRef.current = 0;
        setSpeed(0);
        setStatus('stopped');
      }, delayMs);
    };

    const startSensors = async (): Promise<void> => {
      const [hasAccelerometer, hasGyroscope] = await Promise.all([
        Accelerometer.isAvailableAsync(),
        Gyroscope.isAvailableAsync(),
      ]);
      if (!isMounted) {
        return;
      }

      setIsAvailable(hasAccelerometer);
      if (!hasAccelerometer) {
        setStatus('unknown');
        return;
      }

      if (hasGyroscope) {
        Gyroscope.setUpdateInterval(detectorConfig.gyroscopeIntervalMs);
        gyroscopeSubscription = Gyroscope.addListener(({ x, y, z }) => {
          gyroscopeVectorRef.current = { x, y, z };
          rotationMagnitudeRef.current = getVectorMagnitude(x, y, z);
        });
      }

      Accelerometer.setUpdateInterval(detectorConfig.accelerometerIntervalMs);
      accelerometerSubscription = Accelerometer.addListener(({ x, y, z }) => {
        const magnitudeG = getVectorMagnitude(x, y, z);
        gravityBaselineRef.current = gravityBaselineRef.current * 0.92 + magnitudeG * 0.08;
        const motion = Math.abs(magnitudeG - gravityBaselineRef.current);
        const rotation = rotationMagnitudeRef.current;
        const threshold =
          detectorConfig.stepThresholdG +
          (rotation > detectorConfig.rotationThresholdBoostStartsAt ? detectorConfig.rotationThresholdBoostG : 0);
        const now = Date.now();
        const elapsedMs = now - lastStepAtRef.current;
        sampleCountRef.current += 1;
        const isPeak = previousMotionRef.current <= threshold && motion > threshold;
        const isFirstStep = lastStepAtRef.current === 0;
        const timingIsValid = isFirstStep
          ? sampleCountRef.current > detectorConfig.warmupSampleCount
          : elapsedMs >= detectorConfig.minStepIntervalMs && elapsedMs <= detectorConfig.maxStepIntervalMs;
        previousMotionRef.current = motion;

        const isStepDetected = isPeak && timingIsValid && rotation < detectorConfig.rotationLimitRadPerSecond;
        const isPhoneMoving = motion >= detectorConfig.phoneMovementThresholdG;
        const measuredSpeed = Math.min(
          1,
          Math.max(
            0,
            (motion - detectorConfig.phoneMovementThresholdG) /
              (detectorConfig.maxSpeedMotionG - detectorConfig.phoneMovementThresholdG),
          ),
        );
        const nextSpeed = speedRef.current * 0.72 + measuredSpeed * 0.28;
        if (Math.abs(nextSpeed - speedRef.current) >= 0.015) {
          speedRef.current = nextSpeed;
          setSpeed(nextSpeed);
        }
        const rejectReason = getDetectorReason({ active: activeRef.current, isPeak, rotation, timingIsValid });

        if (isPhoneMoving) {
          if (!isStepDetected) {
            updateActivity('moving');
          }
          scheduleIdleState(detectorConfig.movementIdleDelayMs);
        }

        if (debugEnabledRef.current) {
          setDebug((current) => ({
            acceleration: { x, y, z },
            accelerationG: magnitudeG,
            acceptedSteps: steps,
            activity: activityRef.current,
            decision: isStepDetected ? 'accepted' : activeRef.current ? 'rejected' : 'waiting',
            gyroscope: gyroscopeVectorRef.current,
            motionG: motion,
            reason: isStepDetected ? 'Detected a reliable walking or running step.' : rejectReason,
            rotationRadPerSecond: rotation,
            samples: [...current.samples, { motionG: motion, thresholdG: threshold, timestamp: now }].slice(-42),
            thresholdG: threshold,
          }));
        }

        if (!isStepDetected) {
          return;
        }

        lastStepAtRef.current = now;
        recentStepTimestampsRef.current = [
          ...recentStepTimestampsRef.current.filter((time) => now - time <= 10000),
          now,
        ];
        const cadence = getCadenceStepsPerMinute(recentStepTimestampsRef.current);
        const nextActivity = getStepActivity(cadence, detectorConfig.runningCadenceStepsPerMinute);
        const cadenceSpeed = Math.min(1, Math.max(0.25, cadence / 190));
        speedRef.current = Math.max(speedRef.current, cadenceSpeed);
        setSpeed(speedRef.current);
        updateActivity(nextActivity);
        if (activeRef.current) {
          setSteps((currentSteps) => {
            const nextSteps = currentSteps + 1;
            if (debugEnabledRef.current) {
              setDebug((current) => ({ ...current, acceptedSteps: nextSteps, activity: nextActivity }));
            }
            return nextSteps;
          });
        }
        setStatus('walking');
        scheduleIdleState(detectorConfig.stepIdleDelayMs);
      });
    };

    void startSensors();

    return () => {
      isMounted = false;
      accelerometerSubscription?.remove();
      gyroscopeSubscription?.remove();
      if (stoppedTimerRef.current !== null) {
        clearTimeout(stoppedTimerRef.current);
      }
    };
  }, [enabled]);

  return { activity, debug, isAvailable, speed, status, steps };
};

const getDetectorReason = ({
  active,
  isPeak,
  rotation,
  timingIsValid,
}: {
  active: boolean;
  isPeak: boolean;
  rotation: number;
  timingIsValid: boolean;
}): string => {
  if (!active) return 'Motion monitoring only; challenge is not active.';
  if (!isPeak) return 'Movement stayed below the adaptive step threshold.';
  if (!timingIsValid) return 'Peak timing was outside the walking cadence window.';
  if (rotation >= detectorConfig.rotationLimitRadPerSecond) return 'Phone rotation was too high for a reliable step.';
  return 'Waiting for a clean step peak.';
};
