import { computed, inject, onScopeDispose, provide, type ComputedRef, type InjectionKey } from 'vue'

import { evaluateTrack, type Track } from '@/domain/animation/interpolator'

/** Something whose picture depends on time and must be moved before a frame is captured. */
export interface TimeSource {
  seek(seconds: number): Promise<void>
}

export interface SceneContext {
  /** Frame in the template's authored timeline (speed and fps already applied, may be fractional). */
  frame: ComputedRef<number>
  seconds: ComputedRef<number>
  screenMedia: ComputedRef<string>
  chassisColor: ComputedRef<string | undefined>
  cameraFov: ComputedRef<number | undefined>
  cameraDistance: ComputedRef<number>
  aspect: ComputedRef<number>
  isMobile: boolean
  /** Resolves once everything tracked so far (models, media) has loaded. */
  whenReady(): Promise<void>
  /** Report the authored frames of a keyframe track so the timeline can show ticks. */
  registerKeys(frames: number[]): () => void
  /** Hold export until `pending` settles (model loads, texture decodes). */
  track(pending: Promise<unknown>): void
  /** Register a source that must be seeked each frame (video, Rive). */
  registerTimeSource(source: TimeSource): () => void
}

const SCENE_KEY: InjectionKey<SceneContext> = Symbol('scene')

export const provideSceneContext = (context: SceneContext) => provide(SCENE_KEY, context)

export function useSceneContext(): SceneContext {
  const context = inject(SCENE_KEY, null)
  if (!context) throw new Error('Scene components must be used inside <SceneStage>.')
  return context
}

/**
 * A keyframe track evaluated at the current scene time. Frames are authored at the
 * template's base fps; speed and output fps are handled by the stage.
 */
export function useTrack<T extends number | readonly number[]>(
  keys: Track<T>,
  fallback?: T,
): ComputedRef<T> {
  const context = useSceneContext()
  const first = keys[0]?.value
  const base = (fallback ?? first ?? 0) as T
  const unregister = context.registerKeys(keys.map((key) => key.frame))
  onScopeDispose(unregister)
  return computed(() => evaluateTrack(keys, context.frame.value, base))
}