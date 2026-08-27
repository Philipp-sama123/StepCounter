import { isRecord } from '../../../shared/validation/json';
import { isStepDataSource } from '../../steps/domain/models';

import type { StepDataSource } from '../../steps/domain/models';

export type ChallengeSession = {
  startedAt: string;
  endedAt: string;
  challengeGoal?: number;
  steps: number;
  durationMs: number;
  source?: StepDataSource;
};

export type StoredChallengeSession = ChallengeSession & {
  date: string;
  source?: StepDataSource;
};

export type WankReplayEvent = {
  combo: number;
  direction: 'down' | 'still' | 'up';
  motionG: number;
  offsetMs: number;
  rotationRadPerSecond: number;
  swingNumber: number;
};

export type WankReplaySample = {
  direction: 'down' | 'still' | 'up';
  motionG: number;
  offsetMs: number;
  passed: boolean;
  rotationRadPerSecond: number;
};

export type WankSession = {
  averageMotionG: number;
  averageRotationRadPerSecond: number;
  bestCombo: number;
  durationMs: number;
  endedAt: string;
  replayEvents?: WankReplayEvent[];
  replaySamples?: WankReplaySample[];
  startedAt: string;
  swings: number;
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const isChallengeSession = (value: unknown): value is ChallengeSession =>
  isRecord(value) &&
  typeof value.startedAt === 'string' &&
  typeof value.endedAt === 'string' &&
  isFiniteNumber(value.steps) &&
  isFiniteNumber(value.durationMs) &&
  (value.challengeGoal === undefined || isFiniteNumber(value.challengeGoal)) &&
  (value.source === undefined || isStepDataSource(value.source));

export const isWankSession = (value: unknown): value is WankSession =>
  isRecord(value) &&
  typeof value.startedAt === 'string' &&
  typeof value.endedAt === 'string' &&
  isFiniteNumber(value.averageMotionG) &&
  isFiniteNumber(value.averageRotationRadPerSecond) &&
  isFiniteNumber(value.bestCombo) &&
  isFiniteNumber(value.durationMs) &&
  isFiniteNumber(value.swings) &&
  (value.replayEvents === undefined || Array.isArray(value.replayEvents)) &&
  (value.replaySamples === undefined || Array.isArray(value.replaySamples));
