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

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const isChallengeSession = (value: unknown): value is ChallengeSession =>
  isRecord(value) &&
  typeof value.startedAt === 'string' &&
  typeof value.endedAt === 'string' &&
  isFiniteNumber(value.steps) &&
  isFiniteNumber(value.durationMs) &&
  (value.challengeGoal === undefined || isFiniteNumber(value.challengeGoal)) &&
  (value.source === undefined || isStepDataSource(value.source));
