import { describe, expect, it } from 'vite-plus/test'

import { guide } from '@/core/agent/prompts'
import { compositionSchema, type BrandTokens } from '@/core/composition/schema'
import { KINDS } from '@/core/kinds'
import { profile } from '@/core/models/catalog'
import { sampleComposition } from '@/core/samples'
import { STYLES, STYLE_FAMILIES, getStyle, isStyle, sceneStyle, styleLead } from '@/core/styles'
import { TEMPLATES, isTemplate } from '@/core/templates'
import { ICONS } from '@/render/icons'

const brand: BrandTokens = {
  name: 'Acme',
  logo: '',
  primary: '#1f4d3a',
  accent: '#e0784f',
  background: '#f7f7f7',
  text: '#1f2328',
  fontDisplay: 'Lora',
  fontBody: 'Exo 2',
}

describe('kinds, looks and art styles', () => {
  it('every kind points at a real look and style, and its sample is a valid video in every look', () => {
    const problems: string[] = []
    for (const kind of KINDS) {
      if (!isTemplate(kind.look)) problems.push(`${kind.id}: look ${kind.look}`)
      if (!isStyle(kind.style)) problems.push(`${kind.id}: style ${kind.style}`)
      if (kind.lengths.length === 0) problems.push(`${kind.id}: no lengths`)
      for (const look of TEMPLATES) {
        const sample = sampleComposition(kind.id, look.id, brand)
        if (!compositionSchema.safeParse(sample).success) problems.push(`${kind.id} × ${look.id}`)
        const icons = sample.scenes.flatMap((scene) =>
          [...scene.element.items, scene.element.center].map((item) => item.icon),
        )
        for (const icon of icons)
          if (icon && !ICONS[icon]) problems.push(`${kind.id}: icon ${icon}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('every look has a real default style; styles are unique and prefer known models', () => {
    const problems: string[] = []
    for (const look of TEMPLATES)
      if (!isStyle(look.style)) problems.push(`${look.id}: ${look.style}`)
    const families = new Set<string>(STYLE_FAMILIES.map((family) => family.id))
    for (const style of STYLES) {
      if (!families.has(style.family)) problems.push(`${style.id}: family`)
      for (const model of style.best) if (!profile(model)) problems.push(`${style.id}: ${model}`)
    }
    expect(problems).toEqual([])
    expect(new Set(STYLES.map((style) => style.id)).size).toBe(STYLES.length)
    expect(STYLES.length).toBeGreaterThanOrEqual(40)
  })

  it('resolves a scene style from the scene, then the chapter, then the video, then the look', () => {
    const video = sampleComposition('explainer', 'soft-explainer', brand)
    const scene = video.scenes[0]!
    expect(sceneStyle(video, scene).id).toBe('storybook')
    video.styleId = 'watercolour'
    expect(sceneStyle(video, scene).id).toBe('watercolour')
    video.chapters[0]!.styleId = 'anime'
    expect(sceneStyle(video, scene).id).toBe('anime')
    expect(sceneStyle(video).id).toBe('watercolour')
    expect(sceneStyle(video, { ...scene, styleId: 'pixel-8' }).id).toBe('pixel-8')
    // An unknown id falls through to the next level.
    expect(sceneStyle(video, { ...scene, styleId: 'gone' }).id).toBe('anime')
  })

  it('names the style in the opening words of a prompt', () => {
    expect(styleLead(getStyle('pixel-8'))).toBe('8-bit pixel art.')
    expect(styleLead(getStyle('watercolour'))).toBe('Loose watercolour illustration.')
  })

  it('tells the writer the kind, pacing and target length', () => {
    const text = guide('social-ad', 'bold-editorial', { length: 15, cta: 'Order now' })
    expect(text).toMatch(/Social ad/)
    expect(text).toMatch(/1\.5-4 seconds/)
    expect(text).toMatch(/about 15 seconds .* about 36 words/)
    expect(text).toMatch(/call to action: Order now/)
  })
})