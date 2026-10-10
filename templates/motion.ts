import { z } from 'zod'

import type { BackgroundConfig } from '@/domain/animation/types'
import type { OrganizationProfile } from '@/domain/organization'
import { normalizeHex, onColor } from '@/domain/proceduralGradient'

import TitleOverlay from './TitleOverlay.vue'
import {
  BACKGROUND_STYLES,
  type MotionTemplateDefinition,
  type TemplateOverlay,
  type TemplateValues,
} from './types'

export const FPS_OPTIONS = ['24', '30', '60'] as const

const optionalColor = () => z.string().optional().meta({ 'x-widget': 'color' })

export function motionSchema() {
  return z.object({
    device: z.object({
      screenMedia: z.string().optional().meta({ 'x-widget': 'media', title: 'Screen media' }),
      chassisColor: optionalColor().meta({ title: 'Body colour' }),
    }),
    background: z.object({
      style: z.enum(BACKGROUND_STYLES),
      colorA: optionalColor().meta({ title: 'Colour A (brand primary)' }),
      colorB: optionalColor().meta({ title: 'Colour B (brand accent)' }),
    }),
    motion: z.object({
      fps: z.enum(FPS_OPTIONS).meta({ title: 'Frame rate' }),
      durationSec: z.number().min(2).max(30).meta({ title: 'Duration (s)' }),
      speed: z.number().min(0.25).max(4).meta({ title: 'Speed' }),
      cameraFov: z.number().min(15).max(80).meta({ title: 'Camera FOV' }),
      cameraDistance: z.number().min(0.5).max(2).meta({ title: 'Camera distance' }),
    }),
    title: z.object({
      headline: z.string().optional(),
      subtitle: z.string().optional(),
    }),
  })
}

type TemplateInput = Omit<MotionTemplateDefinition, 'schema' | 'placeholders' | 'overlay'> & {
  overlay?: TemplateOverlay | false
}

export function defineMotionTemplate(input: TemplateInput): MotionTemplateDefinition {
  const { resolution, defaults } = input
  return {
    ...input,
    schema: motionSchema(),
    placeholders: {
      device: { screenMedia: defaults.screenMedia, chassisColor: '' },
      background: { style: defaults.background, colorA: '', colorB: '' },
      motion: {
        fps: String(resolution.fps),
        durationSec: Math.round((resolution.durationFrames / resolution.fps) * 100) / 100,
        speed: 1,
        cameraFov: defaults.cameraFov,
        cameraDistance: 1,
      },
      title: { headline: '', subtitle: '' },
    },
    overlay: input.overlay === false ? undefined : (input.overlay ?? titleOverlay),
  }
}

export interface SceneSettings {
  width: number
  height: number
  fps: number
  durationFrames: number
  /** Authored frame rate of the scene's keyframes. */
  baseFps: number
  speed: number
  screenMedia: string
  chassisColor?: string
  cameraFov: number
  cameraDistance: number
  background: BackgroundConfig
}

const num = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export function buildSettings(
  template: MotionTemplateDefinition,
  values: TemplateValues,
  organization: OrganizationProfile,
): SceneSettings {
  const { resolution, defaults } = template
  const fps = num(Number(values.motion?.fps), resolution.fps)
  const durationSec = num(values.motion?.durationSec, resolution.durationFrames / resolution.fps)
  const style = BACKGROUND_STYLES.includes(values.background?.style)
    ? values.background.style
    : defaults.background
  const colorA = normalizeHex(values.background?.colorA || organization.primary, '#2b2b2b')
  const colorB = normalizeHex(values.background?.colorB || organization.accent, '#5945ea')
  const media = values.device?.screenMedia

  return {
    width: resolution.width,
    height: resolution.height,
    fps,
    durationFrames: Math.max(1, Math.round(durationSec * fps)),
    baseFps: resolution.fps,
    speed: Math.max(0.25, num(values.motion?.speed, 1)),
    screenMedia: typeof media === 'string' && media !== '' ? media : defaults.screenMedia,
    chassisColor: values.device?.chassisColor || defaults.chassisColor,
    cameraFov: num(values.motion?.cameraFov, defaults.cameraFov),
    cameraDistance: num(values.motion?.cameraDistance, 1),
    background:
      style === 'solid'
        ? { type: 'solid', colorA, colorB: colorA }
        : { type: 'shader', preset: style, colorA, colorB },
  }
}

/** Output frame → the scene's authored frame (fps conversion and speed). */
export const authoredFrame = (frame: number, settings: SceneSettings) =>
  (frame * settings.baseFps * settings.speed) / settings.fps

/** Authored frame → output frame, for drawing keyframe ticks on the timeline. */
export const outputFrame = (frame: number, settings: SceneSettings) =>
  (frame * settings.fps) / (settings.baseFps * settings.speed)

export const titleOverlay: TemplateOverlay = {
  component: TitleOverlay,
  props: (values: TemplateValues, organization: OrganizationProfile) => {
    const accent = normalizeHex(organization.accent, '#5945ea')
    const family = (organization.font || 'Exo 2').replaceAll("'", '')
    return {
      headline: typeof values.title?.headline === 'string' ? values.title.headline : '',
      subtitle: typeof values.title?.subtitle === 'string' ? values.title.subtitle : '',
      fontFamily: `'${family}', 'Exo 2 Variable', system-ui, sans-serif`,
      accent,
      onAccent: onColor(accent),
      logo: organization.logo?.dataUrl ?? '',
    }
  },
}