export type UserBodyProfile = {
  currentWeightKg: number;
  heightCm: number;
  updatedAt?: string;
  weightTrackingEnabled: boolean;
};

export type WeightEntry = {
  date: string;
  id: string;
  timestamp: string;
  weightKg: number;
};
