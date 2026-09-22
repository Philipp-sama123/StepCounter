import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { AVATAR_SPRITESHEET } from '../../config/avatarSprites';
import { COLORS } from '../../constants';

import type { AvatarAnimationConfig, AvatarAnimationKey, AvatarClipKey } from '../../config/avatarSprites';
import type { ImageSourcePropType } from 'react-native';

type DashboardAvatarProps = {
  caption?: string;
  speed?: number;
  state: AvatarAnimationKey;
};

const RING_SIZE = 210;
const RING_STROKE = 10;
const AVATAR_WIDTH = 174;
const AVATAR_HEIGHT = (AVATAR_WIDTH * AVATAR_SPRITESHEET.frameHeight) / AVATAR_SPRITESHEET.frameWidth;

export const DashboardAvatar = ({ caption, speed = 0, state }: DashboardAvatarProps) => {
  const [animationState, setAnimationState] = useState<AvatarClipKey>('idle');
  const animation = AVATAR_SPRITESHEET.animations[animationState];
  const [frameIndex, setFrameIndex] = useState(0);
  const pulseScale = useRef(new Animated.Value(1)).current;
  const previousStateRef = useRef<AvatarAnimationKey>('idle');
  const requestedStateRef = useRef<AvatarAnimationKey>(state);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStartingRef = useRef(false);

  useEffect(() => {
    requestedStateRef.current = state;

    if (state === 'idle') {
      if (transitionTimerRef.current !== null) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      isStartingRef.current = false;
      if (previousStateRef.current === 'idle') {
        setAnimationState('idle');
        setFrameIndex(0);
      } else {
        const stopAnimation = AVATAR_SPRITESHEET.animations.stop;
        setAnimationState('stop');
        setFrameIndex(0);
        transitionTimerRef.current = setTimeout(
          () => {
            setAnimationState('idle');
            setFrameIndex(0);
          },
          (stopAnimation.frameCount / stopAnimation.fps) * 1000,
        );
      }
    } else if (previousStateRef.current === 'idle') {
      if (transitionTimerRef.current !== null) {
        clearTimeout(transitionTimerRef.current);
      }
      isStartingRef.current = true;
      setAnimationState('move');
      setFrameIndex(0);
      const startAnimation = AVATAR_SPRITESHEET.animations.move;
      transitionTimerRef.current = setTimeout(
        () => {
          isStartingRef.current = false;
          setAnimationState(toLoopAnimation(requestedStateRef.current));
          setFrameIndex(0);
        },
        (startAnimation.frameCount / startAnimation.fps) * 1000,
      );
    } else if (!isStartingRef.current) {
      setAnimationState(toLoopAnimation(state));
      setFrameIndex(0);
    }

    previousStateRef.current = state;
  }, [state]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const animationFps = getAnimationFps(animationState, animation.fps, speed);
    const frameDurationMs = Math.max(24, Math.round(1000 / animationFps));
    const timer = setInterval(() => {
      setFrameIndex((currentFrame) => (currentFrame + 1) % animation.frameCount);
    }, frameDurationMs);

    return () => clearInterval(timer);
  }, [animation.frameCount, animation.fps, animationState, speed]);

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
          <SpriteFrame animation={animation} frameIndex={frameIndex} source={animation.source} />
        </Animated.View>
      </View>
      <Text style={styles.caption}>{caption ?? getStateLabel(state)}</Text>
    </View>
  );
};

type SpriteFrameProps = {
  animation: AvatarAnimationConfig;
  frameIndex: number;
  source: ImageSourcePropType;
};

const SpriteFrame = ({ animation, frameIndex, source }: SpriteFrameProps) => (
  <View style={styles.spriteViewport}>
    <Image
      fadeDuration={0}
      resizeMethod="resize"
      resizeMode="stretch"
      source={source}
      style={
        {
          height: AVATAR_HEIGHT * animation.rows,
          transform: [
            { translateX: -(frameIndex % AVATAR_SPRITESHEET.columns) * AVATAR_WIDTH },
            { translateY: -Math.floor(frameIndex / AVATAR_SPRITESHEET.columns) * AVATAR_HEIGHT },
          ],
          width: AVATAR_WIDTH * AVATAR_SPRITESHEET.columns,
        } as object
      }
    />
  </View>
);

const getStateColor = (state: AvatarAnimationKey): string => {
  if (state === 'run') {
    return COLORS.danger;
  }

  if (state === 'walk') {
    return COLORS.challenge;
  }

  if (state === 'move') {
    return COLORS.primary;
  }

  return COLORS.stopped;
};

const toLoopAnimation = (state: AvatarAnimationKey): AvatarAnimationKey => {
  if (state === 'run') return 'run';
  if (state === 'idle') return 'idle';
  return 'walk';
};

const getAnimationFps = (state: AvatarClipKey, baseFps: number, speed: number): number => {
  const normalizedSpeed = Math.min(1, Math.max(0, speed));
  if (state === 'idle' || state === 'move' || state === 'stop') return baseFps;
  if (state === 'run') return 25 + normalizedSpeed * 17;
  return 12 + normalizedSpeed * 20;
};

const getStateLabel = (state: AvatarAnimationKey): string => {
  if (state === 'run') {
    return 'quick step update';
  }

  if (state === 'walk') {
    return 'walking';
  }

  if (state === 'move') {
    return 'phone moving';
  }

  return 'idle';
};

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
    borderRadius: AVATAR_WIDTH / 2,
    height: AVATAR_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
    width: AVATAR_WIDTH,
  },
  spriteViewport: {
    height: AVATAR_HEIGHT,
    overflow: 'hidden',
    width: AVATAR_WIDTH,
  },
  caption: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
});
