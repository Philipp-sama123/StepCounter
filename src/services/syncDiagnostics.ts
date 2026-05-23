import AsyncStorage from '@react-native-async-storage/async-storage';

import { StepDataSource } from '../health/types';

const SYNC_DIAGNOSTICS_KEY = 'sync:diagnostics';
const MAX_SYNC_DIAGNOSTIC_ENTRIES = 80;

export type SyncDiagnosticStatus = 'changed' | 'failed' | 'skipped';

export type SyncDiagnosticEntry = {
  date: string;
  existingSteps: number | null;
  finalSteps: number | null;
  id: string;
  reason: string;
  source: StepDataSource;
  status: SyncDiagnosticStatus;
  systemSteps: number | null;
  timestamp: string;
};

export const appendSyncDiagnostic = async (
  entry: Omit<SyncDiagnosticEntry, 'id' | 'timestamp'>,
): Promise<void> => {
  try {
    const currentEntries = await readSyncDiagnostics();
    const timestamp = new Date().toISOString();
    const nextEntry: SyncDiagnosticEntry = {
      ...entry,
      id: `${timestamp}-${entry.date}-${entry.status}`,
      timestamp,
    };

    await AsyncStorage.setItem(
      SYNC_DIAGNOSTICS_KEY,
      JSON.stringify([nextEntry, ...currentEntries].slice(0, MAX_SYNC_DIAGNOSTIC_ENTRIES)),
    );
  } catch (error) {
    console.warn('Unable to write sync diagnostics.', error);
  }
};

export const readSyncDiagnostics = async (): Promise<SyncDiagnosticEntry[]> => {
  try {
    const rawEntries = await AsyncStorage.getItem(SYNC_DIAGNOSTICS_KEY);
    const parsedEntries = rawEntries === null ? [] : JSON.parse(rawEntries);
    if (!Array.isArray(parsedEntries)) {
      return [];
    }

    return parsedEntries
      .map(parseSyncDiagnosticEntry)
      .filter((entry): entry is SyncDiagnosticEntry => entry !== null)
      .slice(0, MAX_SYNC_DIAGNOSTIC_ENTRIES);
  } catch (error) {
    console.warn('Unable to read sync diagnostics.', error);
    return [];
  }
};

const parseSyncDiagnosticEntry = (entry: unknown): SyncDiagnosticEntry | null => {
  if (typeof entry !== 'object' || entry === null) {
    return null;
  }

  const candidate = entry as Partial<SyncDiagnosticEntry>;
  if (
    typeof candidate.date !== 'string'
    || typeof candidate.id !== 'string'
    || typeof candidate.reason !== 'string'
    || !isSyncDiagnosticStatus(candidate.status)
    || !isStepDataSource(candidate.source)
    || typeof candidate.timestamp !== 'string'
  ) {
    return null;
  }

  return {
    date: candidate.date,
    existingSteps: toNullableNumber(candidate.existingSteps),
    finalSteps: toNullableNumber(candidate.finalSteps),
    id: candidate.id,
    reason: candidate.reason,
    source: candidate.source,
    status: candidate.status,
    systemSteps: toNullableNumber(candidate.systemSteps),
    timestamp: candidate.timestamp,
  };
};

const toNullableNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const isSyncDiagnosticStatus = (value: unknown): value is SyncDiagnosticStatus =>
  value === 'changed' || value === 'failed' || value === 'skipped';

const isStepDataSource = (value: unknown): value is StepDataSource =>
  value === 'apple-health' || value === 'health-connect' || value === 'live-sensor' || value === 'unavailable';
