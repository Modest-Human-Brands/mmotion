import { describe, expect, it } from 'vite-plus/test'

import { emptyOrganization } from '@/domain/organization'
import { parseSchemaToJsonSchema } from '@/domain/schemaConverter'

import { authoredFrame, buildSettings, outputFrame } from '../motion'
import { getAllTemplates, getTemplate } from '../registry'

describe('template registry', () => {
  it('auto-discovers every template folder', () => {
    expect(
      getAllTemplates()
        .map((t) => t.id)
        .sort(),
    ).toEqual(['iphone-fanout-v1', 'iphone-helix-v1', 'macbook-podium-v1', 'macbook-reveal-v1'])
    expect(getTemplate('missing')).toBeUndefined()
  })

  it.each(getAllTemplates().map((t) => [t.id, t] as const))(
    '%s has valid placeholders, a form schema, a scene and a poster',
    (_id, template) => {
      expect(template.schema.safeParse(template.placeholders).success).toBe(true)
      const json = parseSchemaToJsonSchema(template.schema, template.placeholders)
      expect(json.type).toBe('object')
      expect(Object.keys(json.properties ?? {}).length).toBeGreaterThan(0)
      expect(template.scene).toBeTruthy()
      expect(template.thumbnail).toBeTruthy()
      expect(template.resolution.fps).toBeGreaterThan(0)
      expect(template.resolution.durationFrames).toBeGreaterThan(0)
    },
  )

  it.each(getAllTemplates().map((t) => [t.id, t] as const))(
    '%s keeps its authored timing with the placeholder values',
    (_id, template) => {
      const settings = buildSettings(template, template.placeholders, emptyOrganization())
      expect(settings.fps).toBe(template.resolution.fps)
      expect(settings.durationFrames).toBe(template.resolution.durationFrames)
      expect(settings.background).toMatchObject({ type: 'shader', preset: 'studio' })
      expect(settings.screenMedia).toBe(template.defaults.screenMedia)
      expect(authoredFrame(120, settings)).toBe(120)
    },
  )
})

describe('scene settings', () => {
  const template = getTemplate('macbook-reveal-v1')!

  it('maps output frames to authored frames for fps and speed', () => {
    const values = structuredClone(template.placeholders)
    values.motion.fps = '30'
    values.motion.speed = 2
    values.motion.durationSec = 3
    const settings = buildSettings(template, values, emptyOrganization())

    expect(settings.fps).toBe(30)
    expect(settings.durationFrames).toBe(90)
    // At 30 fps and 2x speed, output frame 45 (1.5 s) is authored frame 180 (3 s at 60 fps).
    expect(authoredFrame(45, settings)).toBe(180)
    expect(outputFrame(180, settings)).toBe(45)
  })

  it('uses brand colours for the background unless overridden', () => {
    const org = { ...emptyOrganization(), primary: '#112233', accent: '#aabbcc' }
    expect(buildSettings(template, template.placeholders, org).background.colorA).toBe('#112233')
    const values = structuredClone(template.placeholders)
    values.background.colorA = '#FF0000'
    values.background.style = 'solid'
    expect(buildSettings(template, values, org).background).toMatchObject({
      type: 'solid',
      colorA: '#ff0000',
    })
  })

  it('falls back to the template media and body colour when fields are empty', () => {
    const values = structuredClone(template.placeholders)
    values.device.screenMedia = ''
    const settings = buildSettings(template, values, emptyOrganization())
    expect(settings.screenMedia).toBe('/textures/01-Dashboard.jpg')
    expect(settings.chassisColor).toBe('#535150')
  })
})