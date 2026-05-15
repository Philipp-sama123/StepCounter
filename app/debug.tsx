import { Ionicons } from '@expo/vector-icons';
import { Accelerometer, DeviceMotion, Gyroscope, Magnetometer } from 'expo-sensors';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RevealView } from '../src/components/RevealView';
import { StepTrendChart } from '../src/components/StepTrendChart';
import { COLORS } from '../src/constants';
import { readTodayStepsFromSystemHealth } from '../src/health/stepsProvider';
import { StepDataSource } from '../src/health/types';
import { useCalculatedStepCounter } from '../src/hooks/useCalculatedStepCounter';
import { useStepCounter } from '../src/hooks/useStepCounter';
import { getTodayString, readStepsForDate } from '../src/storage/stepStorage';

type SensorSample = {
  headline: string;
  line: string;
  timestamp: string;
};

type StepReferenceState = {
  localSteps: number;
  systemReason: string;
  systemSource: StepDataSource;
  systemSteps: number | null;
  syncedAt: string | null;
};

export default function DebugScreen() {
  const { debugMessage, sensorLog, source, todaySteps } = useStepCounter('live');
  const calculatedSteps = useCalculatedStepCounter();
  const [references, setReferences] = useState<StepReferenceState>({
    localSteps: 0,
    systemReason: 'Loading references...',
    systemSource: 'unavailable',
    systemSteps: null,
    syncedAt: null,
  });
  const [accelerometerAvailable, setAccelerometerAvailable] = useState<boolean | null>(null);
  const [accelerometerLog, setAccelerometerLog] = useState<SensorSample[]>([]);
  const [gyroscopeAvailable, setGyroscopeAvailable] = useState<boolean | null>(null);
  const [gyroscopeLog, setGyroscopeLog] = useState<SensorSample[]>([]);
  const [deviceMotionAvailable, setDeviceMotionAvailable] = useState<boolean | null>(null);
  const [deviceMotionLog, setDeviceMotionLog] = useState<SensorSample[]>([]);
  const [magnetometerAvailable, setMagnetometerAvailable] = useState<boolean | null>(null);
  const [magnetometerLog, setMagnetometerLog] = useState<SensorSample[]>([]);

  const loadReferences = useCallback(async (): Promise<void> => {
    const [localSteps, systemResult] = await Promise.all([
      readStepsForDate(getTodayString()),
      readTodayStepsFromSystemHealth(),
    ]);

    setReferences({
      localSteps,
      systemReason: systemResult.available ? `Loaded from ${getSourceLabel(systemResult.source)}.` : systemResult.reason,
      systemSource: systemResult.source,
      systemSteps: systemResult.available ? systemResult.steps : null,
      syncedAt: new Date().toISOString(),
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadReferences();
    }, [loadReferences]),
  );

  useEffect(() => {
    let isMounted = true;
    let accelerometerSubscription: ReturnType<typeof Accelerometer.addListener> | null = null;
    let gyroscopeSubscription: ReturnType<typeof Gyroscope.addListener> | null = null;
    let deviceMotionSubscription: ReturnType<typeof DeviceMotion.addListener> | null = null;
    let magnetometerSubscription: ReturnType<typeof Magnetometer.addListener> | null = null;

    const startSensors = async (): Promise<void> => {
      const [hasAccelerometer, hasGyroscope, hasDeviceMotion, hasMagnetometer] = await Promise.all([
        Accelerometer.isAvailableAsync(),
        Gyroscope.isAvailableAsync(),
        DeviceMotion.isAvailableAsync(),
        Magnetometer.isAvailableAsync(),
      ]);

      if (!isMounted) {
        return;
      }

      setAccelerometerAvailable(hasAccelerometer);
      setGyroscopeAvailable(hasGyroscope);
      setDeviceMotionAvailable(hasDeviceMotion);
      setMagnetometerAvailable(hasMagnetometer);

      if (hasAccelerometer) {
        Accelerometer.setUpdateInterval(650);
        accelerometerSubscription = Accelerometer.addListener(({ x, y, z }) => {
          const magnitude = getVectorMagnitude(x, y, z);
          setAccelerometerLog((currentLog) => [{
            headline: `${formatAxis(magnitude)}g`,
            line: `x ${formatAxis(x)}  y ${formatAxis(y)}  z ${formatAxis(z)}`,
            timestamp: new Date().toISOString(),
          }, ...currentLog].slice(0, 10));
        });
      }

      if (hasGyroscope) {
        Gyroscope.setUpdateInterval(650);
        gyroscopeSubscription = Gyroscope.addListener(({ x, y, z }) => {
          const magnitude = getVectorMagnitude(x, y, z);
          setGyroscopeLog((currentLog) => [{
            headline: `${formatAxis(magnitude)} rad/s`,
            line: `x ${formatAxis(x)}  y ${formatAxis(y)}  z ${formatAxis(z)}`,
            timestamp: new Date().toISOString(),
          }, ...currentLog].slice(0, 10));
        });
      }

      if (hasDeviceMotion) {
        DeviceMotion.setUpdateInterval(650);
        deviceMotionSubscription = DeviceMotion.addListener((measurement) => {
          const acceleration = getMotionVector(measurement.acceleration) ?? getMotionVector(measurement.accelerationIncludingGravity);
          if (acceleration === null) {
            return;
          }

          const magnitude = getVectorMagnitude(acceleration.x, acceleration.y, acceleration.z);
          setDeviceMotionLog((currentLog) => [{
            headline: `${formatAxis(magnitude)} m/s2`,
            line: `acc ${formatAxis(acceleration.x)}/${formatAxis(acceleration.y)}/${formatAxis(acceleration.z)}`,
            timestamp: new Date().toISOString(),
          }, ...currentLog].slice(0, 10));
        });
      }

      if (hasMagnetometer) {
        Magnetometer.setUpdateInterval(650);
        magnetometerSubscription = Magnetometer.addListener(({ x, y, z }) => {
          const magnitude = getVectorMagnitude(x, y, z);
          setMagnetometerLog((currentLog) => [{
            headline: `${formatAxis(magnitude)} uT`,
            line: `x ${formatAxis(x)}  y ${formatAxis(y)}  z ${formatAxis(z)}`,
            timestamp: new Date().toISOString(),
          }, ...currentLog].slice(0, 10));
        });
      }
    };

    void startSensors();

    return () => {
      isMounted = false;
      accelerometerSubscription?.remove();
      gyroscopeSubscription?.remove();
      deviceMotionSubscription?.remove();
      magnetometerSubscription?.remove();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>Debugging</Text>
            <Text style={styles.title}>Sensor data</Text>
          </View>
          <Ionicons color={COLORS.challenge} name="bug-outline" size={28} />
        </View>

        <RevealView style={styles.referencePanel}>
          <Text style={styles.sectionTitle}>Step references</Text>
          <Text style={styles.sectionText}>Compare the live pedometer value with local cache and system health data.</Text>
          <View style={styles.referenceGrid}>
            <ReferenceCard label="Live sensor" value={todaySteps.toLocaleString()} />
            <ReferenceCard label="Local cache" value={references.localSteps.toLocaleString()} />
            <ReferenceCard
              label={getSourceLabel(references.systemSource)}
              note={references.systemReason}
              value={references.systemSteps === null ? 'No data' : references.systemSteps.toLocaleString()}
            />
          </View>
          <Text style={styles.syncedText}>{`Checked ${formatSyncTime(references.syncedAt)} · app source ${getSourceLabel(source)}`}</Text>
        </RevealView>

        <RevealView delay={60}>
          <PedometerConsole log={sensorLog} />
        </RevealView>
        <RevealView delay={110}>
          <View style={styles.consoleSection}>
            <ConsoleHeader meta="saved locally" title="Calculated step history" />
            <Text style={styles.sectionText}>Experimental acceleration and rotation-based steps, stored separately from Health Connect and live pedometer totals.</Text>
            <View style={styles.calculatedSummaryGrid}>
              <ReferenceCard label="Calculated" value={calculatedSteps.steps.toLocaleString()} />
              <ReferenceCard label="Cadence" value={`${calculatedSteps.cadenceStepsPerMinute}/min`} />
              <ReferenceCard label="Confidence" value={`${calculatedSteps.confidence}%`} />
            </View>
            <StepTrendChart
              animationKey={calculatedSteps.steps}
              goal={Math.max(1, references.systemSteps ?? todaySteps)}
              history={calculatedSteps.history}
            />
            <View style={styles.logBox}>
              {calculatedSteps.log.length > 0 ? calculatedSteps.log.slice(0, 10).map((entry, index) => (
                <View key={`${entry.timestamp}-${entry.steps}-${index}`} style={styles.logRow}>
                  <Text style={styles.logTime}>{formatLogTime(entry.timestamp)}</Text>
                  <Text style={styles.logLine}>{`calc ${entry.steps.toLocaleString()}  acc ${formatAxis(entry.accelerationG)}g  rot ${formatAxis(entry.rotationRadPerSecond)} rad/s`}</Text>
                </View>
              )) : <Text style={styles.logEmpty}>waiting for calculated step events...</Text>}
            </View>
          </View>
        </RevealView>
        <RevealView delay={160}>
          <SensorConsole available={accelerometerAvailable} description="Acceleration on x/y/z in g. 1g is roughly Earth gravity." log={accelerometerLog} title="Accelerometer" />
        </RevealView>
        <RevealView delay={210}>
          <SensorConsole available={gyroscopeAvailable} description="Rotation speed around x/y/z in radians per second." log={gyroscopeLog} title="Gyroscope" />
        </RevealView>
        <RevealView delay={260}>
          <SensorConsole available={deviceMotionAvailable} description="Combined acceleration/orientation stream when available." log={deviceMotionLog} title="Device motion" />
        </RevealView>
        <RevealView delay={310}>
          <SensorConsole available={magnetometerAvailable} description="Magnetic field strength in microtesla, useful for orientation context." log={magnetometerLog} title="Magnetometer" />
        </RevealView>

        <Text style={styles.debugText}>{debugMessage}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

type ReferenceCardProps = {
  label: string;
  note?: string;
  value: string;
};

const ReferenceCard = ({ label, note, value }: ReferenceCardProps) => (
  <View style={styles.referenceCard}>
    <Text style={styles.referenceLabel}>{label}</Text>
    <Text style={styles.referenceValue}>{value}</Text>
    {note === undefined ? null : <Text style={styles.referenceNote} numberOfLines={2}>{note}</Text>}
  </View>
);

type PedometerLog = {
  delta: number;
  rawSteps: number;
  timestamp: string;
  totalSteps: number;
};

const PedometerConsole = ({ log }: { log: PedometerLog[] }) => (
  <View style={styles.consoleSection}>
    <ConsoleHeader meta="last 10" title="Pedometer log" />
    <Text style={styles.sectionText}>Raw step events, delta since the previous event, and the app total.</Text>
    <View style={styles.logBox}>
      {log.length > 0 ? log.slice(0, 10).map((entry, index) => (
        <View key={`${entry.timestamp}-${entry.rawSteps}-${index}`} style={styles.logRow}>
          <Text style={styles.logTime}>{formatLogTime(entry.timestamp)}</Text>
          <Text style={styles.logLine}>{`raw ${entry.rawSteps.toLocaleString()}  +${entry.delta.toLocaleString()}  total ${entry.totalSteps.toLocaleString()}`}</Text>
        </View>
      )) : <Text style={styles.logEmpty}>waiting for live pedometer events...</Text>}
    </View>
  </View>
);

type SensorConsoleProps = {
  available: boolean | null;
  description: string;
  log: SensorSample[];
  title: string;
};

const SensorConsole = ({ available, description, log, title }: SensorConsoleProps) => (
  <View style={styles.consoleSection}>
    <ConsoleHeader meta={available === false ? 'unavailable' : 'last 10'} title={title} />
    <Text style={styles.sectionText}>{description}</Text>
    {log.length > 0 ? (
      <View style={styles.currentBox}>
        <Text style={styles.currentValue}>{log[0].headline}</Text>
        <Text style={styles.currentLabel}>current magnitude</Text>
      </View>
    ) : null}
    <View style={styles.logBox}>
      {log.length > 0 ? log.map((entry, index) => (
        <View key={`${entry.timestamp}-${index}`} style={styles.logRow}>
          <Text style={styles.logTime}>{formatLogTime(entry.timestamp)}</Text>
          <Text style={styles.logLine}>{entry.line}</Text>
        </View>
      )) : <Text style={styles.logEmpty}>{available === false ? `${title.toLowerCase()} unavailable on this device` : `waiting for ${title.toLowerCase()} events...`}</Text>}
    </View>
  </View>
);

const ConsoleHeader = ({ meta, title }: { meta: string; title: string }) => (
  <View style={styles.consoleHeader}>
    <Text style={styles.consoleTitle}>{title}</Text>
    <Text style={styles.consoleMeta}>{meta}</Text>
  </View>
);

type MotionVector = {
  x: number;
  y: number;
  z: number;
};

const getMotionVector = (value: unknown): MotionVector | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const vector = value as Partial<MotionVector>;
  if (!isFiniteNumber(vector.x) || !isFiniteNumber(vector.y) || !isFiniteNumber(vector.z)) {
    return null;
  }

  return { x: vector.x, y: vector.y, z: vector.z };
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const getVectorMagnitude = (x: number, y: number, z: number): number =>
  Math.sqrt(x * x + y * y + z * z);

const formatAxis = (value: number): string => value.toFixed(2);

const formatLogTime = (timestamp: string): string => new Date(timestamp).toLocaleTimeString(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const formatSyncTime = (timestamp: string | null): string => {
  if (timestamp === null) {
    return 'not loaded';
  }

  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
};

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
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    gap: 14,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: 14,
    fontWeight: '800',
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '900',
  },
  referencePanel: {
    backgroundColor: COLORS.challengeSoft,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  referenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  referenceCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 78,
    padding: 10,
    width: '31%',
  },
  referenceLabel: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 5,
  },
  referenceValue: {
    color: COLORS.challenge,
    fontSize: 16,
    fontWeight: '900',
  },
  referenceNote: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
    marginTop: 4,
  },
  syncedText: {
    color: COLORS.challenge,
    fontSize: 11,
    fontWeight: '800',
  },
  consoleSection: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  sectionTitle: {
    color: COLORS.challenge,
    fontSize: 15,
    fontWeight: '900',
  },
  sectionText: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  consoleHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  consoleTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  consoleMeta: {
    color: COLORS.challenge,
    fontSize: 12,
    fontWeight: '800',
  },
  currentBox: {
    alignItems: 'center',
    backgroundColor: COLORS.challengeSoft,
    borderColor: COLORS.challenge,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
  },
  currentValue: {
    color: COLORS.challenge,
    fontFamily: 'monospace',
    fontSize: 22,
    fontWeight: '900',
  },
  currentLabel: {
    color: COLORS.challenge,
    fontSize: 11,
    fontWeight: '800',
  },
  calculatedSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  logBox: {
    backgroundColor: '#08110D',
    borderColor: '#173528',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  logTime: {
    color: '#7CE7A8',
    fontFamily: 'monospace',
    fontSize: 12,
    width: 72,
  },
  logLine: {
    color: '#D9FFE8',
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  logEmpty: {
    color: '#7CE7A8',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  debugText: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
});
