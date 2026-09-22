import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { DashboardAvatar } from '../../../components/avatar/DashboardAvatar';
import { AppScreen } from '../../../components/layout/AppScreen';
import { HeaderIconButton } from '../../../components/layout/HeaderIconButton';
import { PageHeader } from '../../../components/layout/PageHeader';
import { MetricCard } from '../../../components/ui/MetricCard';
import { SurfacePanel } from '../../../components/ui/SurfacePanel';
import { COLORS } from '../../../constants';
import { getAvatarStateForMotion } from '../../challenges/domain/motionActivity';
import { MotionDebugPanel } from '../../challenges/presentation/components/MotionDebugPanel';
import { useMotionChallengeCounter } from '../../challenges/presentation/useMotionChallengeCounter';

import { styles } from './SensorDiagnosticsScreen.styles';

export default function SensorDiagnosticsScreen() {
  const isFocused = useIsFocused();
  const sensor = useMotionChallengeCounter({ active: true, debugEnabled: true, enabled: isFocused });
  const { acceleration, gyroscope } = sensor.debug;

  return (
    <AppScreen contentStyle={styles.container}>
      <PageHeader
        accessory={
          <HeaderIconButton
            accessibilityLabel="Close sensor diagnostics"
            icon="close-outline"
            onPress={() => router.back()}
          />
        }
        subtitle="Developer tools"
        title="Sensor diagnostics"
      />

      <SurfacePanel style={styles.notice} tone={sensor.isAvailable ? 'primary' : 'warning'}>
        <Ionicons color={sensor.isAvailable ? COLORS.success : COLORS.warning} name="hardware-chip-outline" size={22} />
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>
            {sensor.isAvailable ? 'Motion sensors connected' : 'Accelerometer unavailable'}
          </Text>
          <Text style={styles.noticeText}>
            Move, walk, and run with the phone to verify the detector and avatar states in real time.
          </Text>
        </View>
      </SurfacePanel>

      <DashboardAvatar
        caption={`Detected state: ${sensor.activity}`}
        speed={sensor.speed}
        state={getAvatarStateForMotion(sensor.activity)}
      />

      <View style={styles.metricGrid}>
        <MetricCard label="Detected steps" style={styles.metricCard} value={sensor.steps.toLocaleString()} />
        <MetricCard label="Activity" style={styles.metricCard} value={sensor.activity} />
        <MetricCard label="Decision" style={styles.metricCard} value={sensor.debug.decision} />
        <MetricCard label="Samples" style={styles.metricCard} value={sensor.debug.samples.length.toLocaleString()} />
      </View>

      <MotionDebugPanel active debug={sensor.debug} />

      <SurfacePanel style={styles.rawPanel}>
        <Text style={styles.sectionTitle}>Raw sensor axes</Text>
        <Text style={styles.sectionSubtitle}>Values update directly from Expo Sensors.</Text>
        <SensorVectorRow label="Accelerometer (g)" x={acceleration.x} y={acceleration.y} z={acceleration.z} />
        <SensorVectorRow label="Gyroscope (rad/s)" x={gyroscope.x} y={gyroscope.y} z={gyroscope.z} />
      </SurfacePanel>

      <Text style={styles.privacyNote}>
        Sensor samples stay in memory and are not uploaded or saved by this diagnostics screen.
      </Text>
    </AppScreen>
  );
}

const SensorVectorRow = ({ label, x, y, z }: { label: string; x: number; y: number; z: number }) => (
  <View style={styles.vectorRow}>
    <Text style={styles.vectorLabel}>{label}</Text>
    <Text style={styles.vectorValue}>{`x ${x.toFixed(3)}   y ${y.toFixed(3)}   z ${z.toFixed(3)}`}</Text>
  </View>
);
