# Avatar Sprites

Put your live sensor avatar animation sheets here:

```text
assets/sprites/avatar/cat05_idle.png
assets/sprites/avatar/cat05_walk.png
assets/sprites/avatar/cat05_run.png
```

Default layout expected by `src/config/avatarSprites.ts`:

```text
cat05_idle.png: 8 frames
cat05_walk.png: 8 frames
cat05_run.png:  4 frames
```

Each frame should be `64 x 64` pixels. Each sheet should be one horizontal row.

Default image sizes:

```text
cat05_idle.png: 512 x 64
cat05_walk.png: 512 x 64
cat05_run.png:  256 x 64
```

After adding the PNGs, update each animation source in `src/config/avatarSprites.ts`:

```ts
source: require('../../assets/sprites/avatar/cat05_idle.png'),
```
