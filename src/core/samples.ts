import familyArt from '@/assets/samples/family.jpg'
import type { StageMedia } from '@/render/media'

import {
  emptyElement,
  emptyItem,
  type BrandTokens,
  type Composition,
  type FormatId,
  type Scene,
} from './composition/schema'
import { getTemplate } from './templates'

const scene = (partial: Partial<Scene> & Pick<Scene, 'id' | 'chapterId'>): Scene => ({
  chrome: { headline: '', step: '', caption: '' },
  element: emptyElement(),
  beats: [],
  voiceover: '',
  duration: 3.5,
  transition: 'fade',
  ...partial,
})

/** A short story used to preview templates and brand tokens before a script exists. */
export function sampleComposition(
  templateId: string,
  brand: BrandTokens,
  format: FormatId = getTemplate(templateId).format,
): Composition {
  return {
    version: 2,
    title: 'Preview',
    format,
    fps: 30,
    templateId,
    brand,
    cast: { members: [], seed: 7 },
    chapters: [
      { id: 'everyday', title: 'Everyday moments', tone: 'light' },
      { id: 'why', title: 'Why it happens', tone: 'light' },
      { id: 'steps', title: 'Small steps help', tone: 'light' },
      { id: 'brand', title: brand.name || 'Your brand', tone: 'dark' },
    ],
    scenes: [
      scene({
        id: 'p1',
        chapterId: 'everyday',
        chrome: {
          headline: 'A calm moment, together.',
          step: '',
          caption: 'Stories your audience recognises.',
        },
        element: {
          ...emptyElement('illustration'),
          prompt: 'Mother offers her son a glass of water',
        },
        transition: 'cut',
      }),
      scene({
        id: 'p2',
        chapterId: 'why',
        chrome: {
          headline: 'Our senses take the world in.',
          step: '',
          caption: 'Diagrams react to the narration.',
        },
        element: {
          ...emptyElement('radialDiagram'),
          center: { label: 'Brain', icon: 'brain', detail: '' },
          items: [
            { label: 'Sound', icon: 'ear', detail: '' },
            { label: 'Sight', icon: 'eye', detail: '' },
            { label: 'Smell', icon: 'flower', detail: '' },
            { label: 'Taste', icon: 'utensils', detail: '' },
            { label: 'Touch', icon: 'hand', detail: '' },
          ],
        },
        beats: [
          { at: '', action: 'highlight', target: 0, text: '' },
          { at: '', action: 'highlight', target: 1, text: '' },
          { at: '', action: 'highlight', target: 2, text: '' },
        ],
        duration: 4,
      }),
      scene({
        id: 'p3',
        chapterId: 'why',
        chrome: {
          headline: 'Several volume controls…',
          step: '',
          caption: 'Turned up. All at once.',
        },
        element: {
          ...emptyElement('sliders'),
          items: ['Sound', 'Sight', 'Smell', 'Taste', 'Touch'].map((label, index) => ({
            ...emptyItem(),
            label,
            icon: ['ear', 'eye', 'flower', 'utensils', 'hand'][index]!,
          })),
        },
      }),
      scene({
        id: 'p4',
        chapterId: 'steps',
        chrome: { headline: 'Keep it simple.', step: '01/03', caption: 'Speak gently.' },
        element: {
          ...emptyElement('speechBubble'),
          text: 'Take your time.',
        },
        beats: [{ at: '', action: 'caption', target: 0, text: 'Allow time to respond.' }],
      }),
      scene({
        id: 'p5',
        chapterId: 'brand',
        chrome: { headline: '', step: '', caption: '' },
        element: { ...emptyElement('logoReveal'), text: 'Heal. Understand. Grow.' },
      }),
    ],
  }
}

/** Preview media: the bundled sample picture stands in for every illustration. */
export const sampleMedia: StageMedia = {
  image: () => ({ url: familyArt, status: 'done' }),
  words: () => undefined,
}