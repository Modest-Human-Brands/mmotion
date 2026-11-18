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
  local: boolean
}

interface RawModel {
  id: string
  tasks?: string[]
  capabilities?: string[]
  locality?: string
  status?: string
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
}

/** One chat completion constrained to `schema`, with the model's hidden thinking switched off. */
export async function chatJson<T>(request: JsonRequest): Promise<T> {
  const response = await fetch(`${trimSlash(request.baseUrl)}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: request.signal,
    body: JSON.stringify({
      model: request.model,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
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

/** Narration audio (WAV). Local speech engines often support only their default voice. */
export async function speech(
  baseUrl: string,
  model: string,
  input: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(`${trimSlash(baseUrl)}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify({ model, input, response_format: 'wav' }),
  })
  if (!response.ok) throw await failure(response)
  return response.blob()
}
/** One generated picture (PNG). */
export async function generateImage(
  baseUrl: string,
  model: string,
  prompt: string,
  options: { size: string; seed: number; signal?: AbortSignal },
): Promise<Blob> {
  const response = await fetch(`${trimSlash(baseUrl)}/v1/images/generations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: options.signal,
    body: JSON.stringify({
      model,
      prompt,
      size: options.size,
      seed: options.seed,
      n: 1,
      response_format: 'b64_json',
    }),
  })
  if (!response.ok) throw await failure(response)
  const body = (await response.json()) as { data?: { b64_json?: string }[] }
  const b64 = body.data?.[0]?.b64_json
  if (!b64) throw new LlmError('The image model returned no picture.')
  const bytes = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0))
  return new Blob([bytes], { type: 'image/png' })
}

export interface TimedWord {
  word: string
  start: number
  end: number
}

/** Word-level timings for a clip. Accepts both Whisper (segment words) and flat word lists. */
export async function transcribeWords(
  baseUrl: string,
  model: string,
  audio: Blob,
  signal?: AbortSignal,
): Promise<TimedWord[]> {
  const form = new FormData()
  form.append('model', model)
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
    words?: TimedWord[]
    segments?: { words?: TimedWord[] }[]
  }
  const words = body.words?.length
    ? body.words
    : (body.segments ?? []).flatMap((s) => s.words ?? [])
  return words.map((word) => ({ word: word.word.trim(), start: word.start, end: word.end }))
}