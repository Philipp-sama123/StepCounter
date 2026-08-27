import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../../constants';

import type { StepDataSource } from '../../health/types';
import type { SyncDiagnosticEntry } from '../../services/syncDiagnostics';

type SyncDiagnosticRowProps = {
  entry: SyncDiagnosticEntry;
};

export const SyncDiagnosticRow = ({ entry }: SyncDiagnosticRowProps) => (
  <View style={styles.auditRow}>
    <View style={styles.auditHeader}>
      <View>
        <Text style={styles.auditDate}>{entry.date}</Text>
        <Text style={styles.auditTime}>{formatLogTime(entry.timestamp)}</Text>
      </View>
      <Text
        style={[
          styles.auditStatus,
          entry.status === 'changed' ? styles.auditStatusChanged : null,
          entry.status === 'failed' ? styles.auditStatusFailed : null,
        ]}
      >
        {entry.status}
      </Text>
    </View>
    <View style={styles.auditMetrics}>
      <AuditMetric label="Health" value={formatNullableSteps(entry.systemSteps)} />
      <AuditMetric label="Firestore" value={formatNullableSteps(entry.existingSteps)} />
      <AuditMetric label="Final" value={formatNullableSteps(entry.finalSteps)} />
    </View>
    <Text style={styles.auditReason}>{`${entry.reason} · ${getSourceLabel(entry.source)}`}</Text>
  </View>
);

const AuditMetric = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.auditMetric}>
    <Text style={styles.auditMetricLabel}>{label}</Text>
    <Text style={styles.auditMetricValue}>{value}</Text>
  </View>
);

const formatLogTime = (timestamp: string): string =>
  new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const formatNullableSteps = (steps: number | null): string => (steps === null ? '-' : steps.toLocaleString());

const getSourceLabel = (source: StepDataSource): string => {
  if (source === 'apple-health') {
    return 'Apple Health';
  }

  if (source === 'health-connect') {
    return 'Health Connect';
  }

  if (source === 'live-sensor') {
    return 'Live sensor';
  }

  return 'Unavailable';
};

const styles = StyleSheet.create({
  auditRow: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    padding: 11,
  },
  auditHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  auditDate: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },
  auditTime: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  auditStatus: {
    backgroundColor: COLORS.stoppedSoft,
    borderRadius: 999,
    color: COLORS.stopped,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  auditStatusChanged: {
    backgroundColor: COLORS.successSoft,
    color: COLORS.success,
  },
  auditStatusFailed: {
    backgroundColor: COLORS.challengeSoft,
    color: COLORS.danger,
  },
  auditMetrics: {
    flexDirection: 'row',
    gap: 8,
  },
  auditMetric: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  auditMetricLabel: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 3,
  },
  auditMetricValue: {
    color: COLORS.challenge,
    fontSize: 13,
    fontWeight: '900',
  },
  auditReason: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
});
