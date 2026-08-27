import type { UserBodyProfile } from '../features/profile/domain/models';

const DEFAULT_STEP_LENGTH_METERS = 0.75;
const WALKING_KCAL_PER_KG_KM = 0.57;

export const estimateWalkingCalories = (steps: number, profile: UserBodyProfile | null): number => {
  const weightKg = profile?.currentWeightKg ?? 0;
  if (steps <= 0 || weightKg <= 0) {
    return 0;
  }

  const stepLengthMeters = getStepLengthMeters(profile?.heightCm ?? 0);
  const distanceKm = (Math.max(0, Math.floor(steps)) * stepLengthMeters) / 1000;
  return Math.round(distanceKm * weightKg * WALKING_KCAL_PER_KG_KM);
};

const getStepLengthMeters = (heightCm: number): number => {
  if (heightCm <= 0) {
    return DEFAULT_STEP_LENGTH_METERS;
  }

  return (heightCm * 0.414) / 100;
};
