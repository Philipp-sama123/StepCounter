import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { AVATAR_STORAGE_KEY, AVATAR_VARIANTS, DEFAULT_AVATAR_VARIANT_KEY } from '../../config/avatarSprites';
import { COLORS } from '../../constants';
import { readAvatarPreferenceFromFirestore } from '../../firebase/avatarPreference';
import { userScopedStorage as AsyncStorage } from '../../platform/storage/userScopedStorage';

import type { AvatarAnimationConfig, AvatarAnimationKey, AvatarVariantKey } from '../../config/avatarSprites';
import type { ImageSourcePropType } from 'react-native';

type DashboardAvatarProps = {
  caption?: string;
  state: AvatarAnimationKey;
  userId: string | null;
};

const RING_SIZE = 154;
const RING_STROKE = 9;
const AVATAR_SIZE = 106;

export const DashboardAvatar = ({ caption, state, userId }: DashboardAvatarProps) => {
  const [selectedAvatarKey, setSelectedAvatarKey] = useState<AvatarVariantKey>(DEFAULT_AVATAR_VARIANT_KEY);
  const selectedVariant = AVATAR_VARIANTS.find((variant) => variant.key === selectedAvatarKey) ?? AVATAR_VARIANTS[0];
  const animation = selectedVariant.spritesheet.animations[state];
  const [frameIndex, setFrameIndex] = useState(0);
  const pulseScale = useRef(new Animated.Value(1)).current;

  const loadAvatarPreference = useCallback(async (): Promise<void> => {
    const [storedKey, remoteKey] = await Promise.all([
      AsyncStorage.getItem(AVATAR_STORAGE_KEY),
      userId === null ? Promise.resolve(null) : readAvatarPreferenceFromFirestore(userId),
    ]);
    const nextKey = remoteKey ?? (isAvatarVariantKey(storedKey) ? storedKey : null);

    if (nextKey !== null) {
      setSelectedAvatarKey(nextKey);
      await AsyncStorage.setItem(AVATAR_STORAGE_KEY, nextKey);
    }
  }, [userId]);

  useEffect(() => {
    void loadAvatarPreference();
  }, [loadAvatarPreference]);

  useFocusEffect(
    useCallback(() => {
      void loadAvatarPreference();
    }, [loadAvatarPreference]),
  );

  useEffect(() => {
    setFrameIndex(0);
    const frameDurationMs = Math.max(60, Math.round(1000 / animation.fps));
    const timer = setInterval(() => {
      setFrameIndex((currentFrame) => (currentFrame + 1) % animation.frameCount);
    }, frameDurationMs);

    return () => clearInterval(timer);
  }, [animation.frameCount, animation.fps, selectedAvatarKey, state]);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(pulseScale, {
        friction: 6,
        tension: 140,
        toValue: state === 'idle' ? 1 : 1.04,
        useNativeDriver: true,
      }),
      Animated.spring(pulseScale, {
        friction: 7,
        tension: 130,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pulseScale, state]);

  return (
    <View style={styles.container}>
      <View style={styles.stage}>
        <Svg height={RING_SIZE} style={styles.ring} width={RING_SIZE}>
          <Defs>
            <LinearGradient id="dashboardAvatarCircleGradient" x1="0" x2="1" y1="0" y2="1">
              <Stop offset="0" stopColor={COLORS.avatarGradientStart} />
              <Stop offset="0.6" stopColor={COLORS.avatarGradientMiddle} />
              <Stop offset="1" stopColor={COLORS.avatarGradientEnd} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="url(#dashboardAvatarCircleGradient)"
            r={(RING_SIZE - RING_STROKE * 3) / 2}
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            r={(RING_SIZE - RING_STROKE) / 2}
            stroke={getStateColor(state)}
            strokeLinecap="round"
            strokeWidth={RING_STROKE}
          />
        </Svg>
        <Animated.View style={[styles.avatarFrame, { transform: [{ scale: pulseScale }] }]}>
          {animation.source === null ? (
            <FallbackAvatar state={state} />
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
      <Text style={styles.caption}>{caption ?? `${selectedVariant.label} · ${getStateLabel(state)}`}</Text>
    </View>
  );
};

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
      resizeMethod="resize"
      resizeMode="stretch"
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

const FallbackAvatar = ({ state }: { state: AvatarAnimationKey }) => (
  <View
    style={[
      styles.fallbackAvatar,
      {
        backgroundColor: state === 'run' ? COLORS.danger : state === 'walk' ? COLORS.challengeSoft : COLORS.stoppedSoft,
      },
    ]}
  >
    <Text style={styles.fallbackText}>{state === 'run' ? '>>' : state === 'walk' ? '>' : '*'}</Text>
  </View>
);

const getStateColor = (state: AvatarAnimationKey): string => {
  if (state === 'run') {
    return COLORS.danger;
  }

  if (state === 'walk') {
    return COLORS.challenge;
  }

  return COLORS.stopped;
};

const getStateLabel = (state: AvatarAnimationKey): string => {
  if (state === 'run') {
    return 'quick step update';
  }

  if (state === 'walk') {
    return 'steps updated';
  }

  return 'waiting for Health Connect';
};

const isAvatarVariantKey = (value: string | null): value is AvatarVariantKey =>
  AVATAR_VARIANTS.some((variant) => variant.key === value);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  stage: {
    alignItems: 'center',
    height: RING_SIZE,
    justifyContent: 'center',
    width: RING_SIZE,
  },
  ring: {
    position: 'absolute',
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
  fallbackText: {
    color: COLORS.text,
    fontSize: 38,
    fontWeight: '900',
  },
  caption: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
});
