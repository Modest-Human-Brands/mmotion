import { applyOps, parseRawOp, type EditOp, type RawOp } from '@/core/composition/ops'
import {
  compositionSchema,
  emptyElement,
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
import { getTemplate, isTemplate } from '@/core/templates'
import { ICONS } from '@/render/icons'

import {
  DIRECTION_SYSTEM,
  EDIT_SYSTEM,
  STORY_SYSTEM,
  describeComposition,
  directionSchema,
  editSchema,
  storySchema,
  templateGuide,
} from './prompts'

export interface Endpoint {
  baseUrl: string
  model: string
  signal?: AbortSignal
}

interface StoryDraft {
  title: string
  cast: { name: string; description: string }[]
  chapters: { title: string; tone: 'light' | 'dark' }[]
  scenes: { chapter: number; headline: string; step: string; caption: string; voiceover: string }[]
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
  templateId: string
  brand: BrandTokens
  format: FormatId
  fps: number
}

/** Scenes per direction call: keeps each answer well inside the model's output limit. */
const DIRECTION_BATCH = 6

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
function repairKind(direction: Direction): ElementKind {
  const { kind } = direction
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

/** Script → complete composition, in two passes: story, then visual direction per batch. */
export async function writeStory(
  endpoint: Endpoint,
  input: StoryInput,
  onProgress: (message: string) => void = () => {},
): Promise<Composition> {
  const template = getTemplate(input.templateId)
  const call = <T>(system: string, user: string, schema: Record<string, unknown>, name: string) =>
    chatJson<T>({
      baseUrl: endpoint.baseUrl,
      model: endpoint.model,
      signal: endpoint.signal,
      system,
      user,
      schema,
      schemaName: name,
      temperature: 0.5,
    })

  onProgress('Writing the story')
  const story = await call<StoryDraft>(
    STORY_SYSTEM,
    `${templateGuide(template)}
Brand: ${input.brand.name || 'unnamed'}. Video format: ${input.format}.

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
  ).map((chapter) => ({ id: newId('c'), title: chapter.title, tone: chapter.tone }))
  const castNames = story.cast.map((member) => member.name).join(', ') || 'none'

  const directions = new Map<number, Direction>()
  for (let start = 0; start < story.scenes.length; start += DIRECTION_BATCH) {
    const batch = story.scenes.slice(start, start + DIRECTION_BATCH)
    onProgress(`Directing scenes ${start + 1}–${start + batch.length} of ${story.scenes.length}`)
    const listing = batch
      .map((scene, offset) => {
        const chapter = chapters[scene.chapter] ?? chapters[0]!
        return `n=${start + offset + 1} [${chapter.title}${chapter.tone === 'dark' ? ', dark closing chapter' : ''}] headline: "${scene.headline}" caption: "${scene.caption}" narration: "${scene.voiceover}"`
      })
      .join('\n')
    const answer = await call<{ scenes: Direction[] }>(
      DIRECTION_SYSTEM,
      `${templateGuide(template)}
Cast: ${castNames}.
The video has ${story.scenes.length} scenes. Direct these:
${listing}`,
      directionSchema,
      'direction',
    )
    for (const direction of answer.scenes) directions.set(direction.n, direction)
  }

  const transition = template.transitions[0] ?? 'fade'
  const scenes: Scene[] = story.scenes.slice(0, 40).map((draft, index) => {
    const direction = directions.get(index + 1)
    const chapter = chapters[Math.min(Math.max(0, draft.chapter), chapters.length - 1)]!
    const scene: Scene = {
      id: newId('s'),
      chapterId: chapter.id,
      chrome: { headline: draft.headline, step: draft.step, caption: draft.caption },
      element: direction
        ? {
            ...emptyElement(repairKind(direction)),
            prompt: direction.prompt,
            cast: direction.cast.slice(0, 4),
            items: direction.items.slice(0, 8).map(cleanItem),
            center: cleanItem(direction.center),
            text: direction.text,
            subtext: direction.subtext,
          }
        : emptyElement(),
      beats: normalizeBeats(direction?.beats ?? [], direction?.items.length ?? 0).slice(0, 8),
      voiceover: draft.voiceover,
      duration: 3,
      transition: index === 0 ? 'cut' : transition,
    }
    return { ...scene, duration: estimateDuration(scene) }
  })

  const composition: Composition = {
    version: 2,
    title: story.title || 'Untitled',
    format: input.format,
    fps: input.fps,
    templateId: template.id,
    brand: input.brand,
    cast: {
      members: story.cast.slice(0, 6).filter((member) => member.name.trim()),
      seed: Math.floor(Math.random() * 100_000),
    },
    chapters,
    scenes,
  }
  const parsed = compositionSchema.safeParse(composition)
  if (!parsed.success) throw new Error('The story came back incomplete. Try again.')
  return parsed.data
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
  const applied = applyOps(composition, ops, isTemplate)
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

  const base = `${templateGuide(getTemplate(composition.templateId))}

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