import { formatClockDuration } from '../shared/format/metrics';
import { getVectorMagnitude } from '../shared/math/vector';

export type AccelerometerSample = {
  magnitude: number;
  timestamp: string;
  x: number;
  y: number;
  z: number;
};

export type GenericSensorSample = {
  headline: string;
  line: string;
  timestamp: string;
};

export type RollingAverages = {
  accelerometerMagnitude: number;
  gyroscopeMagnitude: number;
  stepsPerMinute: number;
};

type RollingAverageInput = {
  accelerometerLog: AccelerometerSample[];
  gyroscopeLog: GenericSensorSample[];
  nowMs: number;
  sensorLog: { delta: number; timestamp: string }[];
};

export const formatDuration = formatClockDuration;

export const getAccelerationMagnitude = getVectorMagnitude;

export { getVectorMagnitude } from '../shared/math/vector';

export const formatAxis = (value: number): string => value.toFixed(2);

export const getRollingAverages = ({
  accelerometerLog,
  gyroscopeLog,
  nowMs,
  sensorLog,
}: RollingAverageInput): RollingAverages => {
  const cutoffMs = nowMs - 60000;
  const recentStepEvents = sensorLog.filter((entry) => new Date(entry.timestamp).getTime() >= cutoffMs);
  const stepsPerMinute = recentStepEvents.reduce((total, entry) => total + Math.max(0, entry.delta), 0);

  return {
    accelerometerMagnitude: averageNumbers(
      accelerometerLog
        .filter((entry) => new Date(entry.timestamp).getTime() >= cutoffMs)
        .map((entry) => entry.magnitude),
    ),
    gyroscopeMagnitude: averageNumbers(
      gyroscopeLog
        .filter((entry) => new Date(entry.timestamp).getTime() >= cutoffMs)
        .map((entry) => parseLeadingNumber(entry.headline)),
    ),
    stepsPerMinute,
  };
};

const averageNumbers = (values: number[]): number => {
  const safeValues = values.filter(Number.isFinite);
  if (safeValues.length === 0) {
    return 0;
  }

  return safeValues.reduce((total, value) => total + value, 0) / safeValues.length;
};

const parseLeadingNumber = (value: string): number => {
  const parsed = Number(value.split(' ')[0]);
  return Number.isFinite(parsed) ? parsed : 0;
};
