import type { PropType } from 'vue'

import type { BrandTokens, SceneElement } from '@/core/composition/schema'

import type { TimedBeat } from '../beats'

export type ImageStatus = 'idle' | 'queued' | 'running' | 'done' | 'error'

export interface ImageState {
  url: string | null
  status: ImageStatus
  /** A complete picture with its own background (full-bleed styles): framed, not blended. */
  framed?: boolean
}

/**
 * Every element receives the same props; each reads what its kind needs. Declared at runtime
 * because the SFC compiler cannot resolve imported types in this toolchain.
 */
export const elementProps = {
  element: { type: Object as PropType<SceneElement>, required: true },
  beats: { type: Array as PropType<TimedBeat[]>, required: true },
  /** Seconds since the scene started. */
  local: { type: Number, required: true },
  image: { type: Object as PropType<ImageState>, required: true },
  brand: { type: Object as PropType<BrandTokens>, required: true },
} as const