import type { Beat, BeatAction } from '@/core/composition/schema'

export interface TimedBeat extends Beat {
  /** Scene-local seconds when the beat fires. */
  time: number
}

const easeOut = (t: number) => 1 - (1 - t) ** 3

/** 0 → 1 over `length` seconds after `start`; pure function of time. */
export const progressAt = (local: number, start: number, length = 0.5) =>
  easeOut(Math.min(1, Math.max(0, (local - start) / length)))

/** When the first `action` beat on `target` fires, or null if none does. */
export function firedAt(beats: TimedBeat[], action: BeatAction, target: number): number | null {
  return beats.find((beat) => beat.action === action && beat.target === target)?.time ?? null
}

export const hasAction = (beats: TimedBeat[], action: BeatAction) =>
  beats.some((beat) => beat.action === action)

/**
 * Reveal progress for item `index`: driven by its reveal beat when the scene has reveal beats,
 * otherwise items enter one after another from `start`.
 */
export function revealProgress(
  beats: TimedBeat[],
  local: number,
  index: number,
  start = 0.4,
  stagger = 0.18,
): number {
  if (hasAction(beats, 'reveal')) {
    const time = firedAt(beats, 'reveal', index)
    return time === null ? 0 : progressAt(local, time)
  }
  return progressAt(local, start + index * stagger, 0.6)
}

/** The caption on screen: the latest caption beat that has fired, else the scene caption. */
export function captionAt(beats: TimedBeat[], local: number, base: string) {
  let text = base
  let since = -Infinity
  for (const beat of beats) {
    if (beat.action === 'caption' && beat.time <= local) {
      text = beat.text
      since = beat.time
    }
  }
  return { text, since }
}