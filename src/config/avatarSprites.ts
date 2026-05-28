import { ImageSourcePropType } from 'react-native';

export type AvatarAnimationKey = 'idle' | 'walk' | 'run';

export type AvatarAnimationConfig = {
  frameCount: number;
  fps: number;
  source: ImageSourcePropType | null;
};

export type AvatarSpritesheetConfig = {
  animations: Record<AvatarAnimationKey, AvatarAnimationConfig>;
  frameHeight: number;
  frameWidth: number;
};

export const AVATAR_SPRITESHEET_FOLDER = 'assets/sprites/avatar';

export const AVATAR_SPRITESHEET: AvatarSpritesheetConfig = {
  frameHeight: 64,
  frameWidth: 64,
  animations: {
    idle: {
      frameCount: 8,
      fps: 5,
      source: require('../../assets/sprites/avatar/cat05_idle.png'),
    },
    walk: {
      frameCount: 8,
      fps: 9,
      source: require('../../assets/sprites/avatar/cat05_walk.png'),
    },
    run: {
      frameCount: 4,
      fps: 12,
      source: require('../../assets/sprites/avatar/cat05_run.png'),
    },
  },
};
