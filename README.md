# MMotion

> A client-only motion studio for 3D device showcases. Pick a scene, apply your brand, tweak the motion and render an MP4 or a still image, all in the browser. No backend, no uploads.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## How it works

MMotion is a static Vue 3 SPA (Vite, Pinia, Tailwind CSS v4, notform + Zod, TresJS / Three.js). The wizard has four steps: **Template → Brand → Content → Export**.

- **Templates are Vue scenes.** Each folder in `templates/` holds a `Scene.vue` (the 3D scene, written with the scene kit and plain Tres components), an `index.ts` (`defineMotionTemplate`: metadata, resolution, defaults, optional bloom) and a `thumbnail.png` poster. `registry.ts` discovers them with `import.meta.glob`, so adding a folder adds a template.
- **Scene kit** (`src/components/studio/scene/`): `<Device>` loads a GLB and binds its screen and body meshes, `<SceneCamera>`, `<SceneLights>` and `<SceneShadows>` cover the usual setup, and `useTrack(keys)` / `useSceneTime()` animate anything from keyframes authored at the template's base fps.
- **Forms come from the schema.** `parseSchemaToJsonSchema()` turns a template's Zod schema into JSON Schema with layout hints; `SchemaFields` renders it (text, numbers, enums, colours and a media upload) and the same schema validates it.
- **Overrides, not a keyframe editor.** `buildSettings()` turns the user's choices (screen media, body colour, background, fps, duration, speed, camera FOV and distance) into stage settings (`templates/motion.ts`). Speed and fps change how output frames map to authored frames, so scenes never need rewriting.
- **Deterministic time.** Everything is a pure function of the frame number: the keyframe interpolator (`src/domain/animation`), the GSAP overlay timelines (paused and seeked, never ticking), the `shaders` background (frame-locked renderer, advanced by exact deltas), video screens (`currentTime`) and Rive screens (low-level runtime, manual stepping). Scrubbing, playback and export therefore show the same pixels.
- **3D stage.** `SceneStage.vue` hosts the canvas, provides the scene context, and renders the template's `Scene.vue`. Screen media (image, MP4/WebM or `.riv`) is painted to a canvas texture on the screen mesh, once for stills and per frame only for video and Rive. The background (studio backdrop by default) is a scene texture at the frame's aspect, redrawn only when it animates.
- **Render in the browser.** `src/domain/export/videoExport.ts` drives Mediabunny (WebCodecs): for each frame the stage is seeked, the 3D canvas and the HTML overlay (rasterized with `html-to-image`) are composited and encoded to H.264 MP4, or VP9 WebM when H.264 is unavailable. Stills (PNG, WebP, JPEG) use the same compositor.
- **Local storage only.** The brand profile and the draft live in `localStorage`. Uploaded media stays in memory as object URLs and is not saved.

## Templates

| Template ID         | Category     | Frame (px)  | Length | Description                                                 |
| :------------------ | :----------- | :---------- | :----- | :---------------------------------------------------------- |
| `macbook-reveal-v1` | Laptop       | 3840 × 2160 | 6 s    | MacBook rises onto the platform, opens, holds, then exits   |
| `macbook-podium-v1` | Laptop       | 3840 × 2160 | 6 s    | MacBook on a lit podium with a slow camera and soft shadows |
| `iphone-helix-v1`   | Phone        | 2160 × 2160 | 9 s    | One iPhone spirals up, settles face-on, then spins away     |
| `iphone-fanout-v1`  | Multi-device | 3840 × 2160 | 5 s    | Five iPhones rise and fan out side by side                  |

Export at 100%, 50% or 25% of the frame size. 4K H.264 needs hardware support; the exporter checks `canEncodeVideo` and falls back or explains.

## Keyboard

`Space` play/pause · `←` / `→` step one frame · `Shift` + arrow steps ten.

## Browser support

Needs WebCodecs (`VideoEncoder`) for video: Chrome/Edge 94+, Safari 16.4+, Firefox 130+. The animated shader background uses WebGPU and falls back to a static gradient elsewhere. Keep the tab open and visible while rendering, because browsers pause animation frames in background tabs.

## Adding a template

1. Copy a folder in `templates/` (for example `macbook-reveal-v1`).
2. Edit `Scene.vue`: place `<Device>`s (model in `public/models`, screen and body mesh names), a `<SceneCamera>` and lights, and animate with `useTrack([...keyframes])` authored at the template's base fps. Anything Tres supports works here.
3. Update `index.ts` (id, label, resolution, defaults) and capture a `thumbnail.png`.

```vue
<script setup lang="ts">
import Device from '@/components/studio/scene/Device.vue'
import SceneCamera from '@/components/studio/scene/SceneCamera.vue'
import SceneLights from '@/components/studio/scene/SceneLights.vue'
import { useTrack } from '@/components/studio/scene/context'

const rise = useTrack([
  { frame: 0, value: [0, -3, 0], easing: 'easeOutCubic' },
  { frame: 90, value: [0, 0, 0] },
])
</script>

<template>
  <SceneCamera :position="[0, 0, 7]" :fov="34" />
  <SceneLights />
  <Device
    model="/models/apple-iphone-15-pro-max-black.glb"
    screen="pIJKfZsazmcpEiU"
    :position="rise"
  />
</template>
```

## Development

```bash
bun install
bun run dev        # http://localhost:5173
bun run lint       # type-aware lint
bun run test:unit
bun run build
```

GLB models, textures and `.riv` files are tracked with Git LFS (see `.gitattributes`). Install Git LFS before cloning.

## Docker

```bash
bun run docker:build
bun run docker:start   # http://localhost:2000
```

## License

MIT