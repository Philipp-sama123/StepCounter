import { readBodyProfile } from '../../../storage/profileStorage';
import { readGoal, readLastSevenDays, readRecentDays } from '../../../storage/stepStorage';

import type { UserBodyProfile } from '../../profile/domain/models';
import type { StepHistoryEntry } from '../../steps/domain/models';

export type DashboardRange = 'month' | 'week' | 'year';
export type DashboardRangeTotals = Record<DashboardRange, number>;

const RANGE_DAYS: Record<DashboardRange, number> = { month: 30, week: 7, year: 365 };

export type DashboardSnapshot = {
  bodyProfile: UserBodyProfile | null;
  goal: number;
  graphHistory: StepHistoryEntry[];
  recentHistory: StepHistoryEntry[];
  totals: DashboardRangeTotals;
};

const sumSteps = (entries: StepHistoryEntry[]): number =>
  entries.reduce((total, entry) => total + Math.max(0, Math.floor(entry.steps)), 0);

export const readDashboardGraph = (range: DashboardRange): Promise<StepHistoryEntry[]> =>
  readRecentDays(RANGE_DAYS[range]);

export const readDashboardRecentHistory = (): Promise<StepHistoryEntry[]> => readLastSevenDays();

export const readDashboardRangeTotals = async (): Promise<DashboardRangeTotals> => {
  const [weekEntries, monthEntries, yearEntries] = await Promise.all([
    readRecentDays(RANGE_DAYS.week),
    readRecentDays(RANGE_DAYS.month),
    readRecentDays(RANGE_DAYS.year),
  ]);

  return {
    month: sumSteps(monthEntries),
    week: sumSteps(weekEntries),
    year: sumSteps(yearEntries),
  };
};

export const loadDashboardSnapshot = async (range: DashboardRange): Promise<DashboardSnapshot> => {
  const [bodyProfile, goal, graphHistory, recentHistory, totals] = await Promise.all([
    readBodyProfile(),
    readGoal(),
    readDashboardGraph(range),
    readDashboardRecentHistory(),
    readDashboardRangeTotals(),
  ]);

  return { bodyProfile, goal, graphHistory, recentHistory, totals };
};
