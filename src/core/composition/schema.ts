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
  /** illustration: what happens in the picture, using cast names. */
  prompt: z.string(),
  /** illustration: cast members in the picture. */
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
  element: elementSchema,
  beats: z.array(beatSchema).max(8),
  /** Narration for this scene; empty means silent. */
  voiceover: z.string(),
  /** Seconds. Grows to fit the narration once it is generated. */
  duration: z.number().min(1).max(30),
  /** How this scene enters over the previous one. */
  transition: z.enum(TRANSITIONS),
})
export type Scene = z.infer<typeof sceneSchema>

export const chapterSchema = z.object({
  id: z.string().min(1),
  /** Eyebrow label shown on every scene of the chapter. */
  title: z.string(),
  /** `dark` chapters use the brand colour as the ground (e.g. the closing section). */
  tone: z.enum(['light', 'dark']),
})
export type Chapter = z.infer<typeof chapterSchema>

export const castMemberSchema = z.object({
  name: z.string().min(1),
  /** Appearance and outfit, repeated verbatim in every illustration prompt. */
  description: z.string(),
})
export type CastMember = z.infer<typeof castMemberSchema>

export const castSchema = z.object({
  members: z.array(castMemberSchema).max(6),
  seed: z.number().int().min(0),
})
export type Cast = z.infer<typeof castSchema>

export const compositionSchema = z
  .object({
    version: z.literal(2),
    title: z.string(),
    format: z.enum(Object.keys(FORMATS) as [FormatId, ...FormatId[]]),
    fps: z.number().int().min(12).max(60),
    templateId: z.string().min(1),
    brand: brandSchema,
    cast: castSchema,
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

let counter = 0
export const newId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`