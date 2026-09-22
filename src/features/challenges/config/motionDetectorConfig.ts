/** Central tuning values for live motion classification and step detection. */
export const MOTION_DETECTOR_CONFIG = {
  accelerometerIntervalMs: 80,
  movementIdleDelayMs: 650,
  gyroscopeIntervalMs: 120,
  maxStepIntervalMs: 1400,
  maxSpeedMotionG: 0.32,
  minStepIntervalMs: 260,
  phoneMovementThresholdG: 0.035,
  rotationLimitRadPerSecond: 7.5,
  rotationThresholdBoostG: 0.025,
  rotationThresholdBoostStartsAt: 2,
  runningCadenceStepsPerMinute: 145,
  stepThresholdG: 0.11,
  stepIdleDelayMs: 1400,
  warmupSampleCount: 8,
} as const;
