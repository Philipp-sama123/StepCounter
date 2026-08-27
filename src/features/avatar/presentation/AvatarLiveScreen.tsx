import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useAuth } from '../../../auth/AuthContext';
import { AnimatedPressable } from '../../../components/AnimatedPressable';
import { AppScreen } from '../../../components/layout/AppScreen';
import { PageHeader } from '../../../components/layout/PageHeader';
import { SurfacePanel } from '../../../components/ui/SurfacePanel';
import { AVATAR_STORAGE_KEY, AVATAR_VARIANTS, DEFAULT_AVATAR_VARIANT_KEY } from '../../../config/avatarSprites';
import { COLORS } from '../../../constants';
import { readAvatarPreferenceFromFirestore, saveAvatarPreferenceToFirestore } from '../../../firebase/avatarPreference';
import { CALCULATED_STEP_DETECTOR_LIMITS, useCalculatedStepCounter } from '../../../hooks/useCalculatedStepCounter';
import { userScopedStorage as AsyncStorage } from '../../../platform/storage/userScopedStorage';

import { AVATAR_SIZE, RING_SIZE, RING_STROKE } from './AvatarLiveScreen.layout';
import { styles } from './AvatarLiveScreen.styles';

import type { AvatarAnimationConfig, AvatarAnimationKey, AvatarVariantKey } from '../../../config/avatarSprites';
import type { DetectorSample } from '../../../hooks/useCalculatedStepCounter';
import type { ImageSourcePropType } from 'react-native';

type RingGeometry = {
  circumference: number;
  radius: number;
  strokeDashoffset: Animated.AnimatedInterpolation<string | number>;
};

const STOPPED_AFTER_MS = 2200;
const WALK_HOLD_MS = 2000;
const RUN_CADENCE = 155;
const RUN_MOTION_G = 0.38;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function LiveAvatarScreen() {
  const { user } = useAuth();
  const calculatedSteps = useCalculatedStepCounter(true);
  const [lastAcceptedAt, setLastAcceptedAt] = useState(0);
  const [selectedAvatarKey, setSelectedAvatarKey] = useState<AvatarVariantKey>(DEFAULT_AVATAR_VARIANT_KEY);
  const [frameIndex, setFrameIndex] = useState(0);
  const nowMs = Date.now();
  const isWalkingHeld =
    calculatedSteps.detectorDecision !== 'accepted' && lastAcceptedAt > 0 && nowMs - lastAcceptedAt < WALK_HOLD_MS;
  const displayDecision = isWalkingHeld ? 'accepted' : calculatedSteps.detectorDecision;
  const displayReason = isWalkingHeld ? 'Recently accepted a step.' : calculatedSteps.detectorReason;
  const animationKey = getAvatarAnimationKey({
    cadenceStepsPerMinute: calculatedSteps.cadenceStepsPerMinute,
    detectorDecision: displayDecision,
    elapsedMsSinceStep: calculatedSteps.elapsedMsSinceStep,
    motionG: calculatedSteps.lastMotionG,
  });
  const selectedVariant = AVATAR_VARIANTS.find((variant) => variant.key === selectedAvatarKey) ?? AVATAR_VARIANTS[0];
  const animation = selectedVariant.spritesheet.animations[animationKey];
  const ringProgress = useRef(new Animated.Value(calculatedSteps.confidence / 100)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const ring = useMemo(() => getRingGeometry(ringProgress), [ringProgress]);
  const statusLabel = getDetectorStatusLabel(displayDecision, displayReason);

  useEffect(() => {
    if (calculatedSteps.detectorDecision === 'accepted') {
      setLastAcceptedAt(Date.now());
    }
  }, [calculatedSteps.detectorDecision, calculatedSteps.elapsedMsSinceStep]);

  useEffect(() => {
    let isMounted = true;

    const loadSelectedAvatar = async (): Promise<void> => {
      const [storedKey, remoteKey] = await Promise.all([
        AsyncStorage.getItem(AVATAR_STORAGE_KEY),
        user?.uid === undefined ? Promise.resolve(null) : readAvatarPreferenceFromFirestore(user.uid),
      ]);
      const nextKey = remoteKey ?? (isAvatarVariantKey(storedKey) ? storedKey : null);

      if (isMounted && nextKey !== null) {
        setSelectedAvatarKey(nextKey);
        await AsyncStorage.setItem(AVATAR_STORAGE_KEY, nextKey);
      }
    };

    void loadSelectedAvatar();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    setFrameIndex(0);
    const frameDurationMs = Math.max(60, Math.round(1000 / animation.fps));
    const timer = setInterval(() => {
      setFrameIndex((currentFrame) => (currentFrame + 1) % animation.frameCount);
    }, frameDurationMs);

    return () => clearInterval(timer);
  }, [animation.frameCount, animation.fps, animationKey, selectedAvatarKey]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ringProgress, {
        duration: 360,
        toValue: calculatedSteps.confidence / 100,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.spring(pulseScale, {
          friction: 6,
          tension: 150,
          toValue: animationKey === 'idle' ? 1 : 1.045,
          useNativeDriver: true,
        }),
        Animated.spring(pulseScale, {
          friction: 7,
          tension: 140,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [animationKey, calculatedSteps.confidence, pulseScale, ringProgress]);

  const selectAvatar = (avatarKey: AvatarVariantKey): void => {
    setSelectedAvatarKey(avatarKey);
    void AsyncStorage.setItem(AVATAR_STORAGE_KEY, avatarKey);
    if (user?.uid !== undefined) {
      void saveAvatarPreferenceToFirestore(user.uid, avatarKey);
    }
  };

  return (
    <AppScreen contentStyle={styles.container}>
      <PageHeader
        accessory={
          <AnimatedPressable
            accessibilityLabel="Back to debug"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons color={COLORS.text} name="close-outline" size={24} />
          </AnimatedPressable>
        }
        subtitle="Calculated sensor detector"
        title="Live avatar"
      />

      <SurfacePanel style={styles.heroPanel}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.avatarName}>{selectedVariant.label}</Text>
            <Text style={styles.avatarStatus}>{statusLabel}</Text>
          </View>
          <Text style={[styles.statePill, styles[`${animationKey}Pill`]]}>{animationKey}</Text>
        </View>

        <View style={styles.avatarStage}>
          <Svg height={RING_SIZE} style={styles.progressRing} width={RING_SIZE}>
            <Defs>
              <LinearGradient id="liveAvatarCircleGradient" x1="0" x2="1" y1="0" y2="1">
                <Stop offset="0" stopColor={COLORS.avatarGradientStart} />
                <Stop offset="0.58" stopColor={COLORS.avatarGradientMiddle} />
                <Stop offset="1" stopColor={COLORS.avatarGradientEnd} />
              </LinearGradient>
            </Defs>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              fill="url(#liveAvatarCircleGradient)"
              r={ring.radius - RING_STROKE}
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              fill="none"
              r={ring.radius}
              stroke={COLORS.border}
              strokeWidth={RING_STROKE}
            />
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              fill="none"
              r={ring.radius}
              stroke={getStateColor(animationKey)}
              strokeDasharray={ring.circumference}
              strokeDashoffset={ring.strokeDashoffset}
              strokeLinecap="round"
              strokeWidth={RING_STROKE}
            />
          </Svg>
          <Animated.View style={[styles.avatarFrame, { transform: [{ scale: pulseScale }] }]}>
            {animation.source === null ? (
              <FallbackAvatar animationKey={animationKey} />
            ) : (
              <SpriteFrame
                animation={animation}
                frameHeight={selectedVariant.spritesheet.frameHeight}
                frameIndex={frameIndex}
                frameWidth={selectedVariant.spritesheet.frameWidth}
                source={animation.source}
              />
            )}
          </Animated.View>
        </View>
      </SurfacePanel>

      <View style={styles.metricsGrid}>
        <Metric label="Steps" value={calculatedSteps.steps.toLocaleString()} />
        <Metric label="Cadence" value={`${calculatedSteps.cadenceStepsPerMinute}/min`} />
        <Metric label="Confidence" value={`${calculatedSteps.confidence}%`} />
        <Metric label="Motion" value={`${calculatedSteps.lastMotionG.toFixed(2)}g`} />
        <Metric label="Rotation" value={`${calculatedSteps.lastRotationRadPerSecond.toFixed(2)} rad/s`} />
        <Metric label="Threshold" value={`${calculatedSteps.motionThresholdG.toFixed(2)}g`} />
      </View>

      <SurfacePanel style={styles.reasonPanel}>
        <Text style={styles.reasonTitle}>Detector status</Text>
        <Text style={styles.reasonText}>{displayReason}</Text>
        <Text style={styles.reasonMeta}>{calculatedSteps.debugMessage}</Text>
      </SurfacePanel>

      <SurfacePanel style={styles.graphPanel}>
        <View style={styles.graphPanelHeader}>
          <View>
            <Text style={styles.graphPanelTitle}>Movement thresholds</Text>
            <Text style={styles.graphPanelSubtitle}>Live samples used by the calculated step detector.</Text>
          </View>
          <Ionicons color={COLORS.progressOverflowStart} name="pulse-outline" size={22} />
        </View>
        <SignalGraph
          goodAbove
          label="Motion signal"
          limitLabel="adaptive threshold"
          limitValue={calculatedSteps.motionThresholdG}
          samples={calculatedSteps.samples.map((sample) => sample.motionG)}
          valueLabel={`${formatAxis(calculatedSteps.lastMotionG)}g / ${formatAxis(calculatedSteps.motionThresholdG)}g`}
        />
        <SignalGraph
          label="Rotation filter"
          limitLabel="rotation limit"
          limitValue={CALCULATED_STEP_DETECTOR_LIMITS.rotationLimitRadPerSecond}
          samples={calculatedSteps.samples.map((sample) => sample.rotationRadPerSecond)}
          valueLabel={`${formatAxis(calculatedSteps.lastRotationRadPerSecond)} rad/s`}
        />
        <TimingGraph samples={calculatedSteps.samples} />
      </SurfacePanel>

      <SurfacePanel style={styles.pickerPanel}>
        <Text style={styles.pickerTitle}>Avatar</Text>
        <View style={styles.avatarPicker}>
          {AVATAR_VARIANTS.map((variant) => {
            const isSelected = variant.key === selectedAvatarKey;

            return (
              <AnimatedPressable
                accessibilityLabel={`Select ${variant.label}`}
                accessibilityRole="button"
                key={variant.key}
                onPress={() => selectAvatar(variant.key)}
                style={[styles.avatarOption, isSelected ? styles.avatarOptionSelected : null]}
              >
                <Text style={[styles.avatarOptionText, isSelected ? styles.avatarOptionTextSelected : null]}>
                  {variant.label}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </SurfacePanel>
    </AppScreen>
  );
}

type SpriteFrameProps = {
  animation: AvatarAnimationConfig;
  frameHeight: number;
  frameIndex: number;
  frameWidth: number;
  source: ImageSourcePropType;
};

const SpriteFrame = ({ animation, frameHeight, frameIndex, frameWidth, source }: SpriteFrameProps) => (
  <View style={styles.spriteViewport}>
    <Image
      fadeDuration={0}
      resizeMode="stretch"
      resizeMethod="resize"
      source={source}
      style={
        {
          height: (AVATAR_SIZE / frameHeight) * frameHeight,
          imageRendering: 'pixelated',
          transform: [{ translateX: -frameIndex * AVATAR_SIZE }],
          width: (AVATAR_SIZE / frameWidth) * frameWidth * animation.frameCount,
        } as object
      }
    />
  </View>
);

const FallbackAvatar = ({ animationKey }: { animationKey: AvatarAnimationKey }) => (
  <View style={[styles.fallbackAvatar, styles[`${animationKey}Avatar`]]}>
    <Text style={styles.fallbackFace}>{animationKey === 'idle' ? '*' : animationKey === 'walk' ? '>' : '>>'}</Text>
  </View>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metric}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
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
  const graphSamples = samples.slice(-32);
  const maxValue = Math.max(limitValue * 1.4, ...graphSamples, 1);
  const limitPercent = Math.max(0, Math.min(100, (limitValue / maxValue) * 100));

  return (
    <View style={styles.signalGraph}>
      <View style={styles.signalHeader}>
        <Text style={styles.signalTitle}>{label}</Text>
        <Text style={styles.signalValue}>{valueLabel}</Text>
      </View>
      <View style={styles.signalBars}>
        <View style={[styles.signalLimit, { bottom: `${limitPercent}%` }]} />
        {graphSamples.length > 0 ? (
          graphSamples.map((sample, index) => {
            const height = Math.max(4, Math.min(100, (sample / maxValue) * 100));
            const passes = goodAbove ? sample >= limitValue : sample <= limitValue;

            return (
              <View
                key={`${index}-${sample}`}
                style={[
                  styles.signalBar,
                  passes ? styles.signalBarPass : styles.signalBarFail,
                  { height: `${height}%` },
                ]}
              />
            );
          })
        ) : (
          <Text style={styles.signalEmpty}>waiting for samples</Text>
        )}
      </View>
      <Text style={styles.signalLimitLabel}>{limitLabel}</Text>
    </View>
  );
};

const TimingGraph = ({ samples }: { samples: DetectorSample[] }) => {
  const graphSamples = samples.slice(-32);
  const maxTimingMs = 2400;
  const minStepPercent = (CALCULATED_STEP_DETECTOR_LIMITS.minStepIntervalMs / maxTimingMs) * 100;
  const maxStepPercent = (CALCULATED_STEP_DETECTOR_LIMITS.maxStepIntervalMs / maxTimingMs) * 100;

  return (
    <View style={styles.signalGraph}>
      <View style={styles.signalHeader}>
        <Text style={styles.signalTitle}>Step timing</Text>
        <Text style={styles.signalValue}>
          {`${CALCULATED_STEP_DETECTOR_LIMITS.minStepIntervalMs}-${CALCULATED_STEP_DETECTOR_LIMITS.maxStepIntervalMs}ms`}
        </Text>
      </View>
      <View style={styles.signalBars}>
        <View style={[styles.signalLimit, styles.signalTimingMin, { bottom: `${minStepPercent}%` }]} />
        <View style={[styles.signalLimit, { bottom: `${maxStepPercent}%` }]} />
        {graphSamples.length > 0 ? (
          graphSamples.map((sample, index) => {
            const elapsedMs = sample.elapsedMsSinceStep ?? 0;
            const height = Math.max(4, Math.min(100, (elapsedMs / maxTimingMs) * 100));
            const passes =
              sample.elapsedMsSinceStep !== null &&
              (elapsedMs > CALCULATED_STEP_DETECTOR_LIMITS.sequenceResetIntervalMs ||
                (elapsedMs >= CALCULATED_STEP_DETECTOR_LIMITS.minStepIntervalMs &&
                  elapsedMs <= CALCULATED_STEP_DETECTOR_LIMITS.maxStepIntervalMs));

            return (
              <View
                key={`${sample.timestamp}-${index}`}
                style={[
                  styles.signalBar,
                  passes ? styles.signalBarPass : styles.signalBarFail,
                  { height: `${height}%` },
                ]}
              />
            );
          })
        ) : (
          <Text style={styles.signalEmpty}>waiting for timing</Text>
        )}
      </View>
      <Text
        style={styles.signalLimitLabel}
      >{`reset after ${CALCULATED_STEP_DETECTOR_LIMITS.sequenceResetIntervalMs}ms`}</Text>
    </View>
  );
};

const formatAxis = (value: number): string => value.toFixed(2);

const getRingGeometry = (ringProgress: Animated.Value): RingGeometry => {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = ringProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return {
    circumference,
    radius,
    strokeDashoffset,
  };
};

const getDetectorStatusLabel = (decision: string, reason: string): string => {
  if (decision === 'accepted') {
    return 'walking';
  }

  if (decision === 'waiting') {
    return 'warming up';
  }

  if (reason.includes('too fast')) {
    return 'too fast';
  }

  if (reason.includes('rotation')) {
    return 'too much rotation';
  }

  if (reason.includes('threshold')) {
    return 'listening';
  }

  return decision;
};

const getAvatarAnimationKey = ({
  cadenceStepsPerMinute,
  detectorDecision,
  elapsedMsSinceStep,
  motionG,
}: {
  cadenceStepsPerMinute: number;
  detectorDecision: string;
  elapsedMsSinceStep: number | null;
  motionG: number;
}): AvatarAnimationKey => {
  const isRecentlyMoving =
    detectorDecision === 'accepted' || (elapsedMsSinceStep !== null && elapsedMsSinceStep < STOPPED_AFTER_MS);

  if (!isRecentlyMoving) {
    return 'idle';
  }

  if (cadenceStepsPerMinute >= RUN_CADENCE && motionG >= RUN_MOTION_G) {
    return 'run';
  }

  return 'walk';
};

const getStateColor = (animationKey: AvatarAnimationKey): string => {
  if (animationKey === 'run') {
    return COLORS.danger;
  }

  if (animationKey === 'walk') {
    return COLORS.challenge;
  }

  return COLORS.primary;
};

const isAvatarVariantKey = (value: string | null): value is AvatarVariantKey =>
  AVATAR_VARIANTS.some((variant) => variant.key === value);
