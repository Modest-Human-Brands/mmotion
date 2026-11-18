import { applyOps, parseRawOp, type EditOp, type RawOp } from '@/core/composition/ops'
import {
  DEFAULT_VOICE,
  castMember,
  compositionSchema,
  emptyElement,
  type CastMember,
  newId,
  type Beat,
  type BrandTokens,
  type Chapter,
  type Composition,
  type ElementItem,
  type ElementKind,
  type FormatId,
  type Scene,
} from '@/core/composition/schema'
import { estimateDuration } from '@/core/composition/timing'
import { chatJson } from '@/core/llm/client'
import { languageName } from '@/core/models/catalog'
import { getKind } from '@/core/kinds'
import { isStyle } from '@/core/styles'
import { getTemplate, isTemplate } from '@/core/templates'
import { ICONS } from '@/render/icons'

import {
  DIRECTION_SYSTEM,
  EDIT_SYSTEM,
  STORY_SYSTEM,
  describeComposition,
  directionSchema,
  editSchema,
  guide,
  storySchema,
  type Brief,
} from './prompts'

export type { Brief } from './prompts'

export interface Endpoint {
  baseUrl: string
  model: string
  signal?: AbortSignal
}

interface StoryDraft {
  title: string
  cast: { name: string; description: string }[]
  chapters: { title: string; tone: 'light' | 'dark' }[]
  scenes: {
    chapter: number
    headline: string
    step: string
    caption: string
    visual: string
    voiceover: string
  }[]
}

interface Direction {
  n: number
  kind: ElementKind
  prompt: string
  cast: string[]
  items: ElementItem[]
  center: ElementItem
  text: string
  subtext: string
  beats: Beat[]
}

export interface StoryInput {
  script: string
  /** The look. */
  templateId: string
  kindId?: string
  /** Art style of the pictures; "" = the look's. */
  styleId?: string
  brief?: Partial<Brief>
  brand: BrandTokens
  format: FormatId
  fps: number
  /** Characters and objects already known (from a video or the Cast step); kept as they are. */
  cast?: CastMember[]
  /** Language code for narration and on-screen text (default English). */
  language?: string
  commercial?: boolean
}

/** The instruction every writing call carries so text stays in the project language. */
export const languageRule = (code = 'en') =>
  code === 'en'
    ? 'Write all headlines, captions, narration, labels and on-screen text in English.'
    : `Write all headlines, captions, narration, labels and on-screen text in ${languageName(code)}, in its native script, natural and idiomatic (not a word-for-word translation). If the script is in another language, translate it faithfully. Cast names, icon names and field names stay in English.`

/** Scenes per direction call: keeps each answer well inside the model's output limit. */
const DIRECTION_BATCH = 6

/**
 * Scenes per direction call. Non-Latin scripts take several times more tokens per word, so the
 * same answer would overflow the model's output limit.
 */
export const directionBatch = (language = 'en') =>
  /^(en|de|fr|es|it|pt|nl|sv|da|fi|pl|cs|ro|hu)$/.test(language) ? DIRECTION_BATCH : 3

/** Errors that mean the answer was cut off (too long), not that the request was wrong. */
export const truncated = (message: string) =>
  /not a complete JSON|malformed JSON|empty answer|unexpected end/i.test(message)

/** Script outlines label visuals ("STATEMENT: …", "BIG WORD: …"); the label is not content. */
const VISUAL_LABEL =
  /^\s*(illustration|diagram|chips|sliders|checklist|bubble|compare|big word|stat|quote|statement|logo|showcase)\s*:\s*/i
export function cleanText(text: string): string {
  const stripped = text.replace(VISUAL_LABEL, '').trim()
  const quoted = /^["“'](.*)["”']$/.exec(stripped)
  return quoted ? quoted[1]!.trim() : stripped
}

const knownIcon = (name: string) => (name in ICONS ? name : '')
const cleanItem = (item: ElementItem): ElementItem => ({ ...item, icon: knownIcon(item.icon) })

const NEEDS_ITEMS = new Set<ElementKind>([
  'radialDiagram',
  'chips',
  'sliders',
  'checklist',
  'splitCards',
])
const NEEDS_TEXT = new Set<ElementKind>(['bigWord', 'stat', 'quote', 'speechBubble'])

/** Small models sometimes pick a kind but fill another kind's fields; fall back to what they wrote. */
export function repairKind(direction: Direction): ElementKind {
  const { kind } = direction
  // A statement scene that came with a picture description is a picture.
  if (kind === 'none' && direction.prompt.trim()) return 'illustration'
  const missing =
    (NEEDS_ITEMS.has(kind) && direction.items.filter((item) => item.label.trim()).length < 2) ||
    (NEEDS_TEXT.has(kind) && !direction.text.trim()) ||
    (kind === 'illustration' && !direction.prompt.trim())
  if (!missing) return kind
  if (direction.prompt.trim()) return 'illustration'
  if (direction.text.trim()) return 'bigWord'
  return 'none'
}

/**
 * Beat targets are 0-based, but models often count from 1. When a scene's targets for item
 * actions run 1…n over n items, shift them down.
 */
function normalizeBeats(beats: Beat[], itemCount: number): Beat[] {
  const itemBeats = beats.filter((beat) => ['highlight', 'reveal', 'check'].includes(beat.action))
  const targets = itemBeats.map((beat) => beat.target)
  const oneBased =
    itemCount > 0 &&
    targets.length > 0 &&
    Math.min(...targets) >= 1 &&
    Math.max(...targets) === itemCount
  return beats.map((beat) =>
    oneBased && itemBeats.includes(beat) ? { ...beat, target: beat.target - 1 } : beat,
  )
}

type Caller = <T>(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  name: string,
) => Promise<T>

function caller(endpoint: Endpoint): Caller {
  return (system, user, schema, name) =>
    chatJson({
      baseUrl: endpoint.baseUrl,
      model: endpoint.model,
      signal: endpoint.signal,
      system,
      user,
      schema,
      schemaName: name,
      temperature: 0.5,
    })
}

const castLine = (members: CastMember[]) =>
  members
    .map((member) => `${member.name} (${member.kind}${member.exact ? ', exact' : ''})`)
    .join(', ') || 'none'

/**
 * Pass 1, script → story: chapters, cast and scenes with headline, caption, narration and a visual
 * idea. Scenes have no element yet (`none`); `directScenes` adds them once the story is approved.
 */
export async function writeOutline(
  endpoint: Endpoint,
  input: StoryInput,
  onProgress: (message: string) => void = () => {},
): Promise<Composition> {
  const template = getTemplate(input.templateId)
  const kind = getKind(input.kindId ?? 'explainer')
  const known = input.cast ?? []
  const knownLine = known.length
    ? `Known cast (use exactly these names; add others only if the script needs them): ${known.map((member) => `${member.name}: ${member.description}`).join(' | ')}\n`
    : ''
  onProgress('Writing the story')
  const story = await caller(endpoint)<StoryDraft>(
    STORY_SYSTEM,
    `${guide(kind.id, template.id, input.brief)}
Brand: ${input.brand.name || 'unnamed'}. Video format: ${input.format}.
${languageRule(input.language)}
${knownLine}
Script:
"""
${input.script.trim()}
"""`,
    storySchema,
    'story',
  )
  if (story.scenes.length === 0) throw new Error('The story came back empty. Try again.')

  const chapters: Chapter[] = (
    story.chapters.length ? story.chapters : [{ title: '', tone: 'light' as const }]
  ).map((chapter) => ({
    id: newId('c'),
    title: chapter.title,
    tone: chapter.tone,
    styleId: '',
  }))

  const members = [...known]
  for (const member of story.cast) {
    if (!member.name.trim()) continue
    if (!members.some((item) => item.name.toLowerCase() === member.name.toLowerCase()))
      members.push(castMember(member.name.trim(), member.description))
  }

  const scenes: Scene[] = story.scenes.slice(0, 40).map((draft, index) => {
    const chapter = chapters[Math.min(Math.max(0, draft.chapter), chapters.length - 1)]!
    const scene: Scene = {
      id: newId('s'),
      chapterId: chapter.id,
      chrome: { headline: draft.headline, step: draft.step, caption: draft.caption },
      brief: draft.visual,
      element: emptyElement(),
      beats: [],
      voiceover: draft.voiceover,
      voiceTake: 0,
      duration: 3,
      transition: index === 0 ? 'cut' : (template.transitions[0] ?? 'fade'),
      styleId: '',
    }
    return { ...scene, duration: estimateDuration(scene) }
  })

  const parsed = compositionSchema.safeParse({
    version: 2,
    title: story.title || 'Untitled',
    format: input.format,
    fps: input.fps,
    templateId: template.id,
    kindId: kind.id,
    styleId: input.styleId && isStyle(input.styleId) ? input.styleId : '',
    brand: input.brand,
    cast: { members: members.slice(0, 8), seed: Math.floor(Math.random() * 100_000) },
    voice: DEFAULT_VOICE,
    language: input.language ?? 'en',
    commercial: input.commercial ?? false,
    chapters,
    scenes,
  } satisfies Composition)
  if (!parsed.success) throw new Error('The story came back incomplete. Try again.')
  return parsed.data
}

/** Pass 2, visual direction: element, its content and beats for the given scenes (all by default). */
export async function directScenes(
  endpoint: Endpoint,
  composition: Composition,
  sceneIds: string[] = composition.scenes.map((scene) => scene.id),
  onProgress: (message: string) => void = () => {},
): Promise<Composition> {
  const wanted = new Set(sceneIds)
  const targets = composition.scenes
    .map((scene, index) => ({ scene, n: index + 1 }))
    .filter(({ scene }) => wanted.has(scene.id))
  const directions = new Map<number, Direction>()
  type Target = (typeof targets)[number]
  const direct = async (batch: Target[]): Promise<void> => {
    const listing = batch
      .map(({ scene, n }) => {
        const chapter = composition.chapters.find((item) => item.id === scene.chapterId)
        const visual = scene.brief.trim() ? ` visual idea: "${scene.brief.trim()}"` : ''
        return `n=${n} [${chapter?.title ?? ''}${chapter?.tone === 'dark' ? ', dark closing chapter' : ''}] headline: "${scene.chrome.headline}" caption: "${scene.chrome.caption}"${visual} narration: "${scene.voiceover}"`
      })
      .join('\n')
    try {
      const answer = await caller(endpoint)<{ scenes: Direction[] }>(
        DIRECTION_SYSTEM,
        `${guide(composition.kindId, composition.templateId)}
Cast: ${castLine(composition.cast.members)}.
${languageRule(composition.language)} Picture prompts (element.prompt) stay in English.
The video has ${composition.scenes.length} scenes. Direct these:
${listing}`,
        directionSchema,
        'direction',
      )
      for (const direction of answer.scenes) directions.set(direction.n, direction)
    } catch (e) {
      // An answer cut off at the output limit: direct each half on its own.
      if (batch.length > 1 && e instanceof Error && truncated(e.message)) {
        const half = Math.ceil(batch.length / 2)
        await direct(batch.slice(0, half))
        await direct(batch.slice(half))
      } else throw e
    }
  }

  const size = directionBatch(composition.language)
  for (let start = 0; start < targets.length; start += size) {
    const batch = targets.slice(start, start + size)
    onProgress(`Directing scenes ${start + 1}–${start + batch.length} of ${targets.length}`)
    await direct(batch)
  }

  const scenes = composition.scenes.map((scene, index) => {
    const direction = wanted.has(scene.id) ? directions.get(index + 1) : undefined
    if (!direction) return scene
    const next: Scene = {
      ...scene,
      element: {
        ...emptyElement(repairKind(direction)),
        prompt: cleanText(direction.prompt),
        cast: direction.cast.slice(0, 4),
        items: direction.items.slice(0, 8).map(cleanItem),
        center: cleanItem(direction.center),
        text: cleanText(direction.text),
        subtext: cleanText(direction.subtext),
      },
      beats: normalizeBeats(direction.beats, direction.items.length).slice(0, 8),
    }
    return { ...next, duration: estimateDuration(next) }
  })
  const parsed = compositionSchema.safeParse({ ...composition, scenes })
  if (!parsed.success) throw new Error('The direction came back incomplete. Try again.')
  return parsed.data
}

/** Script → complete composition in one go (outline, then direction). */
export async function writeStory(
  endpoint: Endpoint,
  input: StoryInput,
  onProgress: (message: string) => void = () => {},
): Promise<Composition> {
  const outline = await writeOutline(endpoint, input, onProgress)
  return directScenes(endpoint, outline, undefined, onProgress)
}

export interface EditResult {
  composition: Composition
  reply: string
  ops: EditOp[]
  /** Ops that still failed after one repair round. */
  errors: string[]
}

function interpret(composition: Composition, raw: RawOp[]) {
  const ops: EditOp[] = []
  const errors: string[] = []
  for (const item of raw) {
    const parsed = parseRawOp(item)
    if (typeof parsed === 'string') errors.push(parsed)
    else ops.push(parsed)
  }
  const applied = applyOps(composition, ops, isTemplate, isStyle)
  // A template is designed around its heading typeface; switching brings it along unless the
  // same edit also chose a font.
  const next = applied.composition
  const display = getTemplate(next.templateId).displayFont
  const fontChosen = ops.some((op) => op.op === 'setBrand' && op.patch.fontDisplay)
  if (next.templateId !== composition.templateId && display && !fontChosen) {
    next.brand = { ...next.brand, fontDisplay: display }
  }
  return { ...applied, composition: next, ops, errors: [...errors, ...applied.errors] }
}

/** Prompt → minimal edits to the existing composition. One repair round on invalid ops. */
export async function editComposition(
  endpoint: Endpoint,
  composition: Composition,
  instruction: string,
  focusSceneId?: string,
): Promise<EditResult> {
  const ask = (user: string) =>
    chatJson<{ reply: string; ops: RawOp[] }>({
      baseUrl: endpoint.baseUrl,
      model: endpoint.model,
      signal: endpoint.signal,
      system: EDIT_SYSTEM,
      user,
      schema: editSchema,
      schemaName: 'edit',
      temperature: 0.2,
    })

  const base = `${guide(composition.kindId, composition.templateId)}
${languageRule(composition.language)} Picture prompts (element.prompt) stay in English.

Current video:
${describeComposition(composition)}
${focusSceneId ? `\nThe user is looking at scene id "${focusSceneId}"; "this" refers to it.` : ''}
Change request: ${instruction.trim()}`

  const first = await ask(base)
  let result = interpret(composition, first.ops)
  let reply = first.reply

  if (result.errors.length > 0) {
    const retry = await ask(`${base}

Your previous operations had problems:
${result.errors.map((error) => `- ${error}`).join('\n')}
Return the complete corrected list of operations.`)
    const second = interpret(composition, retry.ops)
    if (second.errors.length <= result.errors.length) {
      result = second
      reply = retry.reply
    }
  }

  return { composition: result.composition, reply, ops: result.ops, errors: result.errors }
}