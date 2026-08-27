import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import { Accelerometer, DeviceMotion, Gyroscope, Magnetometer } from 'expo-sensors';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAuth } from '../../../auth/AuthContext';
import { AnimatedPressable } from '../../../components/AnimatedPressable';
import { SensorAvatar } from '../../../components/debug/SensorAvatar';
import { SyncDiagnosticRow } from '../../../components/debug/SyncDiagnosticRow';
import { AppScreen } from '../../../components/layout/AppScreen';
import { PageHeader } from '../../../components/layout/PageHeader';
import { RevealView } from '../../../components/RevealView';
import { SegmentedTabs } from '../../../components/SegmentedTabs';
import { ToastStack } from '../../../components/ToastMessage';
import { AVATAR_SPRITESHEET, AVATAR_SPRITESHEET_FOLDER } from '../../../config/avatarSprites';
import { COLORS, DEFAULT_GOAL } from '../../../constants';
import { readTodayStepsFromSystemHealth } from '../../../health/stepsProvider';
import { useCalculatedStepCounter } from '../../../hooks/useCalculatedStepCounter';
import { useStepCounter } from '../../../hooks/useStepCounter';
import { readSyncDiagnostics } from '../../../services/syncDiagnostics';
import { syncTodayAndBackfill } from '../../../services/syncService';
import { getVectorMagnitude } from '../../../shared/math/vector';
import { getTodayString, readGoal, readStepsForDate } from '../../../storage/stepStorage';
import { appendToastMessage } from '../../../utils/toastQueue';

import { styles } from './DiagnosticsScreen.styles';

import type { ToastMessageItem } from '../../../components/ToastMessage';
import type { StepDataSource } from '../../../health/types';
import type { DetectorSample } from '../../../hooks/useCalculatedStepCounter';
import type { SyncDiagnosticEntry } from '../../../services/syncDiagnostics';
import type { StepHistoryEntry } from '../../steps/domain/models';

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

type DebugView = 'calculated' | 'sensors' | 'sync';
type CalculatedPanelView = 'avatar' | 'bars';

export default function DebugScreen() {
  const isFocused = useIsFocused();
  const { debugMessage, sensorLog, source, todaySteps } = useStepCounter('live', isFocused);
  const { user } = useAuth();
  const [debugView, setDebugView] = useState<DebugView>('calculated');
  const [calculatedPanelView, setCalculatedPanelView] = useState<CalculatedPanelView>('avatar');
  const calculatedSteps = useCalculatedStepCounter(isFocused && debugView === 'calculated');
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [isSavingToFirestore, setIsSavingToFirestore] = useState(false);
  const [serverToastMessages, setServerToastMessages] = useState<ToastMessageItem[]>([]);
  const [syncDiagnostics, setSyncDiagnostics] = useState<SyncDiagnosticEntry[]>([]);
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
    const [localSteps, systemResult, savedGoal, diagnostics] = await Promise.all([
      readStepsForDate(getTodayString()),
      readTodayStepsFromSystemHealth(),
      readGoal(),
      readSyncDiagnostics(),
    ]);

    setGoal(savedGoal);
    setSyncDiagnostics(diagnostics);
    setReferences({
      localSteps,
      systemReason: systemResult.available
        ? `Loaded from ${getSourceLabel(systemResult.source)}.`
        : systemResult.reason,
      systemSource: systemResult.source,
      systemSteps: systemResult.available ? systemResult.steps : null,
      syncedAt: new Date().toISOString(),
    });
  }, []);

  const showServerToast = useCallback((message: string, variant: ToastMessageItem['variant'] = 'standard'): void => {
    setServerToastMessages((currentMessages) => appendToastMessage(currentMessages, { message, variant }));
  }, []);

  const hideServerToast = (id: number): void => {
    setServerToastMessages((currentMessages) => currentMessages.filter((message) => message.id !== id));
  };

  const handleSaveToFirestore = async (): Promise<void> => {
    setIsSavingToFirestore(true);
    try {
      const [localSteps, systemResult, savedGoal] = await Promise.all([
        readStepsForDate(getTodayString()),
        readTodayStepsFromSystemHealth(),
        readGoal(),
      ]);
      setGoal(savedGoal);
      setReferences({
        localSteps,
        systemReason: systemResult.available
          ? `Loaded from ${getSourceLabel(systemResult.source)}.`
          : systemResult.reason,
        systemSource: systemResult.source,
        systemSteps: systemResult.available ? systemResult.steps : null,
        syncedAt: new Date().toISOString(),
      });

      const result = await syncTodayAndBackfill({
        fallbackSource: source,
        fallbackSteps: Math.max(localSteps, todaySteps),
        userId: user?.uid ?? null,
      });
      setSyncDiagnostics(await readSyncDiagnostics());
      showServerToast(result.message, result.ok ? 'standard' : 'error');
    } finally {
      setIsSavingToFirestore(false);
    }
  };

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

    if (!isFocused || debugView !== 'sensors') {
      return () => {
        isMounted = false;
      };
    }

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
          setAccelerometerLog((currentLog) =>
            [
              {
                headline: `${formatAxis(magnitude)}g`,
                line: `x ${formatAxis(x)}  y ${formatAxis(y)}  z ${formatAxis(z)}`,
                timestamp: new Date().toISOString(),
              },
              ...currentLog,
            ].slice(0, 10),
          );
        });
      }

      if (hasGyroscope) {
        Gyroscope.setUpdateInterval(650);
        gyroscopeSubscription = Gyroscope.addListener(({ x, y, z }) => {
          const magnitude = getVectorMagnitude(x, y, z);
          setGyroscopeLog((currentLog) =>
            [
              {
                headline: `${formatAxis(magnitude)} rad/s`,
                line: `x ${formatAxis(x)}  y ${formatAxis(y)}  z ${formatAxis(z)}`,
                timestamp: new Date().toISOString(),
              },
              ...currentLog,
            ].slice(0, 10),
          );
        });
      }

      if (hasDeviceMotion) {
        DeviceMotion.setUpdateInterval(650);
        deviceMotionSubscription = DeviceMotion.addListener((measurement) => {
          const acceleration =
            getMotionVector(measurement.acceleration) ?? getMotionVector(measurement.accelerationIncludingGravity);
          if (acceleration === null) {
            return;
          }

          const magnitude = getVectorMagnitude(acceleration.x, acceleration.y, acceleration.z);
          setDeviceMotionLog((currentLog) =>
            [
              {
                headline: `${formatAxis(magnitude)} m/s2`,
                line: `acc ${formatAxis(acceleration.x)}/${formatAxis(acceleration.y)}/${formatAxis(acceleration.z)}`,
                timestamp: new Date().toISOString(),
              },
              ...currentLog,
            ].slice(0, 10),
          );
        });
      }

      if (hasMagnetometer) {
        Magnetometer.setUpdateInterval(650);
        magnetometerSubscription = Magnetometer.addListener(({ x, y, z }) => {
          const magnitude = getVectorMagnitude(x, y, z);
          setMagnetometerLog((currentLog) =>
            [
              {
                headline: `${formatAxis(magnitude)} uT`,
                line: `x ${formatAxis(x)}  y ${formatAxis(y)}  z ${formatAxis(z)}`,
                timestamp: new Date().toISOString(),
              },
              ...currentLog,
            ].slice(0, 10),
          );
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
  }, [debugView, isFocused]);

  return (
    <AppScreen
      contentStyle={styles.container}
      overlays={<ToastStack messages={serverToastMessages} onHide={hideServerToast} placement="center" />}
    >
      <PageHeader
        accessory={<Ionicons color={COLORS.challenge} name="bug-outline" size={28} />}
        subtitle="Debugging"
        title={getDebugTitle(debugView)}
      />

      <SegmentedTabs
        onChange={setDebugView}
        options={[
          { icon: 'calculator-outline', label: 'Calculated', value: 'calculated' },
          { icon: 'pulse-outline', label: 'Sensors', value: 'sensors' },
          { icon: 'sync-outline', label: 'Sync', value: 'sync' },
        ]}
        value={debugView}
      />

      {debugView === 'calculated' ? (
        <RevealView>
          <View style={styles.consoleSection}>
            <ConsoleHeader meta="experimental" title="Calculated step detector" />
            <Text style={styles.sectionText}>
              This counter watches acceleration peaks. A peak is accepted as a step only after a short warmup, when the
              timing looks walk-like, and when rotation is not too chaotic. It is saved separately from Health Connect.
            </Text>
            <SegmentedTabs
              onChange={setCalculatedPanelView}
              options={[
                { icon: 'person-outline', label: 'Avatar', value: 'avatar' },
                { icon: 'bar-chart-outline', label: 'Bars', value: 'bars' },
              ]}
              value={calculatedPanelView}
            />
            {calculatedPanelView === 'avatar' ? (
              <>
                <SensorAvatar
                  cadenceStepsPerMinute={calculatedSteps.cadenceStepsPerMinute}
                  confidence={calculatedSteps.confidence}
                  detectorDecision={calculatedSteps.detectorDecision}
                  detectorReason={calculatedSteps.detectorReason}
                  elapsedMsSinceStep={calculatedSteps.elapsedMsSinceStep}
                  motionG={calculatedSteps.lastMotionG}
                  spritesheet={AVATAR_SPRITESHEET}
                  userId={user?.uid ?? null}
                />
                {Object.values(AVATAR_SPRITESHEET.animations).some((animation) => animation.source === null) ? (
                  <Text style={styles.spriteHint}>
                    {`Drop idle.png, walk.png, and run.png into ${AVATAR_SPRITESHEET_FOLDER}, then set each source in src/config/avatarSprites.ts.`}
                  </Text>
                ) : null}
              </>
            ) : (
              <View style={styles.detectorPanel}>
                <View style={styles.detectorHeader}>
                  <Text style={styles.detectorTitle}>Current detector decision</Text>
                  <Text
                    style={[
                      styles.detectorPill,
                      calculatedSteps.detectorDecision === 'accepted' ? styles.detectorPillAccepted : null,
                    ]}
                  >
                    {calculatedSteps.detectorDecision}
                  </Text>
                </View>
                <Text style={styles.detectorReason}>{calculatedSteps.detectorReason}</Text>
                <View style={styles.sensorFlagRow}>
                  <SensorFlag active={calculatedSteps.isTimingTooFast} label="Too fast" />
                  <SensorFlag active={calculatedSteps.isRotationTooHigh} label="Too much rotation" />
                </View>
                <View style={styles.pipeline}>
                  <PipelineStep
                    active={calculatedSteps.sampleCount > 8}
                    label="1. Warmup"
                    value={`${Math.min(calculatedSteps.sampleCount, 8)}/8 samples`}
                  />
                  <PipelineStep
                    active={calculatedSteps.lastMotionG > calculatedSteps.motionThresholdG}
                    label="2. Motion peak"
                    value={`${formatAxis(calculatedSteps.lastMotionG)}g / ${formatAxis(calculatedSteps.motionThresholdG)}g`}
                  />
                  <PipelineStep
                    active={
                      calculatedSteps.elapsedMsSinceStep === null ||
                      calculatedSteps.elapsedMsSinceStep > 2200 ||
                      (calculatedSteps.elapsedMsSinceStep >= 260 && calculatedSteps.elapsedMsSinceStep <= 1400)
                    }
                    label="3. Step timing"
                    value={
                      calculatedSteps.elapsedMsSinceStep === null
                        ? 'first step'
                        : calculatedSteps.elapsedMsSinceStep > 2200
                          ? 'new sequence'
                          : `${calculatedSteps.elapsedMsSinceStep}ms`
                    }
                  />
                  <PipelineStep
                    active={calculatedSteps.lastRotationRadPerSecond < 7.5}
                    label="4. Rotation gate"
                    value={`${formatAxis(calculatedSteps.lastRotationRadPerSecond)} rad/s`}
                  />
                </View>
                <View style={styles.liveGraphStack}>
                  <SignalGraph
                    goodAbove
                    label="Motion signal"
                    limitLabel="threshold"
                    limitValue={calculatedSteps.motionThresholdG}
                    samples={calculatedSteps.samples.map((sample) => sample.motionG)}
                    valueLabel={`${formatAxis(calculatedSteps.lastMotionG)}g`}
                  />
                  <SignalGraph
                    label="Rotation gate"
                    limitLabel="max 7.5"
                    limitValue={7.5}
                    samples={calculatedSteps.samples.map((sample) => sample.rotationRadPerSecond)}
                    valueLabel={`${formatAxis(calculatedSteps.lastRotationRadPerSecond)} rad/s`}
                  />
                  <TimingGraph samples={calculatedSteps.samples} />
                </View>
              </View>
            )}
            <View style={styles.calculatedSummaryGrid}>
              <ReferenceCard label="Calculated" value={calculatedSteps.steps.toLocaleString()} />
              <ReferenceCard label="Cadence" value={`${calculatedSteps.cadenceStepsPerMinute}/min`} />
              <ReferenceCard label="Confidence" value={`${calculatedSteps.confidence}%`} />
            </View>
            <View style={styles.explainerGrid}>
              <ExplainerCard
                label="Acceleration"
                value={`${formatAxis(calculatedSteps.lastAccelerationG)}g`}
                text="Raw phone movement magnitude. The detector subtracts a moving gravity baseline from this."
              />
              <ExplainerCard
                label="Motion signal"
                value={`${formatAxis(calculatedSteps.lastMotionG)}g`}
                text="The cleaned signal used for peak detection. It must cross the adaptive threshold."
              />
              <ExplainerCard
                label="Saved as"
                value="debug only"
                text="This is not the official daily total. It is for tuning and comparing sensor behavior."
              />
            </View>
            <CalculatedHistoryChart history={calculatedSteps.history} todaySteps={calculatedSteps.steps} />
            <View style={styles.logBox}>
              {calculatedSteps.log.length > 0 ? (
                calculatedSteps.log.slice(0, 10).map((entry, index) => (
                  <View key={`${entry.timestamp}-${entry.steps}-${index}`} style={styles.logRow}>
                    <Text style={styles.logTime}>{formatLogTime(entry.timestamp)}</Text>
                    <Text
                      style={styles.logLine}
                    >{`accepted #${entry.steps.toLocaleString()}  motion ${formatAxis(entry.motionG)}>${formatAxis(entry.thresholdG)}g  rot ${formatAxis(entry.rotationRadPerSecond)}  conf ${entry.confidence}%`}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.logEmpty}>waiting for calculated step events...</Text>
              )}
            </View>
          </View>
        </RevealView>
      ) : debugView === 'sensors' ? (
        <>
          <RevealView style={styles.referencePanel}>
            <Text style={styles.sectionTitle}>Step references</Text>
            <Text style={styles.sectionText}>
              Compare the live pedometer value with local cache and system health data.
            </Text>
            <View style={styles.referenceGrid}>
              <ReferenceCard label="Live sensor" value={todaySteps.toLocaleString()} />
              <ReferenceCard label="Local cache" value={references.localSteps.toLocaleString()} />
              <ReferenceCard
                label={getSourceLabel(references.systemSource)}
                note={references.systemReason}
                value={references.systemSteps === null ? 'No data' : references.systemSteps.toLocaleString()}
              />
            </View>
            <AnimatedPressable
              accessibilityLabel="Save debug step reference to Firestore"
              accessibilityRole="button"
              disabled={isSavingToFirestore}
              onPress={() => {
                void handleSaveToFirestore();
              }}
              style={({ pressed }) => [
                styles.saveButton,
                isSavingToFirestore ? styles.saveButtonBusy : null,
                pressed ? styles.pressed : null,
              ]}
            >
              {isSavingToFirestore ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Ionicons color={COLORS.text} name="server-outline" size={18} />
              )}
              <Text style={styles.saveButtonText}>
                {isSavingToFirestore ? 'Saving' : 'Save reference to Firestore'}
              </Text>
            </AnimatedPressable>
            <Text
              style={styles.syncedText}
            >{`Checked ${formatSyncTime(references.syncedAt)} · app source ${getSourceLabel(source)}`}</Text>
            <Text
              style={styles.syncedText}
            >{`Daily goal ${goal.toLocaleString()} · saved source uses system health when available`}</Text>
          </RevealView>

          <RevealView delay={60}>
            <PedometerConsole log={sensorLog} />
          </RevealView>
          <RevealView delay={110}>
            <SensorConsole
              available={accelerometerAvailable}
              description="Acceleration on x/y/z in g. 1g is roughly Earth gravity."
              log={accelerometerLog}
              title="Accelerometer"
            />
          </RevealView>
          <RevealView delay={160}>
            <SensorConsole
              available={gyroscopeAvailable}
              description="Rotation speed around x/y/z in radians per second."
              log={gyroscopeLog}
              title="Gyroscope"
            />
          </RevealView>
          <RevealView delay={210}>
            <SensorConsole
              available={deviceMotionAvailable}
              description="Combined acceleration/orientation stream when available."
              log={deviceMotionLog}
              title="Device motion"
            />
          </RevealView>
          <RevealView delay={260}>
            <SensorConsole
              available={magnetometerAvailable}
              description="Magnetic field strength in microtesla, useful for orientation context."
              log={magnetometerLog}
              title="Magnetometer"
            />
          </RevealView>

          <Text style={styles.debugText}>{debugMessage}</Text>
        </>
      ) : (
        <RevealView>
          <View style={styles.consoleSection}>
            <ConsoleHeader meta="last 80" title="Sync diagnostics" />
            <Text style={styles.sectionText}>
              Shows what the sync service saw before writing Firestore: system health steps, previous Firestore value,
              final saved value, and why it changed or skipped.
            </Text>
            <View style={styles.syncAuditList}>
              {syncDiagnostics.length > 0 ? (
                syncDiagnostics.slice(0, 30).map((entry) => <SyncDiagnosticRow entry={entry} key={entry.id} />)
              ) : (
                <Text style={styles.emptyAuditText}>
                  No sync diagnostics yet. Press Save reference to Firestore or reopen the app.
                </Text>
              )}
            </View>
          </View>
        </RevealView>
      )}
    </AppScreen>
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
    {note === undefined ? null : (
      <Text style={styles.referenceNote} numberOfLines={2}>
        {note}
      </Text>
    )}
  </View>
);

const getDebugTitle = (debugView: DebugView): string => {
  if (debugView === 'calculated') {
    return 'Calculated steps';
  }

  if (debugView === 'sensors') {
    return 'Sensor data';
  }

  return 'Sync diagnostics';
};

const ExplainerCard = ({ label, text, value }: { label: string; text: string; value: string }) => (
  <View style={styles.explainerCard}>
    <Text style={styles.explainerLabel}>{label}</Text>
    <Text style={styles.explainerValue}>{value}</Text>
    <Text style={styles.explainerText}>{text}</Text>
  </View>
);

const PipelineStep = ({ active, label, value }: { active: boolean; label: string; value: string }) => (
  <View style={[styles.pipelineStep, active ? styles.pipelineStepActive : null]}>
    <View style={[styles.pipelineDot, active ? styles.pipelineDotActive : null]} />
    <View style={styles.pipelineCopy}>
      <Text style={styles.pipelineLabel}>{label}</Text>
      <Text style={styles.pipelineValue}>{value}</Text>
    </View>
  </View>
);

const SensorFlag = ({ active, label }: { active: boolean; label: string }) => (
  <View style={[styles.sensorFlag, active ? styles.sensorFlagActive : null]}>
    <Text style={[styles.sensorFlagText, active ? styles.sensorFlagTextActive : null]}>{label}</Text>
  </View>
);

const SignalGraph = ({
  goodAbove = false,
  label,
  limitLabel,
  limitValue,
  samples,
  valueLabel,
}: {
  goodAbove?: boolean;
  label: string;
  limitLabel: string;
  limitValue: number;
  samples: number[];
  valueLabel: string;
}) => {
  const maxValue = Math.max(limitValue * 1.4, ...samples, 1);
  const limitPercent = Math.max(0, Math.min(100, (limitValue / maxValue) * 100));

  return (
    <View style={styles.signalGraph}>
      <View style={styles.signalHeader}>
        <Text style={styles.signalTitle}>{label}</Text>
        <Text style={styles.signalValue}>{valueLabel}</Text>
      </View>
      <View style={styles.signalBars}>
        <View style={[styles.signalLimit, { bottom: `${limitPercent}%` }]} />
        {samples.slice(-32).map((sample, index) => {
          const height = Math.max(4, Math.min(100, (sample / maxValue) * 100));
          const passes = goodAbove ? sample >= limitValue : sample <= limitValue;

          return (
            <View
              key={`${index}-${sample}`}
              style={[styles.signalBar, passes ? styles.signalBarPass : styles.signalBarFail, { height: `${height}%` }]}
            />
          );
        })}
      </View>
      <Text style={styles.signalLimitLabel}>{limitLabel}</Text>
    </View>
  );
};

const TimingGraph = ({ samples }: { samples: DetectorSample[] }) => {
  const maxTimingMs = 2400;

  return (
    <View style={styles.signalGraph}>
      <View style={styles.signalHeader}>
        <Text style={styles.signalTitle}>Step timing</Text>
        <Text style={styles.signalValue}>260-1400ms · reset 2200ms</Text>
      </View>
      <View style={styles.signalBars}>
        <View style={[styles.signalLimit, styles.signalTimingMin, { bottom: `${(260 / maxTimingMs) * 100}%` }]} />
        <View style={[styles.signalLimit, { bottom: `${(1400 / maxTimingMs) * 100}%` }]} />
        {samples.slice(-32).map((sample, index) => {
          const elapsedMs = sample.elapsedMsSinceStep ?? 0;
          const height = Math.max(4, Math.min(100, (elapsedMs / maxTimingMs) * 100));
          const passes =
            sample.elapsedMsSinceStep !== null && (elapsedMs > 2200 || (elapsedMs >= 260 && elapsedMs <= 1400));

          return (
            <View
              key={`${index}-${sample.timestamp}`}
              style={[styles.signalBar, passes ? styles.signalBarPass : styles.signalBarFail, { height: `${height}%` }]}
            />
          );
        })}
      </View>
      <Text style={styles.signalLimitLabel}>walking window</Text>
    </View>
  );
};

const CalculatedHistoryChart = ({ history, todaySteps }: { history: StepHistoryEntry[]; todaySteps: number }) => {
  const entries = history.length > 0 ? history : [{ date: getTodayString(), dayName: 'Today', steps: todaySteps }];
  const maxSteps = Math.max(...entries.map((entry) => entry.steps), todaySteps, 1);

  return (
    <View style={styles.calculatedChart}>
      <View style={styles.calculatedChartHeader}>
        <Text style={styles.calculatedChartTitle}>Accepted peaks by day</Text>
        <Text style={styles.calculatedChartMeta}>{`${maxSteps.toLocaleString()} max`}</Text>
      </View>
      <View style={styles.calculatedBars}>
        {entries.map((entry) => {
          const isToday = entry.date === getTodayString();
          const barHeight = Math.max(8, Math.round((entry.steps / maxSteps) * 96));

          return (
            <View key={entry.date} style={styles.calculatedBarItem}>
              <View style={styles.calculatedBarTrack}>
                <View
                  style={[
                    styles.calculatedBarFill,
                    isToday ? styles.calculatedBarFillToday : null,
                    { height: barHeight },
                  ]}
                />
              </View>
              <Text style={styles.calculatedBarValue}>{entry.steps.toLocaleString()}</Text>
              <Text style={styles.calculatedBarLabel}>{isToday ? 'Today' : entry.dayName}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

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
      {log.length > 0 ? (
        log.slice(0, 10).map((entry, index) => (
          <View key={`${entry.timestamp}-${entry.rawSteps}-${index}`} style={styles.logRow}>
            <Text style={styles.logTime}>{formatLogTime(entry.timestamp)}</Text>
            <Text
              style={styles.logLine}
            >{`raw ${entry.rawSteps.toLocaleString()}  +${entry.delta.toLocaleString()}  total ${entry.totalSteps.toLocaleString()}`}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.logEmpty}>waiting for live pedometer events...</Text>
      )}
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
      {log.length > 0 ? (
        log.map((entry, index) => (
          <View key={`${entry.timestamp}-${index}`} style={styles.logRow}>
            <Text style={styles.logTime}>{formatLogTime(entry.timestamp)}</Text>
            <Text style={styles.logLine}>{entry.line}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.logEmpty}>
          {available === false
            ? `${title.toLowerCase()} unavailable on this device`
            : `waiting for ${title.toLowerCase()} events...`}
        </Text>
      )}
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

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const formatAxis = (value: number): string => value.toFixed(2);

const formatLogTime = (timestamp: string): string =>
  new Date(timestamp).toLocaleTimeString(undefined, {
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
