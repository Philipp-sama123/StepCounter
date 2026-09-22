import type { ImageSourcePropType } from 'react-native';

export type AvatarAnimationKey = 'idle' | 'move' | 'walk' | 'run';
export type AvatarClipKey = AvatarAnimationKey | 'stop';

export type AvatarAnimationConfig = {
  frameCount: number;
  fps: number;
  rows: number;
  source: ImageSourcePropType;
};

export type AvatarSpritesheetConfig = {
  animations: Record<AvatarClipKey, AvatarAnimationConfig>;
  columns: number;
  frameHeight: number;
  frameWidth: number;
};

/** The app has one character. Activity state alone selects its animation. */
export const AVATAR_SPRITESHEET: AvatarSpritesheetConfig = {
  columns: 6,
  frameHeight: 289,
  frameWidth: 320,
  animations: {
    idle: {
      frameCount: 29,
      fps: 20,
      rows: 5,
      source: require('../../assets/sprites/skater/idle.png'),
    },
    move: {
      frameCount: 38,
      fps: 24,
      rows: 7,
      source: require('../../assets/sprites/skater/start.png'),
    },
    walk: {
      frameCount: 19,
      fps: 24,
      rows: 4,
      source: require('../../assets/sprites/skater/roll.png'),
    },
    run: {
      frameCount: 19,
      fps: 32,
      rows: 4,
      source: require('../../assets/sprites/skater/push.png'),
    },
    stop: {
      frameCount: 13,
      fps: 20,
      rows: 3,
      source: require('../../assets/sprites/skater/fall.png'),
    },
  },
};
