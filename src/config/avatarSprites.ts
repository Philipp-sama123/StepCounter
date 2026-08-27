import type { ImageSourcePropType } from 'react-native';

export type AvatarAnimationKey = 'idle' | 'walk' | 'run';
export type AvatarVariantKey = 'cat01' | 'cat02' | 'cat03' | 'cat04' | 'cat05' | 'chicken' | 'crow';

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

export type AvatarVariantConfig = {
  key: AvatarVariantKey;
  label: string;
  spritesheet: AvatarSpritesheetConfig;
};

export const AVATAR_SPRITESHEET_FOLDER = 'assets/sprites/avatar';
export const AVATAR_STORAGE_KEY = 'debug:selected-avatar';
const AVATAR_ANIMATION_FPS = 8;

const createCatSpritesheet = ({
  idle,
  run,
  walk,
}: {
  idle: ImageSourcePropType;
  run: ImageSourcePropType;
  walk: ImageSourcePropType;
}): AvatarSpritesheetConfig => ({
  frameHeight: 64,
  frameWidth: 64,
  animations: {
    idle: {
      frameCount: 8,
      fps: AVATAR_ANIMATION_FPS,
      source: idle,
    },
    walk: {
      frameCount: 8,
      fps: AVATAR_ANIMATION_FPS,
      source: walk,
    },
    run: {
      frameCount: 4,
      fps: AVATAR_ANIMATION_FPS,
      source: run,
    },
  },
});

const createBirdSpritesheet = ({
  idle,
  idleFrameCount,
  run,
  runFrameCount,
  walk,
  walkFrameCount,
}: {
  idle: ImageSourcePropType;
  idleFrameCount: number;
  run: ImageSourcePropType;
  runFrameCount: number;
  walk: ImageSourcePropType;
  walkFrameCount: number;
}): AvatarSpritesheetConfig => ({
  frameHeight: 40,
  frameWidth: 40,
  animations: {
    idle: {
      frameCount: idleFrameCount,
      fps: AVATAR_ANIMATION_FPS,
      source: idle,
    },
    walk: {
      frameCount: walkFrameCount,
      fps: AVATAR_ANIMATION_FPS,
      source: walk,
    },
    run: {
      frameCount: runFrameCount,
      fps: AVATAR_ANIMATION_FPS,
      source: run,
    },
  },
});

export const AVATAR_VARIANTS: AvatarVariantConfig[] = [
  {
    key: 'cat01',
    label: 'Cat 01',
    spritesheet: createCatSpritesheet({
      idle: require('../../assets/sprites/avatar/cat01_idle.png'),
      run: require('../../assets/sprites/avatar/cat01_run.png'),
      walk: require('../../assets/sprites/avatar/cat01_walk.png'),
    }),
  },
  {
    key: 'cat02',
    label: 'Cat 02',
    spritesheet: createCatSpritesheet({
      idle: require('../../assets/sprites/avatar/cat02_idle.png'),
      run: require('../../assets/sprites/avatar/cat02_run.png'),
      walk: require('../../assets/sprites/avatar/cat02_walk.png'),
    }),
  },
  {
    key: 'cat03',
    label: 'Cat 03',
    spritesheet: createCatSpritesheet({
      idle: require('../../assets/sprites/avatar/cat03_idle.png'),
      run: require('../../assets/sprites/avatar/cat03_run.png'),
      walk: require('../../assets/sprites/avatar/cat03_walk.png'),
    }),
  },
  {
    key: 'cat04',
    label: 'Cat 04',
    spritesheet: createCatSpritesheet({
      idle: require('../../assets/sprites/avatar/cat04_idle.png'),
      run: require('../../assets/sprites/avatar/cat04_run.png'),
      walk: require('../../assets/sprites/avatar/cat04_walk.png'),
    }),
  },
  {
    key: 'cat05',
    label: 'Cat 05',
    spritesheet: createCatSpritesheet({
      idle: require('../../assets/sprites/avatar/cat05_idle.png'),
      run: require('../../assets/sprites/avatar/cat05_run.png'),
      walk: require('../../assets/sprites/avatar/cat05_walk.png'),
    }),
  },
  {
    key: 'chicken',
    label: 'Chicken',
    spritesheet: createBirdSpritesheet({
      idle: require('../../assets/sprites/avatar/chicken_idle_blink.png'),
      idleFrameCount: 4,
      run: require('../../assets/sprites/avatar/chicken_run.png'),
      runFrameCount: 4,
      walk: require('../../assets/sprites/avatar/chicken_walk.png'),
      walkFrameCount: 8,
    }),
  },
  {
    key: 'crow',
    label: 'Crow',
    spritesheet: createBirdSpritesheet({
      idle: require('../../assets/sprites/avatar/crow_idle_caw.png'),
      idleFrameCount: 12,
      run: require('../../assets/sprites/avatar/crow_run.png'),
      runFrameCount: 6,
      walk: require('../../assets/sprites/avatar/crow_walk.png'),
      walkFrameCount: 16,
    }),
  },
];

export const DEFAULT_AVATAR_VARIANT_KEY: AvatarVariantKey = 'cat05';
export const AVATAR_SPRITESHEET: AvatarSpritesheetConfig =
  AVATAR_VARIANTS.find((variant) => variant.key === DEFAULT_AVATAR_VARIANT_KEY)?.spritesheet ??
  AVATAR_VARIANTS[0].spritesheet;
