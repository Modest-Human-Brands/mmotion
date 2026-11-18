import type { FormatId } from '@/core/composition/schema'
import { chatJson } from '@/core/llm/client'
import { languageName } from '@/core/models/catalog'
import { KINDS } from '@/core/kinds'
import { TEMPLATES } from '@/core/templates'

import type { Endpoint } from './index'

export interface DetectedMember {
  name: string
  kind: 'character' | 'object'
  description: string
  /** Show the real thing (logo, product, UI) instead of drawing it. */
  exact: boolean
  /** Frame numbers where it is seen most clearly (best first). */
  frames: number[]
}

export interface VideoAnalysis {
  title: string
  purpose: string
  kindId: string
  templateId: string
  format: FormatId
  brand: string
  /** Outline the story agent reads (chapters, scenes, visual hints, narration). */
  script: string
  cast: DetectedMember[]
}

const ANALYSIS_SYSTEM = `You are a story editor preparing a script for an animated motion video tool. You are given numbered frames from a source video (contact sheets, each frame labelled "#n m:ss") and, when it has speech, its transcript with time marks.
Work out what the video communicates and how: purpose and audience, the hook, each section (problem, explanation, steps, reassurance, call to action, brand close), every distinct point, and the recurring characters and objects.

script: the story as an outline in exactly this format, nothing else:
CHAPTER 1: <title> (light)
SCENE 1 · <HEADLINE, 2-4 words>
VISUAL: <ILLUSTRATION | DIAGRAM | CHIPS | SLIDERS | CHECKLIST | BUBBLE | COMPARE | BIG WORD | STAT | QUOTE | STATEMENT | LOGO>: <pose and action using cast names, or the labels of the parts>
NARRATION: <what is spoken>
(blank line between scenes; number scenes continuously; 3-6 chapters; "(dark)" only for the closing brand chapter; numbered steps keep their numbers, one scene each; lists of 3-6 parallel things stay in one scene as a DIAGRAM or CHIPS; use at least four different visual kinds.)

cast: every character (person, animal, mascot) and every object that appears in more than one frame or matters to the story (toy, product, logo). name: a plain role name used in the script ("Mother", "Son", "Teddy", "Logo"). description: what they look like precisely (age, hair, skin, clothing with colours; or shape, colours, markings). exact = true only for things that must stay pixel-identical (brand logo, a real product, an app screen). frames: up to 2 frame numbers where it is seen most clearly, large and unobstructed, best first.
kindId: the kind of video it is: ${KINDS.map((kind) => `${kind.id} (${kind.blurb})`).join('; ')}.
templateId: the closest look: ${TEMPLATES.map((template) => `${template.id} (${template.description})`).join('; ')}.
format: portrait for vertical video, landscape for horizontal, square for square.
brand: the brand or organisation name if shown or said, else "".`

const analysisSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'purpose', 'kindId', 'templateId', 'format', 'brand', 'script', 'cast'],
  properties: {
    title: { type: 'string' },
    purpose: { type: 'string' },
    kindId: { type: 'string', enum: KINDS.map((kind) => kind.id) },
    templateId: { type: 'string', enum: TEMPLATES.map((template) => template.id) },
    format: { type: 'string', enum: ['portrait', 'landscape', 'square'] },
    brand: { type: 'string' },
    script: { type: 'string' },
    cast: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'kind', 'description', 'exact', 'frames'],
        properties: {
          name: { type: 'string' },
          kind: { type: 'string', enum: ['character', 'object'] },
          description: { type: 'string' },
          exact: { type: 'boolean' },
          frames: { type: 'array', items: { type: 'integer' } },
        },
      },
    },
  },
}

export async function analyzeVideo(
  endpoint: Endpoint,
  input: {
    sheets: string[]
    frameCount: number
    duration: number
    transcript: string
    /** Keep the spoken words as the narration instead of rewriting them. */
    keepWording: boolean
    /** Language the transcript is in ("" when unknown). */
    spokenLanguage?: string
    /** Language the outline should be written in. */
    language?: string
  },
): Promise<VideoAnalysis> {
  const target = input.language ?? 'en'
  const translating = !!input.spokenLanguage && input.spokenLanguage !== target
  const narration = input.transcript.trim()
    ? translating
      ? `Translate the narration faithfully into ${languageName(target)} (native script), keeping its order, meaning and tone; every sentence exactly once.`
      : input.keepWording
        ? 'Use the transcript as the narration, word for word, split across scenes in order; every sentence exactly once.'
        : 'Rewrite the narration in your own words for spoken delivery; keep facts, numbers and names accurate and do not add claims.'
    : `The video has no speech: write narration in ${languageName(target)} from what the frames show.`
  const outlineLanguage = `Write HEADLINE and NARRATION in ${languageName(target)}; keep the CHAPTER/SCENE/VISUAL/NARRATION keywords, VISUAL lines and cast names in English.`
  const answer = await chatJson<VideoAnalysis>({
    baseUrl: endpoint.baseUrl,
    model: endpoint.model,
    signal: endpoint.signal,
    system: ANALYSIS_SYSTEM,
    user: `The video is ${Math.round(input.duration)} s long; ${input.frameCount} frames are shown in ${input.sheets.length} contact sheet(s). ${narration} ${outlineLanguage}

Transcript:
${input.transcript.trim() || '(none)'}`,
    images: input.sheets,
    schema: analysisSchema,
    schemaName: 'video_analysis',
    temperature: 0.3,
    maxTokens: 4096,
  })
  return {
    ...answer,
    cast: answer.cast
      .filter((member) => member.name.trim())
      .slice(0, 8)
      .map((member) => ({
        ...member,
        frames: member.frames.filter((n) => n >= 1 && n <= input.frameCount).slice(0, 2),
      })),
  }
}

const locateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['found', 'box_2d'],
  properties: {
    found: { type: 'boolean' },
    box_2d: { type: 'array', items: { type: 'integer' } },
  },
}

/** Where `member` is in `frame`, as `[y0, x0, y1, x1]` on a 0–1000 scale; null if absent. */
export async function locate(
  endpoint: Endpoint,
  frame: string,
  member: Pick<DetectedMember, 'name' | 'kind' | 'description'>,
): Promise<number[] | null> {
  const answer = await chatJson<{ found: boolean; box_2d: number[] }>({
    baseUrl: endpoint.baseUrl,
    model: endpoint.model,
    signal: endpoint.signal,
    system:
      'You find one subject in an image and return its bounding box as box_2d = [y_min, x_min, y_max, x_max] on a 0-1000 scale. The box covers the whole subject (for a person: head to feet as far as visible). found = false if it is not in the image.',
    user: `Find ${member.kind === 'object' ? 'the object' : 'the person'} "${member.name}": ${member.description}`,
    images: [frame],
    schema: locateSchema,
    schemaName: 'locate',
    temperature: 0,
    maxTokens: 200,
  })
  return answer.found && answer.box_2d.length === 4 ? answer.box_2d : null
}

export interface Difference {
  aspect: string
  current: string
  reference: string
}

/** How a reference differs from the current sheet, as choices the user can tick. */
export async function compareToReference(
  endpoint: Endpoint,
  sheet: string,
  reference: string,
  name: string,
): Promise<Difference[]> {
  const answer = await chatJson<{ differences: Difference[] }>({
    baseUrl: endpoint.baseUrl,
    model: endpoint.model,
    signal: endpoint.signal,
    system:
      'You compare two images of a character or object for an illustrator. Image 1 is the current design, image 2 is a reference the user likes. List the visible differences that could be carried over, one per aspect (art style, colour palette, hair, face, outfit top, outfit bottom, shoes, accessories, body proportions, shape, markings). Each: aspect, current = how it is in image 1, reference = how it is in image 2, a few words each. Skip aspects that are the same. At most 8.',
    user: `The subject is "${name}".`,
    images: [sheet, reference],
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['differences'],
      properties: {
        differences: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['aspect', 'current', 'reference'],
            properties: {
              aspect: { type: 'string' },
              current: { type: 'string' },
              reference: { type: 'string' },
            },
          },
        },
      },
    },
    schemaName: 'differences',
    temperature: 0.2,
    maxTokens: 800,
  })
  return answer.differences.slice(0, 8)
}