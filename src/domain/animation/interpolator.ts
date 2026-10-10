import { ease, type EasingType } from './easing'

export interface Keyframe<T> {
  frame: number
  value: T
  easing?: EasingType
}

export type Track<T> = readonly Keyframe<T>[]

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function mix<T extends number | readonly number[]>(a: T, b: T, t: number): T {
  if (typeof a === 'number') return lerp(a, b as number, t) as T
  const to = b as readonly number[]
  return (a as readonly number[]).map((v, i) => lerp(v, to[i] ?? v, t)) as unknown as T
}

const copy = <T extends number | readonly number[]>(value: T): T =>
  (typeof value === 'number' ? value : Array.from(value as readonly number[])) as T

/**
 * Evaluate a keyframe track at `frame`. Clamps to the first/last keyframe,
 * eases with the outgoing keyframe's easing, and returns `fallback` for an
 * empty or missing track. Tracks must be sorted by frame.
 */
export function evaluateTrack<T extends number | readonly number[]>(
  track: Track<T> | undefined,
  frame: number,
  fallback: T,
): T {
  const first = track?.[0]
  if (!track || !first) return copy(fallback)
  const last = track[track.length - 1]!
  if (track.length === 1 || frame <= first.frame) return copy(first.value)
  if (frame >= last.frame) return copy(last.value)

  for (let i = 0; i < track.length - 1; i++) {
    const from = track[i]!
    const to = track[i + 1]!
    if (frame >= from.frame && frame <= to.frame) {
      const span = to.frame - from.frame
      const raw = span === 0 ? 1 : (frame - from.frame) / span
      return mix(from.value, to.value, ease(from.easing, raw))
    }
  }
  return copy(last.value)
}