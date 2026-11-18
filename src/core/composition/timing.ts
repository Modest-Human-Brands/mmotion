import { spokenWords, type Composition, type Scene } from './schema'

/** Overlap used when a scene enters over the previous one (seconds). */
export const TRANSITION_SECONDS = 0.5
/** Silence before a scene's narration starts. */
export const VOICE_LEAD = 0.35

export const transitionLength = (scene: Scene, index: number) =>
  index === 0 || scene.transition === 'cut' ? 0 : TRANSITION_SECONDS

export interface SceneSpan {
  scene: Scene
  index: number
  /** Seconds from the start of the video. */
  start: number
  end: number
}

/** Scenes play back to back; a transition overlaps the previous scene's tail. */
export function sceneSpans(composition: Composition): SceneSpan[] {
  let cursor = 0
  return composition.scenes.map((scene, index) => {
    const start = Math.max(0, cursor - transitionLength(scene, index))
    const end = start + scene.duration
    cursor = end
    return { scene, index, start, end }
  })
}

export const totalSeconds = (composition: Composition) => sceneSpans(composition).at(-1)?.end ?? 0

export const totalFrames = (composition: Composition) =>
  Math.max(1, Math.round(totalSeconds(composition) * composition.fps))

/** Scenes visible at `seconds`: the current one, plus the previous one during a transition. */
export function activeSpans(spans: SceneSpan[], seconds: number): SceneSpan[] {
  const visible = spans.filter((span) => seconds >= span.start && seconds < span.end)
  if (visible.length > 0) return visible
  const last = spans.at(-1)
  return last && seconds >= last.end ? [last] : spans.slice(0, 1)
}

const WORDS_PER_SECOND = 2.6

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length

/** Seconds a viewer needs to read a scene's on-screen text. */
export function readingSeconds(scene: Scene): number {
  const onScreen = [
    scene.chrome.headline,
    scene.chrome.caption,
    ...scene.beats.map((beat) => beat.text),
    ...scene.element.items.map((item) => item.label),
  ].join(' ')
  return Math.max(wordCount(onScreen) / 4 + 1.2, 1.5)
}

/** A first guess at a scene's length from its narration and on-screen text. */
export function estimateDuration(scene: Scene): number {
  const narration = wordCount(spokenWords(scene.voiceover)) / WORDS_PER_SECOND
  return clampDuration(Math.max(narration + 0.9, readingSeconds(scene), 2.5))
}

export const clampDuration = (seconds: number) =>
  Math.min(30, Math.max(1, Math.round(seconds * 10) / 10))

export interface WordTime {
  word: string
  /** Seconds from the start of the scene's narration clip. */
  start: number
  end: number
}

const tokens = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFC')
    // Keep combining marks: Bengali and Devanagari vowel signs are part of the word.
    .replace(/[^\p{L}\p{M}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)

/** Edit distance between two words (small inputs only). */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]!
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[b.length]!
}

/**
 * Close enough to be the same spoken word: speech models and transcribers often differ by a
 * letter or a vowel sign, especially outside English.
 */
export function sameWord(heard: string, written: string): boolean {
  if (heard === written) return true
  const longest = Math.max(heard.length, written.length)
  if (longest < 4) return false
  return distance(heard, written) / longest <= 0.34
}

/**
 * Scene-local time (seconds) for each beat: when its phrase is spoken, found in the narration's
 * word timings. Beats whose phrase is not found are spread evenly between their neighbours.
 * Times never go backwards, so beats keep their authored order.
 */
export function beatTimes(scene: Scene, words: WordTime[] | undefined): number[] {
  const spoken = (words ?? []).map((word) => tokens(word.word)[0] ?? '')
  const found: (number | null)[] = []
  let from = 0

  for (const beat of scene.beats) {
    const phrase = tokens(beat.at)
    let hit: number | null = null
    if (phrase.length > 0 && words) {
      for (let i = from; i <= spoken.length - phrase.length; i++) {
        if (phrase.every((token, k) => sameWord(spoken[i + k] ?? '', token))) {
          hit = i
          break
        }
      }
    }
    if (hit !== null) {
      found.push(VOICE_LEAD + words![hit]!.start)
      from = hit + phrase.length
    } else found.push(null)
  }

  // Even spread for misses, anchored on the nearest known times.
  const end = scene.duration - 0.6
  const result: number[] = []
  for (let i = 0; i < found.length; i++) {
    const known = found[i]
    if (known !== null && known !== undefined) {
      result.push(known)
      continue
    }
    const before = i === 0 ? 0.6 : result[i - 1]!
    let next = i + 1
    while (next < found.length && found[next] === null) next++
    const after = next < found.length ? found[next]! : end
    const gaps = next - i + 1
    result.push(before + (after - before) / gaps)
  }
  for (let i = 1; i < result.length; i++) result[i] = Math.max(result[i]!, result[i - 1]!)
  return result
}