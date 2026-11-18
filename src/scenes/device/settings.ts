import type { BackgroundConfig } from '@/domain/animation/types'

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

/** Output frame → the scene's authored frame (fps conversion and speed). */
export const authoredFrame = (frame: number, settings: SceneSettings) =>
  (frame * settings.baseFps * settings.speed) / settings.fps

/** Authored frame → output frame, for drawing keyframe ticks on the timeline. */
export const outputFrame = (frame: number, settings: SceneSettings) =>
  (frame * settings.fps) / (settings.baseFps * settings.speed)