import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, Image, ImageSourcePropType, Modal, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { AnimatedPressable } from '../AnimatedPressable';
import {
  AVATAR_STORAGE_KEY,
  AVATAR_VARIANTS,
  AvatarAnimationConfig,
  AvatarAnimationKey,
  AvatarSpritesheetConfig,
  AvatarVariantKey,
  DEFAULT_AVATAR_VARIANT_KEY,
} from '../../config/avatarSprites';
import { COLORS } from '../../constants';

type SensorAvatarProps = {
  cadenceStepsPerMinute: number;
  confidence: number;
  detectorDecision: string;
  elapsedMsSinceStep: number | null;
  motionG: number;
  spritesheet: AvatarSpritesheetConfig;
};

type RingGeometry = {
  circumference: number;
  radius: number;
  strokeDashoffset: Animated.AnimatedInterpolation<string | number>;
};

const RING_SIZE = 212;
const RING_STROKE = 12;
const AVATAR_SIZE = 128;
const FULLSCREEN_RING_SIZE = 348;
const FULLSCREEN_RING_STROKE = 18;
const FULLSCREEN_AVATAR_SIZE = 220;
const STOPPED_AFTER_MS = 2200;
const RUN_CADENCE = 135;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const SensorAvatar = ({
  cadenceStepsPerMinute,
  confidence,
  detectorDecision,
  elapsedMsSinceStep,
  motionG,
  spritesheet,
}: SensorAvatarProps) => {
  const animationKey = getAvatarAnimationKey({
    cadenceStepsPerMinute,
    detectorDecision,
    elapsedMsSinceStep,
    motionG,
  });
  const [selectedAvatarKey, setSelectedAvatarKey] = useState<AvatarVariantKey>(DEFAULT_AVATAR_VARIANT_KEY);
  const selectedVariant = AVATAR_VARIANTS.find((variant) => variant.key === selectedAvatarKey);
  const selectedSpritesheet = selectedVariant?.spritesheet ?? spritesheet;
  const animation = selectedSpritesheet.animations[animationKey];
  const [frameIndex, setFrameIndex] = useState(0);
  const [isFullscreenVisible, setIsFullscreenVisible] = useState(false);
  const ringProgress = useRef(new Animated.Value(confidence / 100)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const ring = useMemo(() => getRingGeometry(ringProgress, RING_SIZE, RING_STROKE), [ringProgress]);
  const fullscreenRing = useMemo(() => getRingGeometry(ringProgress, FULLSCREEN_RING_SIZE, FULLSCREEN_RING_STROKE), [ringProgress]);

  useEffect(() => {
    let isMounted = true;

    const loadSelectedAvatar = async (): Promise<void> => {
      const storedKey = await AsyncStorage.getItem(AVATAR_STORAGE_KEY);
      if (isMounted && isAvatarVariantKey(storedKey)) {
        setSelectedAvatarKey(storedKey);
      }
    };

    void loadSelectedAvatar();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setFrameIndex(0);
    const frameDurationMs = Math.max(60, Math.round(1000 / animation.fps));
    const timer = setInterval(() => {
      setFrameIndex((currentFrame) => (currentFrame + 1) % animation.frameCount);
    }, frameDurationMs);

    return () => clearInterval(timer);
  }, [animation.frameCount, animation.fps, animationKey]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ringProgress, {
        duration: 420,
        toValue: confidence / 100,
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
  }, [animationKey, confidence, pulseScale, ringProgress]);

  return (
    <>
      <AnimatedPressable
        accessibilityLabel="Open live avatar fullscreen"
        accessibilityRole="button"
        onPress={() => setIsFullscreenVisible(true)}
        style={styles.panel}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Live avatar</Text>
            <Text style={styles.subtitle}>Tap to open the bright fullscreen stage.</Text>
          </View>
          <Text style={[styles.statePill, styles[`${animationKey}Pill`]]}>{selectedVariant?.label ?? 'Avatar'}</Text>
        </View>

        <AvatarStage
          animation={animation}
          animationKey={animationKey}
          avatarSize={AVATAR_SIZE}
          frameHeight={selectedSpritesheet.frameHeight}
          frameIndex={frameIndex}
          frameWidth={selectedSpritesheet.frameWidth}
          pulseScale={pulseScale}
          ring={ring}
          ringSize={RING_SIZE}
          ringStroke={RING_STROKE}
        />

        <View style={styles.metrics}>
          <AvatarMetric label="Cadence" value={`${cadenceStepsPerMinute}/min`} />
          <AvatarMetric label="Confidence" value={`${confidence}%`} />
          <AvatarMetric label="Motion" value={`${motionG.toFixed(2)}g`} />
        </View>
      </AnimatedPressable>

      <Modal animationType="fade" transparent visible={isFullscreenVisible} onRequestClose={() => setIsFullscreenVisible(false)}>
        <View style={styles.fullscreenBackdrop}>
          <View style={styles.fullscreenStage}>
            <View style={styles.fullscreenHeader}>
              <View>
              <Text style={styles.fullscreenTitle}>Live avatar</Text>
                <Text style={styles.fullscreenSubtitle}>Choose an avatar and watch the live detector state.</Text>
              </View>
              <AnimatedPressable
                accessibilityLabel="Close fullscreen avatar"
                accessibilityRole="button"
                onPress={() => setIsFullscreenVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </AnimatedPressable>
            </View>

            <View style={styles.fullscreenCenter}>
              <AvatarStage
                animation={animation}
                animationKey={animationKey}
                avatarSize={FULLSCREEN_AVATAR_SIZE}
                frameHeight={selectedSpritesheet.frameHeight}
                frameIndex={frameIndex}
                frameWidth={selectedSpritesheet.frameWidth}
                pulseScale={pulseScale}
                ring={fullscreenRing}
                ringSize={FULLSCREEN_RING_SIZE}
                ringStroke={FULLSCREEN_RING_STROKE}
              />
            </View>

            <View style={styles.fullscreenMetrics}>
              <AvatarMetric label="Cadence" value={`${cadenceStepsPerMinute}/min`} />
              <AvatarMetric label="Confidence" value={`${confidence}%`} />
              <AvatarMetric label="Motion" value={`${motionG.toFixed(2)}g`} />
              <AvatarMetric label="State" value={animationKey} />
            </View>
            <View style={styles.avatarPicker}>
              {AVATAR_VARIANTS.map((variant) => {
                const isSelected = variant.key === selectedAvatarKey;

                return (
                  <AnimatedPressable
                    accessibilityLabel={`Select ${variant.label}`}
                    accessibilityRole="button"
                    key={variant.key}
                    onPress={() => {
                      setSelectedAvatarKey(variant.key);
                      void AsyncStorage.setItem(AVATAR_STORAGE_KEY, variant.key);
                    }}
                    style={[styles.avatarOption, isSelected ? styles.avatarOptionSelected : null]}
                  >
                    <Text style={[styles.avatarOptionText, isSelected ? styles.avatarOptionTextSelected : null]}>{variant.label}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

type AvatarStageProps = {
  animation: AvatarAnimationConfig;
  animationKey: AvatarAnimationKey;
  avatarSize: number;
  frameHeight: number;
  frameIndex: number;
  frameWidth: number;
  pulseScale: Animated.Value;
  ring: RingGeometry;
  ringSize: number;
  ringStroke: number;
};

const AvatarStage = ({
  animation,
  animationKey,
  avatarSize,
  frameHeight,
  frameIndex,
  frameWidth,
  pulseScale,
  ring,
  ringSize,
  ringStroke,
}: AvatarStageProps) => (
  <View style={[styles.stage, { minHeight: ringSize }]}>
    <Svg height={ringSize} style={styles.progressRing} width={ringSize}>
      <Defs>
        <LinearGradient id={`avatarCircleGradient-${ringSize}`} x1="0" x2="1" y1="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.58" stopColor="#EEF1F3" />
          <Stop offset="1" stopColor="#DDE2E6" />
        </LinearGradient>
      </Defs>
      <Circle
        cx={ringSize / 2}
        cy={ringSize / 2}
        fill={`url(#avatarCircleGradient-${ringSize})`}
        r={ring.radius - ringStroke}
      />
      <Circle
        cx={ringSize / 2}
        cy={ringSize / 2}
        fill="none"
        r={ring.radius}
        stroke={COLORS.border}
        strokeWidth={ringStroke}
      />
      <AnimatedCircle
        cx={ringSize / 2}
        cy={ringSize / 2}
        fill="none"
        r={ring.radius}
        stroke={animationKey === 'run' ? COLORS.danger : animationKey === 'walk' ? COLORS.challenge : COLORS.primary}
        strokeDasharray={ring.circumference}
        strokeDashoffset={ring.strokeDashoffset}
        strokeLinecap="round"
        strokeWidth={ringStroke}
      />
    </Svg>
    <Animated.View style={[styles.avatarFrame, { borderRadius: avatarSize / 2, height: avatarSize, transform: [{ scale: pulseScale }], width: avatarSize }]}>
      {animation.source === null ? (
        <FallbackAvatar animationKey={animationKey} size={avatarSize} />
      ) : (
        <SpriteFrame
          animation={animation}
          avatarSize={avatarSize}
          frameHeight={frameHeight}
          frameIndex={frameIndex}
          frameWidth={frameWidth}
          source={animation.source}
        />
      )}
    </Animated.View>
  </View>
);

type SpriteFrameProps = {
  animation: AvatarAnimationConfig;
  avatarSize: number;
  frameHeight: number;
  frameIndex: number;
  frameWidth: number;
  source: ImageSourcePropType;
};

const SpriteFrame = ({ animation, avatarSize, frameHeight, frameIndex, frameWidth, source }: SpriteFrameProps) => (
  <View style={[styles.spriteViewport, { height: avatarSize, width: avatarSize }]}>
    <Image
      resizeMode="stretch"
      source={source}
      style={{
        height: (avatarSize / frameHeight) * frameHeight,
        transform: [{ translateX: -frameIndex * avatarSize }],
        width: (avatarSize / frameWidth) * frameWidth * animation.frameCount,
      }}
    />
  </View>
);

const FallbackAvatar = ({ animationKey, size }: { animationKey: AvatarAnimationKey; size: number }) => (
  <View style={[styles.fallbackAvatar, styles[`${animationKey}Avatar`], { borderRadius: size / 2, height: size, width: size }]}>
    <Text style={[styles.fallbackFace, { fontSize: size * 0.5 }]}>{animationKey === 'idle' ? '*' : animationKey === 'walk' ? '>' : '>>'}</Text>
  </View>
);

const AvatarMetric = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metric}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

const getRingGeometry = (ringProgress: Animated.Value, ringSize: number, ringStroke: number): RingGeometry => {
  const radius = (ringSize - ringStroke) / 2;
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

  if (!isRecentlyMoving || cadenceStepsPerMinute <= 0) {
    return 'idle';
  }

  if (cadenceStepsPerMinute >= RUN_CADENCE || motionG > 0.28) {
    return 'run';
  }

  return 'walk';
};

const isAvatarVariantKey = (value: string | null): value is AvatarVariantKey =>
  AVATAR_VARIANTS.some((variant) => variant.key === value);

const styles = StyleSheet.create({
  panel: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  statePill: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRing: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  avatarFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  spriteViewport: {
    overflow: 'hidden',
  },
  fallbackAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '900',
  },
  metrics: {
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  metricLabel: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '900',
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },
  fullscreenBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    flex: 1,
    padding: 18,
  },
  fullscreenStage: {
    backgroundColor: '#F5F7EF',
    borderColor: '#E2E7D8',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 20,
    padding: 18,
  },
  fullscreenHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fullscreenTitle: {
    color: COLORS.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  fullscreenSubtitle: {
    color: '#66705F',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },
  closeButton: {
    backgroundColor: COLORS.button,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  closeButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },
  fullscreenCenter: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  fullscreenMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarOption: {
    backgroundColor: '#E8ECEF',
    borderColor: '#D4DADF',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    minWidth: 82,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avatarOptionSelected: {
    backgroundColor: COLORS.challenge,
    borderColor: COLORS.challenge,
  },
  avatarOptionText: {
    color: COLORS.ink,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  avatarOptionTextSelected: {
    color: COLORS.onDanger,
  },
});
