import { getBlob, hashKey, putBlob } from '@/core/audio/cache'
import type { CastMember, Composition, SceneElement } from '@/core/composition/schema'
import { editImage, generateImage } from '@/core/llm/client'
import { styleLead, styleLine, type ArtStyle } from '@/core/styles'

import { getAsset } from './store'

const SIZE = '1024x1024'
const SOURCE_STYLE = 'Match the art style, line work and colouring of the reference images exactly.'

export interface PictureModels {
  /** Text-to-image model; "" means no pictures. */
  image: string
  /** Reference-editing model; "" means draw from text only. */
  reference: string
  /** References the reference model accepts per picture. */
  maxReferences: number
  /**
   * Model that redraws references in another art style (identity kept, style changed); "" or
   * missing = use `reference`. Reference models that copy the references' drawing style keep
   * identity best once the sheets are in the right style, so they draw the scenes.
   */
  restyle?: string
  /** References the restyle model accepts per picture. */
  restyleReferences?: number
}

/** The model and reference count for a picture that must change the references' style. */
const restyler = (models: PictureModels) =>
  models.restyle
    ? { model: models.restyle, max: models.restyleReferences ?? 1 }
    : { model: models.reference, max: models.maxReferences }

/** Everything needed to draw (and cache) one picture. */
export interface PictureJob {
  key: string
  model: string
  prompt: string
  seed: number
  /** Asset ids of the reference images, in prompt order. */
  references: string[]
}

const describe = (member: CastMember) => `${member.name.toUpperCase()}: ${member.description}`

function style(art: ArtStyle, members: CastMember[]) {
  return members.some((member) => member.look === 'source') ? SOURCE_STYLE : styleLine(art)
}

/** Opening words naming the style ("8-bit pixel art."), unless the references' look is kept. */
const lead = (art: ArtStyle, members: CastMember[]) =>
  members.some((member) => member.look === 'source') ? '' : styleLead(art)

/** A sheet drawn in another art style than the one asked for now. */
const otherStyle = (member: CastMember, art: ArtStyle) =>
  member.look !== 'source' && !!member.sheetStyle && member.sheetStyle !== art.id

const framing = (art: ArtStyle) =>
  art.background === 'full-bleed'
    ? 'A complete picture with its own setting, filling the frame edge to edge, no text, no border.'
    : 'Full body, centered, plain white background, no text.'

/** Cast members named in an element, in the element's order. */
export function membersIn(composition: Composition, element: SceneElement): CastMember[] {
  return element.cast
    .map((name) =>
      composition.cast.members.find((member) => member.name.toLowerCase() === name.toLowerCase()),
    )
    .filter((member): member is CastMember => !!member)
}

/** Same prompt + seed + model → same picture; `variant` asks for another take. */
export const illustrationSeed = (composition: Composition, element: SceneElement) =>
  composition.cast.seed + element.variant * 7919

/**
 * The picture for an illustration scene. With a reference model and approved sheets, the
 * characters come from their sheets (identity carried by pixels); otherwise from their
 * descriptions, which drift between pictures.
 */
export async function sceneJob(
  art: ArtStyle,
  composition: Composition,
  element: SceneElement,
  models: PictureModels,
): Promise<PictureJob | null> {
  const members = membersIn(composition, element)
  // A scene in another style than its people's sheets (a flashback) needs a model that restyles.
  const restyling =
    models.reference && members.some((member) => member.sheet && otherStyle(member, art))
  const refs = restyling ? restyler(models) : { model: models.reference, max: models.maxReferences }
  const drawn = refs.model ? members.filter((member) => member.sheet).slice(0, refs.max) : []
  const described = members.filter((member) => !drawn.includes(member))
  const model = drawn.length > 0 ? refs.model : models.image
  if (!model) return null

  const seed = illustrationSeed(composition, element)
  const lines: string[] = [lead(art, members)].filter(Boolean)
  if (drawn.length > 0) {
    lines.push(
      drawn
        .map((member, index) => `Reference image ${index + 1} shows ${member.name.toUpperCase()}.`)
        .join(' '),
      `Keep ${drawn.length > 1 ? 'everyone' : drawn[0]!.name.toUpperCase()} exactly as in the reference: same face, hair, skin tone, clothes, colours and proportions.`,
    )
    if (drawn.some((member) => otherStyle(member, art)))
      lines.push('Redraw them in the art style below; take only their identity from the reference.')
  }
  if (described.length > 0) lines.push(`Characters: ${described.map(describe).join(' ')}`)
  lines.push(style(art, members), `Scene: ${element.prompt.trim()}`)
  lines.push(framing(art))
  const prompt = lines.join(' ')
  const references = drawn.map((member) => member.sheet)
  return {
    key: await hashKey('image', model, String(seed), prompt, ...references),
    model,
    prompt,
    seed,
    references,
  }
}

/**
 * The approved look of a cast member: one neutral full-body figure (or the object alone) on white.
 * Drawn from the member's references when there are any, else from its current sheet when that
 * was drawn in another style (so identity carries over), else from the description.
 */
export async function sheetJob(
  art: ArtStyle,
  composition: Composition,
  member: CastMember,
  models: PictureModels,
  take: number,
): Promise<PictureJob | null> {
  const sources = member.refs.length
    ? member.refs
    : member.sheet && otherStyle(member, art)
      ? [member.sheet]
      : []
  // Drawn in the video's style (not the references' own look): a model that restyles, from one
  // reference (two references in the same old style pull the picture back to that style).
  const restyling = member.look !== 'source' && !!models.reference
  const refs = restyling
    ? { ...restyler(models), max: 1 }
    : { model: models.reference, max: models.maxReferences }
  const references = refs.model ? sources.slice(0, refs.max) : []
  const model = references.length > 0 ? refs.model : models.image
  if (!model) return null
  const subject =
    member.kind === 'object'
      ? `The object ${member.name.toUpperCase()} (${member.description}) alone, centred, front view, whole object visible.`
      : `One full-body figure of ${member.name.toUpperCase()} (${member.description}), front view, standing in a relaxed neutral pose, arms at the sides.`
  const who = member.kind === 'object' ? 'object' : 'person'
  const identity =
    member.kind === 'object'
      ? 'its shape, colours and markings'
      : 'their face, hair, skin tone, clothes and clothing colours'
  // Asking to keep everything "exactly" also keeps the reference's drawing style.
  const fromReference =
    references.length === 0
      ? ''
      : restyling
        ? `Redraw the ${who} called ${member.name.toUpperCase()} from the reference image in the art style below. Keep who it is: ${identity}. Change the drawing style completely: do not copy the reference's line work, shading or colouring. Ignore everything else in the reference.`
        : `Use the ${who} called ${member.name.toUpperCase()} in the reference image${references.length > 1 ? 's' : ''}; keep ${identity} exactly. Ignore everything else in the reference.`
  const prompt = [
    lead(art, [member]),
    fromReference,
    subject,
    style(art, [member]),
    'Plain white background, no text, nothing else in the picture.',
  ]
    .filter(Boolean)
    .join(' ')
  const seed = composition.cast.seed + 101 * (take + 1)
  return {
    key: await hashKey('sheet', model, String(seed), prompt, ...references),
    model,
    prompt,
    seed,
    references,
  }
}

/** A sheet changed to look more like `reference`, keeping everything not listed in `changes`. */
export async function restyleJob(
  member: CastMember,
  reference: string,
  changes: string[],
  models: PictureModels,
  take: number,
): Promise<PictureJob | null> {
  if (!models.reference || !member.sheet) return null
  const prompt = `Reference image 1 is ${member.name.toUpperCase()}. Reference image 2 is a style and look reference. Redraw ${member.name.toUpperCase()} from image 1 with these changes taken from image 2: ${changes.join('; ')}. Keep everything else from image 1 exactly (identity, pose, framing). Plain white background, no text.`
  const references = [member.sheet, reference]
  const seed = 4242 + take
  return {
    key: await hashKey('restyle', models.reference, String(seed), prompt, ...references),
    model: models.reference,
    prompt,
    seed,
    references,
  }
}

export const cachedPicture = (key: string) => getBlob(key)

/** Draw a job (or return it from the cache). */
export async function drawPicture(
  baseUrl: string,
  job: PictureJob,
  options: { signal?: AbortSignal; priority?: 'foreground' | 'background'; timeout?: number } = {},
): Promise<Blob> {
  const cached = await getBlob(job.key)
  if (cached) return cached
  const settings = {
    size: SIZE,
    seed: job.seed,
    signal: options.signal,
    priority: options.priority,
    timeout: options.timeout,
  }
  let blob: Blob
  if (job.references.length > 0) {
    const references = await Promise.all(job.references.map((id) => getAsset(id)))
    if (references.some((blob) => !blob)) throw new Error('A reference image is missing.')
    blob = await editImage(baseUrl, job.model, job.prompt, references as Blob[], settings)
  } else blob = await generateImage(baseUrl, job.model, job.prompt, settings)
  await putBlob(job.key, blob)
  return blob
}