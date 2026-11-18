/** Minimal client for an OpenAI-compatible server (e.g. a local inference router). */

export interface ModelInfo {
  id: string
  tasks: string[]
  /** Usable for planning and edits: text generation with structured output. */
  canWrite: boolean
  /** Usable for voiceover through `/v1/audio/speech`. */
  canSpeak: boolean
  /** Usable for illustrations through `/v1/images/generations`. */
  canDraw: boolean
  /** Usable for narration word timings through `/v1/audio/transcriptions`. */
  canHear: boolean
  /** Draws from reference images through `/v1/images/edits` (keeps characters consistent). */
  canEdit: boolean
  /** Reads images in chat messages (video analysis, reference comparison). */
  canSee: boolean
  /** Reference images an edit can take. */
  maxReferences: number
  local: boolean
}

interface RawModel {
  id: string
  tasks?: string[]
  capabilities?: string[]
  locality?: string
  status?: string
  max_image_references?: number
  audio_operations?: { speech_generation?: { status?: string } }
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'LlmError'
  }
}

/**
 * One model call at a time. A local server usually cannot hold the writing, image and speech
 * models together; overlapping requests make it swap or fail. Foreground calls (the user is
 * waiting) go before queued background ones (illustrations), and interrupt a background call in
 * flight: it fails with `Preempted` and its owner queues it again. Within a priority, calls for the
 * model that ran last go first, so a model is loaded once for all its queued work.
 */
type Priority = 'foreground' | 'background'
interface Job {
  priority: Priority
  model: string
  start: () => void
}
const waiting: Job[] = []
let running: { priority: Priority; model: string; controller: AbortController } | null = null
let lastModel = ''

export class Preempted extends Error {
  constructor() {
    super('Interrupted for a foreground request')
    this.name = 'Preempted'
  }
}

/** The job to run next: foreground first, then the loaded model, then arrival order. */
export function pickNext<T extends { priority: Priority; model: string }>(
  jobs: T[],
  loaded: string,
): number {
  if (jobs.length === 0) return -1
  const urgent = jobs.some((job) => job.priority === 'foreground') ? 'foreground' : 'background'
  const same = jobs.findIndex((job) => job.priority === urgent && job.model === loaded)
  return same !== -1 ? same : jobs.findIndex((job) => job.priority === urgent)
}

function next() {
  if (running) {
    if (running.priority === 'background' && waiting.some((job) => job.priority === 'foreground'))
      running.controller.abort(new Preempted())
    return
  }
  const index = pickNext(waiting, lastModel)
  if (index === -1) return
  const [job] = waiting.splice(index, 1)
  job!.start()
}

// --------------------------------------------------------------------- timings

const STATS_KEY = 'mmotion.modelStats'
type Stats = Record<string, { runs: number; ms: number }>
function readStats(): Stats {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) ?? '{}') as Stats
  } catch {
    return {}
  }
}
function record(model: string, ms: number) {
  try {
    const stats = readStats()
    const entry = stats[model] ?? { runs: 0, ms: 0 }
    // Running average weighted towards recent runs.
    entry.ms = entry.runs === 0 ? ms : entry.ms * 0.7 + ms * 0.3
    entry.runs += 1
    stats[model] = entry
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch {
    // Timings are a convenience.
  }
}
/** Typical seconds per call for `model` on this server, when known. */
export const typicalSeconds = (model: string) => {
  const entry = readStats()[model]
  return entry ? entry.ms / 1000 : null
}

/** Queue state for progress displays. */
export const queueState = () => ({
  running: running ? { model: running.model, priority: running.priority } : null,
  waiting: waiting.map((job) => ({ model: job.model, priority: job.priority })),
})

/** Run `task` alone. It receives a signal that fires when a background call is preempted. */
export function exclusive<T>(
  task: (preempt: AbortSignal) => Promise<T>,
  priority: Priority = 'foreground',
  model = '',
) {
  return new Promise<T>((resolve, reject) => {
    waiting.push({
      priority,
      model,
      start: () => {
        const controller = new AbortController()
        running = { priority, model, controller }
        lastModel = model || lastModel
        const began = performance.now()
        task(controller.signal)
          .then(
            (value) => {
              record(model, performance.now() - began)
              resolve(value)
            },
            (error: unknown) =>
              reject(controller.signal.aborted ? controller.signal.reason : error),
          )
          .finally(() => {
            running = null
            next()
          })
      },
    })
    next()
  })
}

/** Foreground calls waiting or running; background work should hold off while this is true. */
export const foregroundPending = () =>
  running?.priority === 'foreground' || waiting.some((job) => job.priority === 'foreground')

const both = (a: AbortSignal | undefined, b: AbortSignal) => (a ? AbortSignal.any([a, b]) : b)

const trimSlash = (url: string) => url.replace(/\/+$/, '')

async function failure(response: Response): Promise<LlmError> {
  try {
    const body = (await response.json()) as { error?: { message?: string; code?: string } }
    return new LlmError(body.error?.message ?? response.statusText, body.error?.code)
  } catch {
    return new LlmError(`${response.status} ${response.statusText}`)
  }
}

export async function listModels(baseUrl: string, signal?: AbortSignal): Promise<ModelInfo[]> {
  const response = await fetch(`${trimSlash(baseUrl)}/v1/models`, { signal })
  if (!response.ok) throw await failure(response)
  const body = (await response.json()) as { data: RawModel[] }
  return body.data.map((model) => {
    const tasks = model.tasks ?? []
    return {
      id: model.id,
      tasks,
      canWrite:
        tasks.includes('text-to-text') && (model.capabilities ?? []).includes('Structured Output'),
      canSpeak: model.audio_operations?.speech_generation?.status === 'supported',
      canDraw: tasks.includes('text-to-image'),
      canHear: tasks.includes('audio-to-text'),
      canEdit: tasks.includes('text-image-to-image'),
      canSee: tasks.includes('text-image-to-text'),
      maxReferences: model.max_image_references ?? 1,
      local: model.locality !== 'remote' && model.status !== 'remote',
    }
  })
}

export interface JsonRequest {
  baseUrl: string
  model: string
  system: string
  user: string
  /** Strict JSON schema: every object needs `additionalProperties: false` and all keys required. */
  schema: Record<string, unknown>
  schemaName: string
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
  /** Image data URLs shown to the model after the user text. */
  images?: string[]
}

/** One chat completion constrained to `schema`, with the model's hidden thinking switched off. */
export function chatJson<T>(request: JsonRequest): Promise<T> {
  return exclusive(() => chatJsonNow<T>(request), 'foreground', request.model)
}

async function chatJsonNow<T>(request: JsonRequest): Promise<T> {
  const user = request.images?.length
    ? [
        { type: 'text', text: request.user },
        ...request.images.map((url) => ({ type: 'image_url', image_url: { url } })),
      ]
    : request.user
  const response = await fetch(`${trimSlash(request.baseUrl)}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: request.signal,
    body: JSON.stringify({
      model: request.model,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: request.schemaName, strict: true, schema: request.schema },
      },
      // Thinking costs ~15x the time for these structured tasks with no visible gain.
      reasoning_effort: 'none',
      temperature: request.temperature ?? 0.4,
      max_tokens: request.maxTokens ?? 4096,
    }),
  })
  if (!response.ok) throw await failure(response)
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  const content = body.choices?.[0]?.message?.content
  if (!content) throw new LlmError('The model returned an empty answer.')
  try {
    return JSON.parse(content) as T
  } catch {
    throw new LlmError('The model returned malformed JSON.')
  }
}

export interface VoiceSample {
  /** Data URL of a short WAV. */
  audio: string
  /** What is said in it. */
  text: string
}

/** Narration audio (WAV). With `sample`, cloning models imitate that voice. */
export function speech(
  baseUrl: string,
  model: string,
  input: string,
  signal?: AbortSignal,
  sample?: VoiceSample,
): Promise<Blob> {
  return exclusive(
    async () => {
      const response = await fetch(`${trimSlash(baseUrl)}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal,
        body: JSON.stringify({
          model,
          input,
          response_format: 'wav',
          ...(sample ? { ref_audio: sample.audio, ref_text: sample.text } : {}),
        }),
      })
      if (!response.ok) throw await failure(response)
      return response.blob()
    },
    'foreground',
    model,
  )
}

interface ImageOptions {
  size: string
  seed: number
  signal?: AbortSignal
  priority?: Priority
  /** Give up after this many ms of the request running (time waiting in the queue not counted). */
  timeout?: number
}

/** The caller's signal, the preemption signal and the running-time limit, combined. */
const pictureSignal = (options: ImageOptions, preempt: AbortSignal) => {
  const signal = both(options.signal, preempt)
  return options.timeout ? AbortSignal.any([signal, AbortSignal.timeout(options.timeout)]) : signal
}

async function pictureFrom(response: Response): Promise<Blob> {
  if (!response.ok) throw await failure(response)
  const body = (await response.json()) as { data?: { b64_json?: string }[] }
  const b64 = body.data?.[0]?.b64_json
  if (!b64) throw new LlmError('The image model returned no picture.')
  const bytes = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0))
  return new Blob([bytes], { type: 'image/png' })
}

/** One generated picture (PNG). */
export function generateImage(
  baseUrl: string,
  model: string,
  prompt: string,
  options: ImageOptions,
): Promise<Blob> {
  return exclusive(
    async (preempt) => {
      const response = await fetch(`${trimSlash(baseUrl)}/v1/images/generations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: pictureSignal(options, preempt),
        body: JSON.stringify({
          model,
          prompt,
          size: options.size,
          seed: options.seed,
          n: 1,
          response_format: 'b64_json',
        }),
      })
      return pictureFrom(response)
    },
    options.priority,
    model,
  )
}

/** A picture drawn from reference images (the people and things in it keep their look). */
export function editImage(
  baseUrl: string,
  model: string,
  prompt: string,
  references: Blob[],
  options: ImageOptions,
): Promise<Blob> {
  return exclusive(
    async (preempt) => {
      const form = new FormData()
      form.append('model', model)
      form.append('prompt', prompt)
      form.append('size', options.size)
      form.append('seed', String(options.seed))
      form.append('response_format', 'b64_json')
      references.forEach((blob, index) => form.append('image[]', blob, `ref${index}.png`))
      const response = await fetch(`${trimSlash(baseUrl)}/v1/images/edits`, {
        method: 'POST',
        body: form,
        signal: pictureSignal(options, preempt),
      })
      return pictureFrom(response)
    },
    options.priority,
    model,
  )
}

export interface TimedWord {
  word: string
  start: number
  end: number
}

/** Word-level timings for a clip. Accepts both Whisper (segment words) and flat word lists. */
export interface Transcript {
  text: string
  words: TimedWord[]
  /** Detected language code, when the model reports one. */
  language: string
}

/** Word-level timings for a clip. */
export async function transcribeWords(
  baseUrl: string,
  model: string,
  audio: Blob,
  signal?: AbortSignal,
): Promise<TimedWord[]> {
  return (await transcribe(baseUrl, model, audio, signal)).words
}

/** Text, word timings and detected language. Accepts Whisper (segment words) and flat word lists. */
export function transcribe(
  baseUrl: string,
  model: string,
  audio: Blob,
  signal?: AbortSignal,
  language?: string,
): Promise<Transcript> {
  return exclusive(
    () => transcribeNow(baseUrl, model, audio, signal, language),
    'foreground',
    model,
  )
}

async function transcribeNow(
  baseUrl: string,
  model: string,
  audio: Blob,
  signal?: AbortSignal,
  language?: string,
): Promise<Transcript> {
  const form = new FormData()
  form.append('model', model)
  if (language) form.append('language', language)
  form.append('file', audio, 'clip.wav')
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'word')
  const response = await fetch(`${trimSlash(baseUrl)}/v1/audio/transcriptions`, {
    method: 'POST',
    body: form,
    signal,
  })
  if (!response.ok) throw await failure(response)
  const body = (await response.json()) as {
    text?: string
    language?: string
    words?: TimedWord[]
    segments?: { words?: TimedWord[] }[]
  }
  const words = body.words?.length
    ? body.words
    : (body.segments ?? []).flatMap((s) => s.words ?? [])
  return {
    text: body.text?.trim() ?? '',
    language: LANGUAGE_CODES[body.language?.toLowerCase() ?? ''] ?? body.language ?? '',
    words: words.map((word) => ({ word: word.word.trim(), start: word.start, end: word.end })),
  }
}

/** Whisper reports language names; the app uses codes. */
const LANGUAGE_CODES: Record<string, string> = {
  english: 'en',
  bengali: 'bn',
  bangla: 'bn',
  hindi: 'hi',
}