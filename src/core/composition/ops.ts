import { z } from 'zod'

import {
  FORMATS,
  TRANSITIONS,
  beatSchema,
  brandSchema,
  castMember,
  castMemberSchema,
  chapterSchema,
  chromeSchema,
  compositionSchema,
  elementSchema,
  emptyElement,
  itemSchema,
  newId,
  type Composition,
  type FormatId,
  type Scene,
} from './schema'
import { clampDuration, estimateDuration } from './timing'

/** Models often omit item fields they consider irrelevant; default them instead of failing. */
const looseItem = z.object({
  label: z.string().default(''),
  icon: z.string().default(''),
  detail: z.string().default(''),
})

const castPatchSchema = castMemberSchema.pick({ name: true, description: true })

const looseBeat = beatSchema.extend({
  target: z.number().int().min(0).default(0),
  text: z.string().default(''),
})

const elementPatchSchema = elementSchema
  .omit({ center: true, items: true })
  .partial()
  .extend({ items: z.array(looseItem).max(8).optional(), center: itemSchema.partial().optional() })

const scenePatchSchema = z
  .object({
    chapterId: z.string(),
    chrome: chromeSchema.partial(),
    brief: z.string(),
    element: elementPatchSchema,
    beats: z.array(looseBeat).max(8),
    voiceover: z.string(),
    duration: z.number(),
    transition: z.enum(TRANSITIONS),
    styleId: z.string(),
  })
  .partial()
type ScenePatch = z.infer<typeof scenePatchSchema>

const metaPatchSchema = z
  .object({
    title: z.string(),
    format: z.enum(Object.keys(FORMATS) as [FormatId, ...FormatId[]]),
  })
  .partial()

// Without the default, so a patch that leaves out the style keeps it.
const chapterPatchSchema = chapterSchema
  .omit({ id: true, styleId: true })
  .partial()
  .extend({ styleId: z.string().optional() })

export type EditOp =
  | { op: 'updateScene'; sceneId: string; patch: ScenePatch }
  | { op: 'addScene'; afterSceneId: string | null; patch: ScenePatch }
  | { op: 'removeScene'; sceneId: string }
  | { op: 'moveScene'; sceneId: string; afterSceneId: string | null }
  | { op: 'regenerateIllustration'; sceneId: string }
  | { op: 'updateChapter'; chapterId: string; patch: z.infer<typeof chapterPatchSchema> }
  | { op: 'addChapter'; afterChapterId: string | null; chapter: z.infer<typeof chapterSchema> }
  | { op: 'updateCast'; members: { name: string; description: string }[] }
  | { op: 'setBrand'; patch: Partial<Composition['brand']> }
  | { op: 'setTemplate'; templateId: string }
  /** `targetId`: a scene or chapter id; null = the whole video. "" style = inherit. */
  | { op: 'setStyle'; styleId: string; targetId: string | null }
  | { op: 'setMeta'; patch: z.infer<typeof metaPatchSchema> }

/** The flat shape models return (strict JSON schemas cannot express unions reliably). */
export interface RawOp {
  op: string
  /** Scene id, or chapter id for chapter ops. */
  sceneId: string
  /** Insert-after id (scene, or chapter for addChapter); "" = at the start. */
  afterSceneId: string
  /** JSON-encoded object whose meaning depends on `op`. */
  data: string
}

const issues = (error: z.ZodError) =>
  error.issues.map((issue) => `${issue.path.join('.') || 'data'}: ${issue.message}`).join('; ')

/** Turn a model's raw op into a typed op, or explain why it is unusable. */
export function parseRawOp(raw: RawOp): EditOp | string {
  let data: unknown = {}
  try {
    if (raw.data.trim()) data = JSON.parse(raw.data)
  } catch {
    return `${raw.op}: "data" is not valid JSON`
  }
  const after = raw.afterSceneId.trim() || null
  const parse = <T>(schema: z.ZodType<T>, then: (value: T) => EditOp): EditOp | string => {
    const parsed = schema.safeParse(data)
    return parsed.success ? then(parsed.data) : `${raw.op}: ${issues(parsed.error)}`
  }
  switch (raw.op) {
    case 'updateScene':
      return parse(scenePatchSchema, (patch) => ({
        op: 'updateScene',
        sceneId: raw.sceneId,
        patch,
      }))
    case 'addScene':
      return parse(scenePatchSchema, (patch) => ({ op: 'addScene', afterSceneId: after, patch }))
    case 'removeScene':
      return { op: 'removeScene', sceneId: raw.sceneId }
    case 'moveScene':
      return { op: 'moveScene', sceneId: raw.sceneId, afterSceneId: after }
    case 'regenerateIllustration':
      return { op: 'regenerateIllustration', sceneId: raw.sceneId }
    case 'updateChapter':
      return parse(chapterPatchSchema, (patch) => ({
        op: 'updateChapter',
        chapterId: raw.sceneId,
        patch,
      }))
    case 'addChapter':
      return parse(chapterSchema.partial({ id: true }), (chapter) => ({
        op: 'addChapter',
        afterChapterId: after,
        chapter: { ...chapter, id: chapter.id || newId('c') },
      }))
    case 'updateCast':
      return parse(z.object({ members: z.array(castPatchSchema) }), ({ members }) => ({
        op: 'updateCast',
        members,
      }))
    case 'setBrand':
      return parse(brandSchema.partial(), (patch) => ({ op: 'setBrand', patch }))
    case 'setTemplate':
      return parse(z.object({ templateId: z.string().min(1) }), ({ templateId }) => ({
        op: 'setTemplate',
        templateId,
      }))
    case 'setStyle':
      return parse(z.object({ styleId: z.string() }), ({ styleId }) => ({
        op: 'setStyle',
        styleId,
        targetId: raw.sceneId.trim() || null,
      }))
    case 'setMeta':
      return parse(metaPatchSchema, (patch) => ({ op: 'setMeta', patch }))
    default:
      return `unknown op "${raw.op}"`
  }
}

/** Compositions are plain JSON; this also unwraps reactive proxies, which structuredClone rejects. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function patchScene(scene: Scene, patch: ScenePatch): Scene {
  const element = patch.element
    ? {
        ...scene.element,
        ...patch.element,
        center: { ...scene.element.center, ...patch.element.center },
      }
    : scene.element
  const next: Scene = {
    ...scene,
    ...(patch.chapterId ? { chapterId: patch.chapterId } : {}),
    ...(patch.transition ? { transition: patch.transition } : {}),
    ...(patch.voiceover !== undefined ? { voiceover: patch.voiceover } : {}),
    ...(patch.beats ? { beats: patch.beats } : {}),
    ...(patch.brief !== undefined ? { brief: patch.brief } : {}),
    chrome: { ...scene.chrome, ...patch.chrome },
    element,
  }
  const wordsChanged =
    patch.voiceover !== undefined || patch.chrome !== undefined || patch.beats !== undefined
  if (patch.duration !== undefined) next.duration = clampDuration(patch.duration)
  else if (wordsChanged) next.duration = Math.max(scene.duration, estimateDuration(next))
  return next
}

const sceneIndex = (composition: Composition, id: string) =>
  composition.scenes.findIndex((scene) => scene.id === id)

export interface ApplyResult {
  composition: Composition
  /** One message per op that could not be applied; the others still apply. */
  errors: string[]
}

export function applyOps(
  composition: Composition,
  ops: EditOp[],
  isTemplate: (id: string) => boolean = () => true,
  isStyle: (id: string) => boolean = () => true,
): ApplyResult {
  let draft = clone(composition)
  const errors: string[] = []

  for (const op of ops) {
    const before = draft
    draft = clone(draft)
    let failed = false
    const fail = (message: string) => {
      errors.push(`${op.op}: ${message}`)
      failed = true
    }
    switch (op.op) {
      case 'updateScene': {
        const index = sceneIndex(draft, op.sceneId)
        if (index === -1) fail(`scene "${op.sceneId}" does not exist`)
        else draft.scenes[index] = patchScene(draft.scenes[index]!, op.patch)
        break
      }
      case 'addScene': {
        const at = op.afterSceneId === null ? 0 : sceneIndex(draft, op.afterSceneId) + 1
        if (at === 0 && op.afterSceneId !== null) {
          fail(`scene "${op.afterSceneId}" does not exist`)
          break
        }
        const neighbour = draft.scenes[Math.max(0, at - 1)]!
        const blank: Scene = {
          id: newId('s'),
          chapterId: neighbour.chapterId,
          chrome: { headline: '', step: '', caption: '' },
          brief: '',
          element: emptyElement(),
          beats: [],
          voiceover: '',
          voiceTake: 0,
          duration: 3,
          transition: 'fade',
          styleId: '',
        }
        const scene = patchScene(blank, op.patch)
        if (op.patch.duration === undefined) scene.duration = estimateDuration(scene)
        draft.scenes.splice(at, 0, scene)
        break
      }
      case 'removeScene': {
        const index = sceneIndex(draft, op.sceneId)
        if (index === -1) fail(`scene "${op.sceneId}" does not exist`)
        else if (draft.scenes.length === 1) fail('a video needs one scene')
        else draft.scenes.splice(index, 1)
        break
      }
      case 'moveScene': {
        const index = sceneIndex(draft, op.sceneId)
        if (index === -1) {
          fail(`scene "${op.sceneId}" does not exist`)
          break
        }
        const [scene] = draft.scenes.splice(index, 1)
        const at = op.afterSceneId === null ? 0 : sceneIndex(draft, op.afterSceneId) + 1
        if (at === 0 && op.afterSceneId !== null) fail(`scene "${op.afterSceneId}" does not exist`)
        else draft.scenes.splice(at, 0, scene!)
        break
      }
      case 'regenerateIllustration': {
        const scene = draft.scenes[sceneIndex(draft, op.sceneId)]
        if (!scene) fail(`scene "${op.sceneId}" does not exist`)
        else if (scene.element.kind !== 'illustration') fail('that scene has no illustration')
        else scene.element.variant += 1
        break
      }
      case 'updateChapter': {
        const chapter = draft.chapters.find((item) => item.id === op.chapterId)
        if (!chapter) fail(`chapter "${op.chapterId}" does not exist`)
        else Object.assign(chapter, op.patch)
        break
      }
      case 'addChapter': {
        const at =
          op.afterChapterId === null
            ? 0
            : draft.chapters.findIndex((item) => item.id === op.afterChapterId) + 1
        if (at === 0 && op.afterChapterId !== null)
          fail(`chapter "${op.afterChapterId}" does not exist`)
        else draft.chapters.splice(at, 0, op.chapter)
        break
      }
      case 'updateCast': {
        for (const member of op.members) {
          const existing = draft.cast.members.find(
            (item) => item.name.toLowerCase() === member.name.toLowerCase(),
          )
          if (existing?.locked) fail(`${existing.name} is locked; unlock them in Cast first`)
          else if (existing) existing.description = member.description
          else draft.cast.members.push(castMember(member.name, member.description))
        }
        break
      }
      case 'setBrand':
        draft.brand = { ...draft.brand, ...op.patch }
        break
      case 'setTemplate':
        if (isTemplate(op.templateId)) draft.templateId = op.templateId
        else fail(`unknown template "${op.templateId}"`)
        break
      case 'setStyle': {
        if (op.styleId && !isStyle(op.styleId)) {
          fail(`unknown style "${op.styleId}"`)
          break
        }
        if (op.targetId === null) {
          draft.styleId = op.styleId
          break
        }
        const scene = draft.scenes.find((item) => item.id === op.targetId)
        const chapter = draft.chapters.find((item) => item.id === op.targetId)
        if (scene) scene.styleId = op.styleId
        else if (chapter) chapter.styleId = op.styleId
        else fail(`no scene or chapter "${op.targetId}"`)
        break
      }
      case 'setMeta':
        draft = { ...draft, ...op.patch }
        break
    }

    if (failed) {
      draft = before
      continue
    }
    const valid = compositionSchema.safeParse(draft)
    if (!valid.success) {
      errors.push(`${op.op}: ${issues(valid.error)}`)
      draft = before
    }
  }

  return { composition: draft, errors }
}