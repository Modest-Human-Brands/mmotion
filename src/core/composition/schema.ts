import { z } from 'zod'

export const TRANSITIONS = ['cut', 'fade', 'slide', 'wipe', 'zoom'] as const
export type TransitionId = (typeof TRANSITIONS)[number]

/** The visual library. One element per scene; each kind documents which fields it reads. */
export const ELEMENT_KINDS = [
  'none',
  'illustration',
  'radialDiagram',
  'chips',
  'sliders',
  'checklist',
  'speechBubble',
  'splitCards',
  'bigWord',
  'stat',
  'quote',
  'logoReveal',
  'showcase',
] as const
export type ElementKind = (typeof ELEMENT_KINDS)[number]

/** Things that happen inside a scene at a spoken phrase. */
export const BEAT_ACTIONS = ['caption', 'highlight', 'reveal', 'check', 'raise'] as const
export type BeatAction = (typeof BEAT_ACTIONS)[number]

export const FORMATS = {
  portrait: { width: 1080, height: 1920, label: '9:16' },
  landscape: { width: 1920, height: 1080, label: '16:9' },
  square: { width: 1080, height: 1080, label: '1:1' },
} as const
export type FormatId = keyof typeof FORMATS

const hex = z.string().regex(/^#[\da-f]{6}$/i, 'Use a hex colour like #5945ea')

export const brandSchema = z.object({
  name: z.string(),
  logo: z.string(),
  primary: hex,
  accent: hex,
  background: hex,
  text: hex,
  fontDisplay: z.string().min(1),
  fontBody: z.string().min(1),
})
export type BrandTokens = z.infer<typeof brandSchema>

export const itemSchema = z.object({
  label: z.string(),
  /** Icon name from the bundled set (see render/icons.ts); "" for none. */
  icon: z.string(),
  detail: z.string(),
})
export type ElementItem = z.infer<typeof itemSchema>

export const elementSchema = z.object({
  kind: z.enum(ELEMENT_KINDS),
  /** illustration: what happens in the picture, using cast names. showcase: unused. */
  prompt: z.string(),
  /** illustration: cast members in the picture. showcase: the exact object to show (first name). */
  cast: z.array(z.string()).max(4),
  /** illustration: bump to get a new take with the same prompt. */
  variant: z.number().int().min(0),
  /** radialDiagram nodes, chips, sliders, checklist rows, splitCards cards. */
  items: z.array(itemSchema).max(8),
  /** radialDiagram: the hub. */
  center: itemSchema,
  /** bigWord / stat value / quote / speechBubble text. */
  text: z.string(),
  /** stat label / quote author. */
  subtext: z.string(),
})
export type SceneElement = z.infer<typeof elementSchema>

export const beatSchema = z.object({
  /** A phrase from the narration; the beat fires when it is spoken. */
  at: z.string(),
  action: z.enum(BEAT_ACTIONS),
  /** Item index for highlight / reveal / check / raise. */
  target: z.number().int().min(0),
  /** New caption for `caption`. */
  text: z.string(),
})
export type Beat = z.infer<typeof beatSchema>

export const chromeSchema = z.object({
  headline: z.string(),
  /** Step badge like "03/05"; "" for none. */
  step: z.string(),
  /** Caption card under the visual; "" for none. Caption beats replace it over time. */
  caption: z.string(),
})

export const sceneSchema = z.object({
  id: z.string().min(1),
  chapterId: z.string().min(1),
  chrome: chromeSchema,
  /** What the visual should show, in words (from the script or the story pass); guides direction. */
  brief: z.string().default(''),
  element: elementSchema,
  beats: z.array(beatSchema).max(8),
  /** Narration for this scene; empty means silent. `[tags]` are delivery hints, not spoken. */
  voiceover: z.string(),
  /** Bump to record the narration again with the same text. */
  voiceTake: z.number().int().min(0).default(0),
  /** Seconds. Grows to fit the narration once it is generated. */
  duration: z.number().min(1).max(30),
  /** How this scene enters over the previous one. */
  transition: z.enum(TRANSITIONS),
  /** Art style for this scene's picture; "" = the chapter's or the video's. */
  styleId: z.string().default(''),
})
export type Scene = z.infer<typeof sceneSchema>

export const chapterSchema = z.object({
  id: z.string().min(1),
  /** Eyebrow label shown on every scene of the chapter. */
  title: z.string(),
  /** `dark` chapters use the brand colour as the ground (e.g. the closing section). */
  tone: z.enum(['light', 'dark']),
  /** Art style for the chapter's pictures (e.g. a flashback); "" = the video's. */
  styleId: z.string().default(''),
})
export type Chapter = z.infer<typeof chapterSchema>

export const castMemberSchema = z.object({
  name: z.string().min(1),
  /** Appearance and outfit, for the writer and as the text fallback when there is no sheet. */
  description: z.string(),
  /** People and animals are drawn in poses; objects are things like a toy, product or logo. */
  kind: z.enum(['character', 'object']).default('character'),
  /** Asset ids of reference images (video crops, uploads). */
  refs: z.array(z.string()).max(4).default([]),
  /** Asset id of the approved sheet every picture is drawn from; "" until approved. */
  sheet: z.string().default(''),
  /** Art style the sheet was drawn in; a different video style redraws it from the sheet. */
  sheetStyle: z.string().default(''),
  /** Locked members are never redrawn or re-described by prompt edits. */
  locked: z.boolean().default(false),
  /** `template`: redraw in the template's illustration style; `source`: keep the references' look. */
  look: z.enum(['template', 'source']).default('template'),
  /** Objects shown with their real pixels (logo, product, UI) and never generated. */
  exact: z.boolean().default(false),
})
export type CastMember = z.infer<typeof castMemberSchema>

export const castSchema = z.object({
  members: z.array(castMemberSchema).max(8),
  seed: z.number().int().min(0),
})
export type Cast = z.infer<typeof castSchema>

export const voiceSchema = z.object({
  /** `default`: the speech model's own voice; `clone`: imitate `sample`. */
  mode: z.enum(['default', 'clone']),
  /** Asset id of a short WAV of the voice to imitate. */
  sample: z.string(),
  /** What is said in the sample (cloning models need it). */
  sampleText: z.string(),
})
export type Voice = z.infer<typeof voiceSchema>

export const DEFAULT_VOICE: Voice = { mode: 'default', sample: '', sampleText: '' }

export const compositionSchema = z
  .object({
    version: z.literal(2),
    title: z.string(),
    format: z.enum(Object.keys(FORMATS) as [FormatId, ...FormatId[]]),
    fps: z.number().int().min(12).max(60),
    /** The look (design system); see core/templates. */
    templateId: z.string().min(1),
    /** The kind of video (story shape); see core/kinds. */
    kindId: z.string().default('explainer'),
    /** Art style of generated pictures; "" = the look's. See core/styles. */
    styleId: z.string().default(''),
    brand: brandSchema,
    cast: castSchema,
    voice: voiceSchema.default(DEFAULT_VOICE),
    /** Language of narration and on-screen text (ISO code). */
    language: z.string().min(2).default('en'),
    /** The user said the video is for commercial use: no non-commercial models. */
    commercial: z.boolean().default(false),
    chapters: z.array(chapterSchema).min(1).max(12),
    scenes: z.array(sceneSchema).min(1).max(40),
  })
  .superRefine((composition, ctx) => {
    const chapters = new Set(composition.chapters.map((chapter) => chapter.id))
    composition.scenes.forEach((scene, index) => {
      if (!chapters.has(scene.chapterId))
        ctx.addIssue({
          code: 'custom',
          path: ['scenes', index, 'chapterId'],
          message: `unknown chapter "${scene.chapterId}"`,
        })
    })
  })
export type Composition = z.infer<typeof compositionSchema>

export const emptyItem = (): ElementItem => ({ label: '', icon: '', detail: '' })

export const emptyElement = (kind: ElementKind = 'none'): SceneElement => ({
  kind,
  prompt: '',
  cast: [],
  variant: 0,
  items: [],
  center: emptyItem(),
  text: '',
  subtext: '',
})

export const castMember = (
  name: string,
  description = '',
  patch: Partial<CastMember> = {},
): CastMember => ({
  name,
  description,
  kind: 'character',
  refs: [],
  sheet: '',
  sheetStyle: '',
  locked: false,
  look: 'template',
  exact: false,
  ...patch,
})

/** Narration without delivery tags like `[whisper]` or `[laughs]`. */
export const spokenWords = (text: string) =>
  text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

let counter = 0
export const newId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`