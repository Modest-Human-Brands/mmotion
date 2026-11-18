import type { StageMedia } from '@/render/media'

import {
  DEFAULT_VOICE,
  emptyElement,
  emptyItem,
  type BrandTokens,
  type Composition,
  type FormatId,
  type Scene,
} from './composition/schema'
import { getKind } from './kinds'
import type { ArtStyle } from './styles'
import { getTemplate } from './templates'

const scene = (partial: Partial<Scene> & Pick<Scene, 'id' | 'chapterId'>): Scene => ({
  chrome: { headline: '', step: '', caption: '' },
  brief: '',
  element: emptyElement(),
  beats: [],
  voiceover: '',
  voiceTake: 0,
  duration: 3.5,
  transition: 'fade',
  styleId: '',
  ...partial,
})

/**
 * A kind's sample story in a look, used to preview kinds, looks and brand tokens before a script
 * exists. The content is neutral (no real brand or person).
 */
export function sampleComposition(
  kindId: string,
  lookId: string,
  brand: BrandTokens,
  format: FormatId = getKind(kindId).format,
  styleId = '',
): Composition {
  const kind = getKind(kindId)
  const look = getTemplate(lookId)
  const chapters = kind.sample.chapters.map((chapter, index) => ({
    id: `c${index}`,
    title: chapter.tone === 'dark' ? brand.name || chapter.title : chapter.title,
    tone: chapter.tone,
    styleId: '',
  }))
  return {
    version: 2,
    title: kind.sample.title,
    format,
    fps: 30,
    templateId: look.id,
    kindId: kind.id,
    styleId,
    brand,
    cast: { members: [], seed: 7 },
    voice: DEFAULT_VOICE,
    language: 'en',
    commercial: false,
    chapters,
    scenes: kind.sample.scenes.map((sample, index) =>
      scene({
        id: `p${index}`,
        chapterId: chapters[Math.min(sample.chapter, chapters.length - 1)]!.id,
        chrome: {
          headline: sample.headline,
          step: sample.step ?? '',
          caption: sample.caption ?? '',
        },
        element: {
          ...emptyElement(sample.element.kind),
          ...sample.element,
          items: (sample.element.items ?? []).map((item) => ({ ...emptyItem(), ...item })),
        },
        beats: sample.beats ?? [],
        duration: sample.duration ?? 3.5,
        transition: index === 0 ? 'cut' : (look.transitions[0] ?? 'fade'),
      }),
    ),
  }
}

/**
 * A neutral stand-in picture in a style's colours (a figure beside a plant), used until the
 * style has a generated thumbnail.
 */
export function placeholderArt(art: ArtStyle): string {
  const [a, b] = art.swatch
  const ground =
    art.background === 'full-bleed'
      ? `<rect width="400" height="400" rx="24" fill="${b}" opacity="0.35"/>`
      : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">${ground}<ellipse cx="200" cy="350" rx="140" ry="16" fill="#0002"/><rect x="150" y="170" width="100" height="170" rx="46" fill="${a}"/><circle cx="200" cy="128" r="40" fill="${a}" opacity="0.85"/><rect x="270" y="270" width="56" height="70" rx="10" fill="${b}"/><path d="M298 270c-30-40-10-80 0-96c10 16 30 56 0 96z" fill="${b}" opacity="0.8"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Preview media: every illustration shows the style's thumbnail (or its placeholder). */
export function sampleMedia(art: ArtStyle, thumbnail?: string): StageMedia {
  const url = thumbnail ?? placeholderArt(art)
  const framed = art.background === 'full-bleed'
  return { image: () => ({ url, status: 'done', framed }), words: () => undefined }
}