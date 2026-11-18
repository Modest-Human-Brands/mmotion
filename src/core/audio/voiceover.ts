import type { Composition } from '@/core/composition/schema'
import {
  VOICE_LEAD,
  clampDuration,
  sceneSpans,
  totalSeconds,
  type WordTime,
} from '@/core/composition/timing'
import { speech, transcribeWords } from '@/core/llm/client'

import { getBlob, hashKey, putBlob } from './cache'

export const SAMPLE_RATE = 48_000
/** Silence after a scene's narration ends. */
export const VOICE_TAIL = 0.7

let context: AudioContext | null = null
const audioContext = () => (context ??= new AudioContext({ sampleRate: SAMPLE_RATE }))

export interface Narration {
  buffer: AudioBuffer
  /** Word timings within the clip, when a transcription model is configured. */
  words?: WordTime[]
}

const memo = new Map<string, Promise<Narration>>()

async function cachedSpeech(baseUrl: string, model: string, text: string, signal?: AbortSignal) {
  const key = await hashKey('voice', model, text)
  let blob = await getBlob(key)
  if (!blob) {
    blob = await speech(baseUrl, model, text, signal)
    await putBlob(key, blob)
  }
  return blob
}

async function cachedWords(
  baseUrl: string,
  model: string,
  clipKey: string,
  clip: Blob,
  signal?: AbortSignal,
): Promise<WordTime[]> {
  const key = await hashKey('words', model, clipKey)
  const cached = await getBlob(key)
  if (cached) return JSON.parse(await cached.text()) as WordTime[]
  const words = await transcribeWords(baseUrl, model, clip, signal)
  await putBlob(key, new Blob([JSON.stringify(words)], { type: 'application/json' }))
  return words
}

/** Narration for `text`: synthesized once and cached, plus word timings when `hearingModel` is set. */
export function narrate(
  baseUrl: string,
  speechModel: string,
  hearingModel: string,
  text: string,
  signal?: AbortSignal,
): Promise<Narration> {
  const id = [speechModel, hearingModel, text].join('\u0000')
  let pending = memo.get(id)
  if (!pending) {
    pending = (async () => {
      const clip = await cachedSpeech(baseUrl, speechModel, text, signal)
      const buffer = await audioContext().decodeAudioData(await clip.arrayBuffer())
      if (!hearingModel) return { buffer }
      try {
        const words = await cachedWords(
          baseUrl,
          hearingModel,
          `${speechModel}\u0000${text}`,
          clip,
          signal,
        )
        return { buffer, words }
      } catch {
        // Timings are a refinement; beats fall back to an even spread without them.
        return { buffer }
      }
    })()
    memo.set(id, pending)
    pending.catch(() => memo.delete(id))
  }
  return pending
}

/** Make every narrated scene at least as long as its voiceover. */
export function fitToVoiceover(
  composition: Composition,
  voices: Map<string, Narration>,
): Composition {
  return {
    ...composition,
    scenes: composition.scenes.map((scene) => {
      const voice = voices.get(scene.id)
      if (!voice) return scene
      const needed = clampDuration(voice.buffer.duration + VOICE_LEAD + VOICE_TAIL)
      return needed > scene.duration ? { ...scene, duration: needed } : scene
    }),
  }
}

/** One track with every scene's narration placed at its scene start. */
export async function mixdown(
  composition: Composition,
  voices: Map<string, Narration>,
): Promise<AudioBuffer | null> {
  if (voices.size === 0) return null
  const length = Math.max(1, Math.ceil(totalSeconds(composition) * SAMPLE_RATE))
  const offline = new OfflineAudioContext(1, length, SAMPLE_RATE)
  for (const span of sceneSpans(composition)) {
    const voice = voices.get(span.scene.id)
    if (!voice) continue
    const source = offline.createBufferSource()
    source.buffer = voice.buffer
    source.connect(offline.destination)
    source.start(span.start + VOICE_LEAD)
  }
  return offline.startRendering()
}

/** Plays a mixdown in step with the timeline. */
export function createPlayback() {
  let source: AudioBufferSourceNode | null = null

  function stop() {
    source?.stop()
    source?.disconnect()
    source = null
  }

  return {
    play(buffer: AudioBuffer, fromSeconds: number) {
      stop()
      if (fromSeconds >= buffer.duration) return
      const ctx = audioContext()
      void ctx.resume()
      source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start(0, fromSeconds)
    },
    stop,
  }
}