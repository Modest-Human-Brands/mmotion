import type { Component } from 'vue'
import type { z } from 'zod'

import type { BloomConfig } from '@/domain/animation/types'
import type { OrganizationProfile } from '@/domain/organization'

export type TemplateCategory = 'Laptop' | 'Phone' | 'Multi-device'

export const BACKGROUND_STYLES = ['studio', 'mesh', 'aurora', 'plasma', 'solid'] as const
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number]

// oxlint-disable-next-line typescript/no-explicit-any
export type TemplateValues = Record<string, any>

export interface MotionResolution {
  width: number
  height: number
  aspectRatio: string
  /** The fps the scene's keyframes are authored at. */
  fps: number
  /** Length of the authored animation, in frames at `fps`. */
  durationFrames: number
}

export interface TemplateOverlay {
  component: Component
  props: (values: TemplateValues, organization: OrganizationProfile) => Record<string, unknown>
}

export interface TemplateDefaults {
  screenMedia: string
  chassisColor?: string
  cameraFov: number
  background: BackgroundStyle
}

export interface MotionTemplateDefinition {
  id: string
  label: string
  shortLabel: string
  category: TemplateCategory
  description: string
  resolution: MotionResolution
  /** Poster image shown on cards, so the picker never opens a WebGL context per template. */
  thumbnail: string
  scene: Component
  defaults: TemplateDefaults
  bloom?: BloomConfig
  schema: z.ZodObject<z.ZodRawShape>
  placeholders: TemplateValues
  overlay?: TemplateOverlay
}