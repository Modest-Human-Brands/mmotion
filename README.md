# MMotion

> Prompt-driven brand story videos. Pick a template, enter your brand, paste a script and get an
> animated, narrated video with illustrated characters and diagrams that react to the narration,
> then keep changing it by prompt. Everything runs in the browser against a local
> OpenAI-compatible model server; nothing is uploaded.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## Flow

**Template → Brand → Script → Studio → Export**

1. **Template**: an aesthetic and storytelling reference: layout chrome, chapter palettes, type,
   motion, illustration style and story arc (Soft Explainer, Minimal Tech, Bold Editorial, Soft
   Gradient).
2. **Brand**: logo, colours and fonts, saved on this device.
3. **Script**: prose, a voiceover script or a scene-by-scene outline, plus the format (9:16, 16:9,
   1:1) and the models to use (picked from the server's `/v1/models`).
4. **Studio**: preview with timeline, scenes grouped by chapter, illustration progress with
   retry/redraw, version history with undo/redo, and a prompt box. Each prompt edits the existing
   video ("turn this into a radial diagram", "the mother should sit next to the child in this
   picture", "switch to the Soft Explainer template"); select a scene first to scope the request.
   The studio opens as soon as the story exists; narration and pictures fill in behind it.
5. **Export**: MP4 (H.264 + AAC narration) or a PNG of the current frame.

## How it works

See [docs/PLAN.md](docs/PLAN.md) for the architecture, the reference analysis and the cycle plan.

- **The video is a document** (`src/core/composition`): a Zod-validated composition with chapters
  (light or dark tone), a recurring cast (character sheet + seed) and scenes. Each scene has chrome
  (headline, step badge, caption), one visual element and beats: phrases in the narration that
  highlight, reveal, check or raise parts of the element, or swap the caption.
- **Element library** (`src/render/elements`): a generated `illustration` plus code-drawn
  `radialDiagram`, `chips`, `sliders`, `checklist`, `speechBubble`, `splitCards`, `bigWord`, `stat`,
  `quote` and `logoReveal`, each a pure function of scene time and beats. Icons come from a curated
  Lucide set.
- **Agents** (`src/core/agent`) call the model server from the browser with strict JSON schemas and
  thinking switched off: a story pass (chapters, cast, scenes, narration) and a direction pass in
  batches (element, params, beats per scene); the edit agent turns a prompt into typed operations
  (`updateScene`, `addScene`, `removeScene`, `moveScene`, `regenerateIllustration`, `updateChapter`,
  `addChapter`, `updateCast`, `setBrand`, `setTemplate`, `setMeta`) applied and validated by pure
  code (`ops.ts`), with one repair round for failed ops.
- **Narration** (`src/core/audio`): one TTS clip per scene, transcribed for word timings so beats
  land on the spoken word; both cached in IndexedDB, so edits only re-voice changed scenes.
- **Illustrations** (`src/core/assets`): cast sheet + template style + scene prompt with a fixed
  seed, generated in a background queue with placeholders and cached by prompt. The queue pauses
  while the writing or speech models run, because they share one GPU.
- **Templates** (`src/core/templates`): design systems as data (palette mode, background, type,
  motion, transitions, illustration style, arc, preferred elements).
- **Export** (`src/domain/export`): each frame is rasterized from the stage (html-to-image `toSvg`)
  and encoded with Mediabunny (WebCodecs), with the narration mix as the audio track.
- **Parked**: the TresJS 3D device scenes live in `src/scenes/device` (cycle 3).

## Requirements

- A local OpenAI-compatible server (default `http://127.0.0.1:8981`) with CORS enabled. Models are
  chosen in the studio settings:
  - writing: structured output (tested with `gemma-4-12b-it`);
  - illustrations: `/v1/images/generations` (tested with `qwen-image-2.1-turbo`);
  - narration: `/v1/audio/speech` (tested with `voxcpm2-audiocpp`);
  - word timing: `/v1/audio/transcriptions` with word timestamps (tested with
    `parakeet-tdt-0.6b-v3` and `whisper-large-v3`).
    Only writing is required; without the others you get placeholders, no voice or evenly spread beats.
- A browser with WebCodecs (Chrome/Edge 94+, Safari 16.4+, Firefox 130+). Keep the tab visible while
  exporting; browsers pause rendering in background tabs.

## Development

```bash
bun install
bun run dev        # http://localhost:5173
bun run lint
bun run test:unit
bun run build
```

Agent tests against a live server are opt-in:

```bash
MMOTION_LIVE=1 MMOTION_MODEL=gemma-4-12b-it bunx vp test run src/core/agent
```

## License

MIT