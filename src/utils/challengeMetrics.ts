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
  sensorLog: Array<{ delta: number; timestamp: string }>;
};

export const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const getAccelerationMagnitude = (x: number, y: number, z: number): number =>
  Math.sqrt(x * x + y * y + z * z);

export const getVectorMagnitude = (x: number, y: number, z: number): number =>
  Math.sqrt(x * x + y * y + z * z);

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
    accelerometerMagnitude: averageNumbers(accelerometerLog
      .filter((entry) => new Date(entry.timestamp).getTime() >= cutoffMs)
      .map((entry) => entry.magnitude)),
    gyroscopeMagnitude: averageNumbers(gyroscopeLog
      .filter((entry) => new Date(entry.timestamp).getTime() >= cutoffMs)
      .map((entry) => parseLeadingNumber(entry.headline))),
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
