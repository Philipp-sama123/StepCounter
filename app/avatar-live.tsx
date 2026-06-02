import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useAuth } from '../src/auth/AuthContext';
import { AnimatedPressable } from '../src/components/AnimatedPressable';
import { AppScreen } from '../src/components/layout/AppScreen';
import { PageHeader } from '../src/components/layout/PageHeader';
import { SurfacePanel } from '../src/components/ui/SurfacePanel';
import {
  AVATAR_STORAGE_KEY,
  AVATAR_VARIANTS,
  AvatarAnimationConfig,
  AvatarAnimationKey,
  AvatarVariantKey,
  DEFAULT_AVATAR_VARIANT_KEY,
} from '../src/config/avatarSprites';
import { COLORS } from '../src/constants';
import { readAvatarPreferenceFromFirestore, saveAvatarPreferenceToFirestore } from '../src/firebase/avatarPreference';
import { useCalculatedStepCounter } from '../src/hooks/useCalculatedStepCounter';

type RingGeometry = {
  circumference: number;
  radius: number;
  strokeDashoffset: Animated.AnimatedInterpolation<string | number>;
};

const RING_SIZE = 330;
const RING_STROKE = 18;
const AVATAR_SIZE = 220;
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
  const isWalkingHeld = calculatedSteps.detectorDecision !== 'accepted' && lastAcceptedAt > 0 && nowMs - lastAcceptedAt < WALK_HOLD_MS;
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
        accessory={(
          <AnimatedPressable accessibilityLabel="Back to debug" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons color={COLORS.text} name="close-outline" size={24} />
          </AnimatedPressable>
        )}
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
                <Stop offset="0" stopColor="#FFFFFF" />
                <Stop offset="0.58" stopColor="#EEF1F3" />
                <Stop offset="1" stopColor="#DDE2E6" />
              </LinearGradient>
            </Defs>
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} fill="url(#liveAvatarCircleGradient)" r={ring.radius - RING_STROKE} />
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} fill="none" r={ring.radius} stroke={COLORS.border} strokeWidth={RING_STROKE} />
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
                <Text style={[styles.avatarOptionText, isSelected ? styles.avatarOptionTextSelected : null]}>{variant.label}</Text>
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
      style={{
        height: (AVATAR_SIZE / frameHeight) * frameHeight,
        imageRendering: 'pixelated',
        transform: [{ translateX: -frameIndex * AVATAR_SIZE }],
        width: (AVATAR_SIZE / frameWidth) * frameWidth * animation.frameCount,
      } as object}
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
  const isRecentlyMoving = detectorDecision === 'accepted' || (elapsedMsSinceStep !== null && elapsedMsSinceStep < STOPPED_AFTER_MS);

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

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: COLORS.button,
    borderColor: COLORS.buttonBorder,
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  heroPanel: {
    gap: 18,
    padding: 16,
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  avatarName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '900',
  },
  avatarStatus: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
    textTransform: 'capitalize',
  },
  statePill: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 7,
    textTransform: 'uppercase',
  },
  idlePill: {
    backgroundColor: COLORS.stoppedSoft,
    color: COLORS.stopped,
  },
  walkPill: {
    backgroundColor: COLORS.challengeSoft,
    color: COLORS.challenge,
  },
  runPill: {
    backgroundColor: COLORS.danger,
    color: COLORS.onDanger,
  },
  avatarStage: {
    alignItems: 'center',
    height: RING_SIZE,
    justifyContent: 'center',
    width: '100%',
  },
  progressRing: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  avatarFrame: {
    alignItems: 'center',
    borderRadius: AVATAR_SIZE / 2,
    height: AVATAR_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
    width: AVATAR_SIZE,
  },
  spriteViewport: {
    height: AVATAR_SIZE,
    overflow: 'hidden',
    width: AVATAR_SIZE,
  },
  fallbackAvatar: {
    alignItems: 'center',
    borderRadius: AVATAR_SIZE / 2,
    height: AVATAR_SIZE,
    justifyContent: 'center',
    width: AVATAR_SIZE,
  },
  idleAvatar: {
    backgroundColor: COLORS.stoppedSoft,
  },
  walkAvatar: {
    backgroundColor: COLORS.challengeSoft,
  },
  runAvatar: {
    backgroundColor: COLORS.danger,
  },
  fallbackFace: {
    color: COLORS.text,
    fontSize: 86,
    fontWeight: '900',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 76,
    padding: 12,
  },
  metricLabel: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 7,
  },
  reasonPanel: {
    gap: 7,
  },
  reasonTitle: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  reasonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  reasonMeta: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  pickerPanel: {
    gap: 12,
  },
  pickerTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  avatarPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarOption: {
    alignItems: 'center',
    backgroundColor: COLORS.button,
    borderColor: COLORS.buttonBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minHeight: 42,
    minWidth: 86,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  avatarOptionSelected: {
    backgroundColor: COLORS.challenge,
    borderColor: COLORS.challenge,
  },
  avatarOptionText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },
  avatarOptionTextSelected: {
    color: COLORS.onDanger,
  },
});
