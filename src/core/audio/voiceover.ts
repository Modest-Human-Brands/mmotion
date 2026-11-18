import { spokenWords, type Composition } from '@/core/composition/schema'
import {
  VOICE_LEAD,
  clampDuration,
  readingSeconds,
  sceneSpans,
  totalSeconds,
  type WordTime,
} from '@/core/composition/timing'
import { speech, transcribe, type VoiceSample } from '@/core/llm/client'

import { getBlob, hashKey, putBlob } from './cache'

export const SAMPLE_RATE = 48_000
/** Silence after a scene's narration ends (calm kinds; fast kinds use less). */
export const VOICE_TAIL = 0.7

/** Tail for a kind whose shortest scenes last `minScene` seconds: fast cuts breathe less. */
export const voiceTail = (minScene = 4) => Math.min(VOICE_TAIL, Math.max(0.3, minScene * 0.2))

let context: AudioContext | null = null
const audioContext = () => (context ??= new AudioContext({ sampleRate: SAMPLE_RATE }))

export interface Narration {
  buffer: AudioBuffer
  /** The recorded WAV (for exports and waveforms). */
  clip?: Blob
  /** Word timings within the clip, when a transcription model is configured. */
  words?: WordTime[]
}

const memo = new Map<string, Promise<Narration>>()

/** A cloned voice: `id` names the sample in cache keys. */
export interface ClonedVoice {
  id: string
  sample: VoiceSample
}

export interface NarrationRequest {
  baseUrl: string
  speechModel: string
  /** Word-timing model; "" skips timings. */
  hearingModel: string
  text: string
  /** Language code of the text (passed to the transcriber). */
  language?: string
  /** Pass `[tags]` to the speech model (it understands them); otherwise they are removed. */
  keepTags?: boolean
  /** Bump for a new recording of the same text. */
  take?: number
  voice?: ClonedVoice
  signal?: AbortSignal
}

const spokenText = (request: NarrationRequest) =>
  request.keepTags ? request.text.trim() : spokenWords(request.text)

async function clipKey(request: NarrationRequest) {
  return hashKey(
    'voice',
    request.speechModel,
    spokenText(request),
    ...(request.voice ? [request.voice.id] : []),
    ...(request.take ? [`take${request.take}`] : []),
  )
}

async function cachedSpeech(request: NarrationRequest, key: string) {
  let blob = await getBlob(key)
  if (!blob) {
    blob = await speech(
      request.baseUrl,
      request.speechModel,
      spokenText(request),
      request.signal,
      request.voice?.sample,
    )
    await putBlob(key, blob)
  }
  return blob
}

async function cachedWords(request: NarrationRequest, clip: Blob, key: string) {
  const wordsKey = await hashKey('words', request.hearingModel, key)
  const cached = await getBlob(wordsKey)
  if (cached) return JSON.parse(await cached.text()) as WordTime[]
  const { words } = await transcribe(
    request.baseUrl,
    request.hearingModel,
    clip,
    request.signal,
    request.language,
  )
  await putBlob(wordsKey, new Blob([JSON.stringify(words)], { type: 'application/json' }))
  return words
}

/** Narration for a line: synthesized once and cached, plus word timings with a hearing model. */
export async function narrate(request: NarrationRequest): Promise<Narration> {
  const key = await clipKey(request)
  const id = `${key}\u0000${request.hearingModel}`
  let pending = memo.get(id)
  if (!pending) {
    pending = (async () => {
      const clip = await cachedSpeech(request, key)
      const buffer = await audioContext().decodeAudioData(await clip.arrayBuffer())
      if (!request.hearingModel) return { buffer, clip }
      try {
        return { buffer, clip, words: await cachedWords(request, clip, key) }
      } catch {
        // Timings are a refinement; beats fall back to an even spread without them.
        return { buffer, clip }
      }
    })()
    memo.set(id, pending)
    pending.catch(() => memo.delete(id))
  }
  return pending
}

/** Make every narrated scene at least as long as its voiceover. */
/**
 * Each narrated scene lasts as long as its recorded line (plus a short lead and tail), but never
 * less than its on-screen text needs to be read. The first estimate came from word counts, so
 * scenes shrink as well as grow.
 */
export function fitToVoiceover(
  composition: Composition,
  voices: Map<string, Narration>,
  minScene?: number,
): Composition {
  const tail = voiceTail(minScene)
  return {
    ...composition,
    scenes: composition.scenes.map((scene) => {
      const voice = voices.get(scene.id)
      if (!voice) return scene
      const duration = clampDuration(
        Math.max(voice.buffer.duration + VOICE_LEAD + tail, readingSeconds(scene)),
      )
      return duration === scene.duration ? scene : { ...scene, duration }
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