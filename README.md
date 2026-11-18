# MMotion

> Prompt-driven brand motion videos. Pick the kind of video, a look and an art style, enter your
> brand, write a few scenes (or paste a script, or adapt a video) and get an animated, narrated
> video with illustrated characters and diagrams that react to the narration, then keep changing
> it by prompt. Everything runs in the browser against a local OpenAI-compatible model server;
> nothing is uploaded.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## Flow

**Start → Brand → Source → Story → Cast → Storyboard → Studio → Export**

Each step after Source is a checkpoint: it runs only the next, cheaper piece of work and waits for
your approval before the expensive ones start, so you steer early instead of after a full render.
Approved steps stay open in the stepper; edits to an earlier step keep what later steps can reuse.

1. **Start**: three independent choices, each previewed with neutral sample content:
   - **Kind**: the story's shape: arc, pacing, length presets and preferred visuals. Explainer,
     tutorial / how-to, product launch, social ad (hook in two seconds), data story, testimonial,
     event / announcement, kinetic quote.
   - **Look**: the design system: layout, type, chapter colours, background and motion. Soft,
     Minimal tech, Bold editorial, Gradient, Corporate clean, Playful, Cinematic, Retro.
   - **Art style**: how pictures are drawn, from 51 styles in seven families (flat & vector,
     illustration, comics & anime, fine art, retro & digital, 3D & craft, photographic), each
     described in words (no living artists' names). **Draw previews** draws one small sample per
     style with the model the router would use, once, and keeps it on this device.
2. **Brand**: logo, colours and fonts, saved on this device.
3. **Source**: a **brief** (goal, audience, tone, call to action, length), then the content as
   **scene blocks** (chapter, headline, step badge, visual idea, narration; add, reorder, split,
   merge, number as steps). **Paste a script** splits anything into blocks without a model
   (numbered lists become steps, headings become chapters, a long voiceover is cut every two
   sentences). **Adapt a video**: it is transcribed and watched, and you get blocks (original
   wording kept, or rewritten), the recurring characters and objects cut out of their clearest
   frames, a narrator sample and a suggested kind, look and format (translated when the video's
   language differs). Choose the language (English, Bengali, Hindi) and answer whether the video
   is for commercial use (asked for every video; commercial videos never use non-commercial
   models). Models are chosen automatically per job; the Models panel shows each choice and why,
   and lets you pin one.
4. **Story**: chapters, scenes, headlines, visual ideas and narration only (~1 min). Edit lines in
   place or by prompt.
5. **Cast**: every character and object gets one approved look (a sheet), drawn from its
   references in the video's art style or keeping the reference's look; pick from options, add
   references, lock members, mark objects as exact (logo, product: shown as is, never drawn).
   **Make like a reference** lists how a picture you like differs and redraws only what you tick.
   Choose the narrator: the model's voice or a clone of a sample (with permission). Changing the
   video's art style here offers to redraw the sheets from their references (or the old sheet).
6. **Storyboard**: one visual per scene, beats synced to the narration, pictures drawn from the
   sheets in the background. Prompt edits apply in place; approving records the narration. The
   art style can be changed for the whole video, one chapter (a flashback) or one scene; only the
   affected pictures redraw.
7. **Studio**: the full cut with narration, version history and prompt edits. The **Narration**
   tab edits each spoken line (only that line is recorded again), records a new take, plays a
   line, and shows its waveform and the words the transcriber heard; `[tags]` set delivery when
   the voice model understands them.
8. **Export**: MP4 (H.264 + AAC narration) or a PNG of the current frame.

## How it works

See [docs/PLAN.md](docs/PLAN.md) for the architecture, the reference analysis and the cycle plan.

- **The video is a document** (`src/core/composition`): a Zod-validated composition with chapters
  (light or dark tone), a recurring cast (character sheet + seed) and scenes. Each scene has chrome
  (headline, step badge, caption), one visual element and beats: phrases in the narration that
  highlight, reveal, check or raise parts of the element, or swap the caption.
- **Element library** (`src/render/elements`): a generated `illustration` plus code-drawn
  `radialDiagram`, `chips`, `sliders`, `checklist`, `speechBubble`, `splitCards`, `bigWord`, `stat`,
  `quote`, `logoReveal` and `showcase` (an exact object's real image), each a pure function of scene time and beats. Icons come from a curated
  Lucide set.
- **Agents** (`src/core/agent`) call the model server from the browser with strict JSON schemas and
  thinking switched off: a story pass (chapters, cast, scenes, narration) and a direction pass in
  batches (element, params, beats per scene); the edit agent turns a prompt into typed operations
  (`updateScene`, `addScene`, `removeScene`, `moveScene`, `regenerateIllustration`, `updateChapter`,
  `addChapter`, `updateCast`, `setBrand`, `setTemplate`, `setStyle`, `setMeta`) applied and
  validated by pure code (`ops.ts`), with one repair round for failed ops. Writing follows the
  kind's arc and pacing and the brief's target length.
- **Narration** (`src/core/audio`): one TTS clip per scene, transcribed for word timings so beats
  land on the spoken word; both cached in IndexedDB, so edits only re-voice changed scenes. Once
  recorded, each scene lasts as long as its line (never less than its text needs to be read).
- **Pictures** (`src/core/assets`): scenes are drawn by editing the sheets of the people in them
  (a reference-capable model such as `h3-image`, up to two references), so identity is carried by
  pixels, not words; without one they are drawn from descriptions. Sheets drawn from references
  in the video's art style (and scenes in another style than their sheets) go to a model that
  restyles (`qwen-image-2.1-uncensored`, one reference), because `h3-image` keeps the reference's
  own drawing style; scene pictures wait while sheets are being redrawn. Each scene is drawn in its
  art style (scene, else chapter, else video, else the look's), named in the prompt's opening
  words; full-bleed styles (photos, paintings) are shown framed instead of cut out. Uploads, crops
  and sheets are stored in IndexedDB by content hash; pictures are cached by prompt, seed and
  references.
- **Model router** (`src/core/models`): a catalog of each model's strengths, languages and
  licence (from model cards, confirmed on the server) plus live server facts picks a model per
  job, language, licence and art style (each style lists the picture models that suit it).
  Failures are classified: an engine that is restarting is retried
  after a growing pause, a model that cannot work is skipped for the session, and the job moves
  to the next best model.
- **One model call at a time** (`src/core/llm/client.ts`): a local server rarely holds several
  models at once, so calls are queued; what you are waiting for goes first and interrupts a
  background picture, which re-queues; queued work for the loaded model runs before switching.
- **Video intake** (`src/core/intake`, `src/core/agent/vision.ts`): frames as numbered contact
  sheets plus a timed transcript for the outline and cast; a second look boxes each member in its
  frame for the crop.
- **Kinds, looks, art styles** (`src/core/kinds.ts`, `src/core/templates`, `src/core/styles.ts`):
  data. A kind has an arc, pacing, lengths, preferred elements and a neutral sample story; a look
  has palette mode, background, type, motion and transitions (stored as `templateId`); a style
  has a prompt, what to avoid, its background and its best models.
- **Story builder** (`src/core/blocks.ts`): scene blocks, the paste parser and the outline the
  writer reads.
- **Export** (`src/domain/export`): each frame is rasterized from the stage (html-to-image `toSvg`)
  and encoded with Mediabunny (WebCodecs), with the narration mix as the audio track.
- **Parked**: the TresJS 3D device scenes live in `src/scenes/device` (cycle 3).

## Requirements

- A local OpenAI-compatible server (default `http://127.0.0.1:8981`) with CORS enabled. The app
  reads `/v1/models` and routes each job itself: writing (structured output), seeing (image
  input), pictures (`/v1/images/generations`), pictures from references (`/v1/images/edits`),
  narration and cloning (`/v1/audio/speech`, `ref_audio` + `ref_text`), word timing and
  transcription (`/v1/audio/transcriptions`). Only a writing model is required.
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