export type StepReconciliationPolicy = 'highest-wins' | 'incoming-authoritative';

export const normalizeStepCount = (steps: number): number =>
  Number.isFinite(steps) ? Math.max(0, Math.floor(steps)) : 0;

export const reconcileStepTotal = ({
  existingSteps,
  incomingSteps,
  policy = 'highest-wins',
}: {
  existingSteps?: number;
  incomingSteps: number;
  policy?: StepReconciliationPolicy;
}): number => {
  const normalizedIncoming = normalizeStepCount(incomingSteps);
  return policy === 'incoming-authoritative'
    ? normalizedIncoming
    : Math.max(normalizeStepCount(existingSteps ?? 0), normalizedIncoming);
};
