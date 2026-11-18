/**
 * What each model is good at, from model cards and reviews (see docs/PLAN.md for sources) and
 * measurements on the local server. The router combines this with live facts from `/v1/models`.
 * Models the server offers that are not listed here still work, with a neutral score.
 */

export const TASKS = [
  'write',
  'see',
  'draw',
  'draft',
  'drawFromRefs',
  'restyle',
  'speak',
  'clone',
  'time',
  'transcribe',
] as const
export type Task = (typeof TASKS)[number]

export const TASK_LABEL: Record<Task, string> = {
  write: 'Writing',
  see: 'Seeing (video, references)',
  draw: 'Pictures',
  draft: 'Quick drafts',
  drawFromRefs: 'Pictures from references',
  restyle: 'References in a new art style',
  speak: 'Narration',
  clone: 'Cloned voice',
  time: 'Word timing',
  transcribe: 'Transcribing video',
}

/** `unknown`: no clear licence for commercial use; allowed, with a warning. */
export type Licence = 'commercial' | 'non-commercial' | 'unknown'

export interface ModelProfile {
  id: string
  /** Fit per task, 1 (works) to 10 (best choice). Missing = not for that task. */
  fit: Partial<Record<Task, number>>
  licence: Licence
  /** Speech and transcription: language codes, or '*' for (nearly) all. */
  languages?: string[]
  /** Languages that work in tests but are not officially supported. */
  beta?: string[]
  /** Languages where this model measured clearly better than the others here. */
  strong?: string[]
  /** Speech: understands inline delivery tags like `[whisper]`. */
  tags?: boolean
  /** One line on why, shown as the routing reason. */
  note: string
}

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
] as const
export type LanguageCode = (typeof LANGUAGES)[number]['code']
export const languageName = (code: string) =>
  LANGUAGES.find((language) => language.code === code)?.name ?? code

export const CATALOG: ModelProfile[] = [
  // ------------------------------------------------------------------- writing
  {
    id: 'gemma-4-12b-it',
    fit: { write: 9, see: 8 },
    licence: 'commercial',
    note: 'reliable structured output, fast without thinking, reads images and video frames',
  },
  {
    id: 'minicpm-o-4-5-q8-0',
    fit: { write: 5, see: 7 },
    licence: 'unknown',
    note: 'strong OCR and high-fps video understanding',
  },
  {
    id: 'huihui-qwen3.8-27b-abliterated',
    fit: { write: 6 },
    licence: 'unknown',
    note: 'better long-range planning, slow',
  },
  // ------------------------------------------------------------------- pictures
  {
    id: 'h3-image',
    // Measured: ~90-100 s per picture with one or two references; copies the references' own
    // drawing style whatever the prompt asks, so it is a poor choice for changing style.
    fit: { drawFromRefs: 9, restyle: 2, draw: 6 },
    licence: 'unknown',
    note: 'keeps identity and the drawing style of reference images; photoreal detail',
  },
  {
    id: 'qwen-image-2.1-uncensored',
    // Measured: ~50 s per reference edit; redraws a reference in the asked style, identity kept.
    fit: { drawFromRefs: 7, restyle: 9, draw: 6 },
    licence: 'unknown',
    note: 'redraws references in another art style and keeps who they are; fast edits',
  },
  {
    id: 'qwen-image-edit-2511',
    fit: { drawFromRefs: 8, restyle: 6 },
    licence: 'commercial',
    note: 'consistent characters across edits (needs Qwen2.5-VL weights on this server)',
  },
  {
    id: 'qwen-image-2.1-turbo',
    fit: { draw: 8, draft: 10 },
    licence: 'unknown',
    note: 'fast, clean flat illustration, good text rendering',
  },
  {
    id: 'moss-image-sft',
    fit: { draw: 7, draft: 5 },
    licence: 'commercial',
    note: 'small, stylised and anime illustration',
  },
  // ---------------------------------------------------------------------- voice
  {
    id: 'voxcpm2-audiocpp',
    fit: { speak: 9 },
    licence: 'commercial',
    languages: ['en', 'hi', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ar'],
    beta: ['bn'],
    note: 'natural 48 kHz narration in 30 languages (Bengali works in tests)',
  },
  {
    id: 'fish-audio-s2-pro',
    fit: { speak: 7, clone: 9 },
    licence: 'non-commercial',
    languages: ['*'],
    strong: ['bn'],
    tags: true,
    note: 'voice cloning and emotion tags in 80+ languages; non-commercial licence',
  },
  {
    id: 'omnivoice',
    fit: { speak: 5, clone: 6 },
    licence: 'unknown',
    languages: ['*'],
    note: 'zero-shot voices in 600+ languages',
  },
  // ------------------------------------------------------------------ listening
  {
    id: 'parakeet-tdt-0.6b-v3',
    fit: { time: 9, transcribe: 6 },
    licence: 'commercial',
    languages: [
      'en',
      'de',
      'fr',
      'es',
      'it',
      'pt',
      'nl',
      'pl',
      'sv',
      'da',
      'fi',
      'el',
      'cs',
      'sk',
      'sl',
      'hr',
      'hu',
      'ro',
      'bg',
      'et',
      'lv',
      'lt',
      'mt',
      'ru',
      'uk',
    ],
    note: 'precise native word timestamps for European languages',
  },
  {
    id: 'whisper-large-v3',
    fit: { time: 7, transcribe: 9 },
    licence: 'commercial',
    languages: ['*'],
    note: 'transcribes 99 languages',
  },
]

export const profile = (id: string) => CATALOG.find((entry) => entry.id === id)