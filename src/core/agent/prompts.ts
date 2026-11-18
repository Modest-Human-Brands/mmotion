import {
  BEAT_ACTIONS,
  ELEMENT_KINDS,
  TRANSITIONS,
  type Composition,
} from '@/core/composition/schema'
import { TEMPLATES, type Template } from '@/core/templates'
import { ICON_NAMES } from '@/render/icons'

export function templateGuide(template: Template): string {
  return `Template "${template.name}": ${template.description}
Story arc for this template: ${template.arc}
Preferred visual elements: ${template.elements.join(', ')}.`
}

// ------------------------------------------------------------------ pass 1: story

export const STORY_SYSTEM = `You are a scriptwriter and story editor for short animated explainer videos.
Turn the user's script into a story: chapters, recurring characters and scenes with narration.
Rules:
- Follow the template's story arc, but never invent facts, statistics, names or quotes that are not in the script.
- If the script is narration (a voiceover), keep its wording: split it across scenes in order, one to three sentences per scene, covering every sentence exactly once. If it is an outline, write natural narration from it.
- One idea per scene; a scene's narration lasts about 4 to 9 seconds.
- headline: the on-screen title of the scene, max 7 words.
- caption: words the viewer reads under the picture, in the audience's voice, max 8 words, e.g. "Tears. Covered ears. Overwhelm." or "Speak gently.". Never describe the picture, layout or graphic ("Diagram of…", "Mother looks…", "Text overlay"). "" if the headline says enough.
- step: for numbered practical steps write "01/05", "02/05" …, otherwise "".
- chapters: 3 to 7 sections with a short label (max 4 words) like "Everyday parenting" or "Small steps can help". tone "dark" only for the closing brand chapter.
- chapter: the 0-based index of the scene's chapter; scenes stay in chapter order.
- cast: if the story has people, define each recurring character once with a precise visual description (age, hair, skin, clothing colours, shoes) that an illustrator can repeat exactly. Use plain names like "Mother", "Son". Empty list if there are no people.`

export const storySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'cast', 'chapters', 'scenes'],
  properties: {
    title: { type: 'string' },
    cast: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'description'],
        properties: { name: { type: 'string' }, description: { type: 'string' } },
      },
    },
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'tone'],
        properties: {
          title: { type: 'string' },
          tone: { type: 'string', enum: ['light', 'dark'] },
        },
      },
    },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['chapter', 'headline', 'step', 'caption', 'voiceover'],
        properties: {
          chapter: { type: 'integer' },
          headline: { type: 'string' },
          step: { type: 'string' },
          caption: { type: 'string' },
          voiceover: { type: 'string' },
        },
      },
    },
  },
}

// --------------------------------------------------------------- pass 2: direction

export const ELEMENT_GUIDE = `Visual elements (one per scene) and the fields each uses (leave the others empty):
- illustration: a picture of the cast. prompt = what happens, using cast names, pose and setting, one sentence, no text in the image ("Mother kneels beside Son who covers his ears at a noisy birthday party"). cast = names in the picture.
- radialDiagram: a hub with 3-6 nodes around it. center = {label, icon}; items = nodes {label, icon}.
- chips: 3-6 floating tags around a short centre sentence. text = the sentence; items = tags {label}.
- sliders: 3-6 labelled level sliders that rise. items = {label, icon}.
- checklist: 2-5 rows with ticks. items = {label, detail}.
- speechBubble: a speech bubble that types out. text = what is said (max 10 words).
- splitCards: 2-3 cards. items = {label, icon, detail}.
- bigWord: one or two huge words. text = the words; subtext = a short line.
- stat: a big number that counts up. text = the number with unit ("40%"); subtext = what it measures.
- quote: text = the quote; subtext = who said it.
- logoReveal: the brand logo for the final scene. text = the brand promise or tagline (max 5 words).
- none: the headline alone as a large statement.
Labels are real words from the story ("Sound", "Tired?", "Quieter space"), never placeholders like "Item 1" or "Volume 2".
Icons: only these names, or "": ${ICON_NAMES.join(', ')}.
Beats make the visual react to the narration. at = a short exact phrase (2-4 words) copied from the scene's narration; the beat fires when it is spoken. target counts from 0: the first item is 0, the second is 1.
- highlight target=i: light up node i of a radialDiagram (one beat per node as each is named).
- reveal target=i: show item i (chips, checklist, splitCards) when it is mentioned.
- check target=i: tick checklist row i.
- raise target=i: raise slider i; target = number of sliders raises them all together.
- caption text=…: swap the caption card text (for narration with two or three parts).
Use 0-5 beats per scene. Illustrated scenes usually only need caption beats.`

export const DIRECTION_SYSTEM = `You are the art director of an animated explainer video. For each scene you receive (headline, caption, narration), choose ONE visual element from the library, fill its fields, and add beats that sync it to the narration.
Prefer illustrations of the cast for human moments, and diagrams for explanations, lists and processes. Avoid the same element in more than two scenes in a row. The last scene of a dark brand chapter uses logoReveal.
Every field must be present; use "" or [] for unused ones and {"label":"","icon":"","detail":""} for an unused center. n is the scene number you were given.
${ELEMENT_GUIDE}`

const itemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'icon', 'detail'],
  properties: {
    label: { type: 'string' },
    icon: { type: 'string' },
    detail: { type: 'string' },
  },
}

export const directionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['scenes'],
  properties: {
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['n', 'kind', 'prompt', 'cast', 'items', 'center', 'text', 'subtext', 'beats'],
        properties: {
          n: { type: 'integer' },
          kind: { type: 'string', enum: [...ELEMENT_KINDS] },
          prompt: { type: 'string' },
          cast: { type: 'array', items: { type: 'string' } },
          items: { type: 'array', items: itemSchema },
          center: itemSchema,
          text: { type: 'string' },
          subtext: { type: 'string' },
          beats: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['at', 'action', 'target', 'text'],
              properties: {
                at: { type: 'string' },
                action: { type: 'string', enum: [...BEAT_ACTIONS] },
                target: { type: 'integer' },
                text: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
}

// --------------------------------------------------------------------- edits

export const EDIT_SYSTEM = `You are the editor of an existing animated explainer video. The user asks for a change; you return the smallest set of operations that makes it. Do not touch scenes the user did not mention.
Each operation is {op, sceneId, afterSceneId, data}. "data" is a JSON object encoded as a string ("" when the op needs none). Unused id fields are "".
Operations:
- updateScene: sceneId + data with only what changes, e.g. "{\\"chrome\\":{\\"headline\\":\\"New title\\"}}". Fields: chrome {headline, step, caption}; element {kind, prompt, cast, items, center, text, subtext} (items replaces the whole list); beats (replaces the whole list); voiceover; duration (seconds); transition (${TRANSITIONS.join(', ')}); chapterId.
- addScene: afterSceneId ("" = at the start) + data with chapterId, chrome, element, beats, voiceover.
- removeScene: sceneId. moveScene: sceneId + afterSceneId.
- regenerateIllustration: sceneId. A new take of that scene's picture with the same description.
- updateChapter: sceneId = the chapter id, data with title and/or tone (light, dark).
- addChapter: afterSceneId = chapter id to insert after ("" = first), data {"id":"…","title":"…","tone":"light"}.
- updateCast: data {"members":[{"name":"Mother","description":"…"}]}. Changing a description redraws every picture of that character.
- setBrand: data with any of name, primary, accent, background, text (hex like "#1a2b3c"), fontDisplay, fontBody (Google Font names).
- setTemplate: data {"templateId": one of ${TEMPLATES.map((template) => template.id).join(', ')}}.
- setMeta: data with title and/or format (portrait, landscape, square).
To change what a picture shows, update element.prompt (and cast); it is redrawn automatically.
When narration changes, keep beats' "at" phrases present in the new narration.
reply: one short sentence telling the user what you changed (or why you could not).
${ELEMENT_GUIDE}`

export const editSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'ops'],
  properties: {
    reply: { type: 'string' },
    ops: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['op', 'sceneId', 'afterSceneId', 'data'],
        properties: {
          op: {
            type: 'string',
            enum: [
              'updateScene',
              'addScene',
              'removeScene',
              'moveScene',
              'regenerateIllustration',
              'updateChapter',
              'addChapter',
              'updateCast',
              'setBrand',
              'setTemplate',
              'setMeta',
            ],
          },
          sceneId: { type: 'string' },
          afterSceneId: { type: 'string' },
          data: { type: 'string' },
        },
      },
    },
  },
}

const compact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.length ? value.map(compact) : undefined
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, child]) => [key, compact(child)] as const)
      .filter(([, child]) => child !== undefined && child !== '')
    return entries.length ? Object.fromEntries(entries) : undefined
  }
  return value === '' ? undefined : value
}

/** The document as the edit model sees it: ids first, empty fields dropped, logo omitted. */
export function describeComposition(composition: Composition): string {
  const { logo: _logo, ...brand } = composition.brand
  return JSON.stringify(
    compact({
      title: composition.title,
      format: composition.format,
      templateId: composition.templateId,
      brand,
      cast: composition.cast.members,
      chapters: composition.chapters,
      scenes: composition.scenes.map((scene, index) => ({
        n: index + 1,
        id: scene.id,
        chapterId: scene.chapterId,
        chrome: scene.chrome,
        element: { ...scene.element, variant: undefined },
        beats: scene.beats,
        voiceover: scene.voiceover,
        duration: scene.duration,
        transition: scene.transition,
      })),
    }),
  )
}