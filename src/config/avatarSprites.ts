import { ImageSourcePropType } from 'react-native';

export type AvatarAnimationKey = 'idle' | 'walk' | 'run';
export type AvatarVariantKey = 'cat01' | 'cat02' | 'cat03' | 'cat04' | 'cat05';

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
      fps: 5,
      source: idle,
    },
    walk: {
      frameCount: 8,
      fps: 9,
      source: walk,
    },
    run: {
      frameCount: 4,
      fps: 12,
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
];

export const DEFAULT_AVATAR_VARIANT_KEY: AvatarVariantKey = 'cat05';
export const AVATAR_SPRITESHEET: AvatarSpritesheetConfig =
  AVATAR_VARIANTS.find((variant) => variant.key === DEFAULT_AVATAR_VARIANT_KEY)?.spritesheet ?? AVATAR_VARIANTS[0].spritesheet;
