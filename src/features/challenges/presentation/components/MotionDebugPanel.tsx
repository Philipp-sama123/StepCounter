import { Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { SurfacePanel } from '../../../../components/ui/SurfacePanel';
import { COLORS } from '../../../../constants';
import { MOTION_DETECTOR_CONFIG } from '../../config/motionDetectorConfig';
import { styles } from '../ChallengeScreen.styles';

import type { MotionDebugSnapshot } from '../useMotionChallengeCounter';

type MotionDebugPanelProps = {
  active: boolean;
  debug: MotionDebugSnapshot;
};

const GRAPH_HEIGHT = 112;
const GRAPH_WIDTH = 320;
const MAX_GRAPH_VALUE = 0.42;

export const MotionDebugPanel = ({ active, debug }: MotionDebugPanelProps) => {
  const graphPath = toGraphPath(debug.samples.map((sample) => sample.motionG));
  const thresholdY = valueToY(debug.thresholdG);

  return (
    <SurfacePanel style={styles.motionDebugPanel} tone="warning">
      <View style={styles.motionDebugHeader}>
        <View>
          <Text style={styles.motionDebugTitle}>Motion debug</Text>
          <Text style={styles.motionDebugSubtitle}>
            {active ? 'Live samples while challenge is running' : 'Start a challenge to count steps'}
          </Text>
        </View>
        <Text style={[styles.motionDebugDecision, debug.decision === 'accepted' ? styles.motionDebugAccepted : null]}>
          {debug.decision}
        </Text>
      </View>

      <Svg height={GRAPH_HEIGHT} viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} width="100%">
        <Line
          stroke={COLORS.border}
          strokeWidth="1"
          x1="0"
          x2={GRAPH_WIDTH}
          y1={GRAPH_HEIGHT - 1}
          y2={GRAPH_HEIGHT - 1}
        />
        <Line
          stroke={COLORS.success}
          strokeDasharray="5 4"
          strokeWidth="1.5"
          x1="0"
          x2={GRAPH_WIDTH}
          y1={thresholdY}
          y2={thresholdY}
        />
        {graphPath === null ? null : <Path d={graphPath} fill="none" stroke={COLORS.primary} strokeWidth="2.5" />}
      </Svg>

      <View style={styles.motionDebugGrid}>
        <DebugValue label="Motion" value={`${debug.motionG.toFixed(3)} g`} />
        <DebugValue label="Threshold" value={`${debug.thresholdG.toFixed(3)} g`} />
        <DebugValue label="Acceleration" value={`${debug.accelerationG.toFixed(3)} g`} />
        <DebugValue label="Rotation" value={`${debug.rotationRadPerSecond.toFixed(2)} rad/s`} />
      </View>
      <Text style={styles.motionDebugHint}>
        White line: live motion · Green dash: step threshold · Rotation must stay under{' '}
        {MOTION_DETECTOR_CONFIG.rotationLimitRadPerSecond.toFixed(1)} rad/s.
      </Text>
    </SurfacePanel>
  );
};

const DebugValue = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.motionDebugValue}>
    <Text style={styles.motionDebugValueLabel}>{label}</Text>
    <Text style={styles.motionDebugValueText}>{value}</Text>
  </View>
);

const toGraphPath = (values: number[]): string | null => {
  if (values.length < 2) {
    return null;
  }

  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * GRAPH_WIDTH;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${valueToY(value).toFixed(1)}`;
    })
    .join(' ');
};

const valueToY = (value: number): number =>
  GRAPH_HEIGHT - Math.min(1, Math.max(0, value / MAX_GRAPH_VALUE)) * (GRAPH_HEIGHT - 8) - 4;
