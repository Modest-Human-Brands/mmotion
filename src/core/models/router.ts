import type { ModelInfo } from '@/core/llm/client'

import { CATALOG, languageName, profile, type Task } from './catalog'

export interface Need {
  /** Project language (speech and transcription only). */
  language?: string
  /** The video will be used commercially: models with a non-commercial licence are skipped. */
  commercial?: boolean
  /** Pictures: models that suit the art style, best first (a bonus, not a filter). */
  prefer?: string[]
}

export interface Route {
  model: string
  /** Why this model, in a few words. */
  reason: string
  /** Things the user should know (licence unclear, language in beta). */
  warnings: string[]
  /** Next choices, best first, for fallback. */
  alternatives: string[]
}

export interface RouteContext {
  /** What the server offers right now. */
  models: ModelInfo[]
  /** Models that failed or disappeared this session. */
  down: ReadonlySet<string>
  /** User pins per task. */
  pins?: Partial<Record<Task, string>>
}

/** Can the server run `task` with this model at all? */
export function capable(model: ModelInfo, task: Task): boolean {
  switch (task) {
    case 'write':
      return model.canWrite
    case 'see':
      return model.canSee && model.canWrite
    case 'draw':
    case 'draft':
      return model.canDraw
    case 'drawFromRefs':
    case 'restyle':
      return model.canEdit
    case 'speak':
    case 'clone':
      return model.canSpeak
    case 'time':
    case 'transcribe':
      return model.canHear
  }
}

const LANGUAGE_TASKS = new Set<Task>(['speak', 'clone', 'time', 'transcribe'])
const REQUIRES_PROFILE = new Set<Task>(['clone'])
const PICTURE_TASKS = new Set<Task>(['draw', 'draft'])

interface Candidate {
  id: string
  score: number
  reason: string
  warnings: string[]
}

function judge(model: ModelInfo, task: Task, need: Need): Candidate | null {
  const entry = profile(model.id)
  // Jobs that need a feature the server does not advertise (cloning) only go to known models.
  if (!entry && REQUIRES_PROFILE.has(task)) return null
  const warnings: string[] = []
  let score = entry?.fit[task] ?? (entry ? 0 : 3)
  if (score <= 0) return null

  const licence = entry?.licence ?? 'unknown'
  if (need.commercial) {
    if (licence === 'non-commercial') return null
    if (licence === 'unknown') {
      score -= 1
      warnings.push(`${model.id}: check its licence before commercial use`)
    }
  }

  if (need.language && LANGUAGE_TASKS.has(task) && entry?.languages) {
    const official = entry.languages.includes('*') || entry.languages.includes(need.language)
    const beta = entry.beta?.includes(need.language)
    if (!official && !beta) return null
    if (beta && !official) {
      score -= 2
      warnings.push(`${languageName(need.language)} is not officially supported by ${model.id}`)
    }
  }
  if (need.language && LANGUAGE_TASKS.has(task) && entry?.strong?.includes(need.language))
    score += 2
  const preferred = PICTURE_TASKS.has(task) ? (need.prefer?.indexOf(model.id) ?? -1) : -1
  if (preferred !== -1) score += preferred === 0 ? 3 : 1
  if (!model.local) score -= 2

  return {
    id: model.id,
    score,
    reason: entry?.note ?? 'offered by the server',
    warnings,
  }
}

/** The best model for `task` given what the user needs and what the server can do right now. */
export function route(task: Task, need: Need, context: RouteContext): Route | null {
  const candidates = context.models
    .filter((model) => capable(model, task) && !context.down.has(model.id))
    .map((model) => judge(model, task, need))
    .filter((candidate): candidate is Candidate => !!candidate)
    .sort((a, b) => b.score - a.score || catalogOrder(a.id) - catalogOrder(b.id))

  const pinned = context.pins?.[task]
  const chosen =
    (pinned && candidates.find((candidate) => candidate.id === pinned)) || candidates[0]
  if (!chosen) return null
  return {
    model: chosen.id,
    reason: pinned === chosen.id ? 'chosen by you' : chosen.reason,
    warnings: chosen.warnings,
    alternatives: candidates.filter((candidate) => candidate !== chosen).map((c) => c.id),
  }
}

const catalogOrder = (id: string) => {
  const index = CATALOG.findIndex((entry) => entry.id === id)
  return index === -1 ? CATALOG.length : index
}

/**
 * What a server error says about the model:
 * - `unwell`: the engine failed to load or ran out of memory; it usually recovers within a minute,
 *   so wait and try the same model again;
 * - `gone`: the model cannot work at all here (missing files, unsupported operation);
 * - `other`: this request failed (bad input, one unlucky seed).
 */
export type Failure = 'unwell' | 'gone' | 'other'

export function classifyFailure(message: string): Failure {
  // Broken files: checked first, because these errors also say "failed to load".
  if (
    /exceeds .*vocabulary|failed to load tokenizer|failed to build model runners|dimension mismatch|shape mismatch/i.test(
      message,
    )
  )
    return 'gone'
  if (
    /failed during weight preparation|terminated prematurely|bad allocation|out of memory|timed out|unload and reload|failed to load|error sending request/i.test(
      message,
    )
  )
    return 'unwell'
  if (
    /artifact is missing|cannot execute|not supported|unsupported|model .* not found/i.test(message)
  )
    return 'gone'
  return 'other'
}

/** Seconds to wait before retrying an unwell model, growing with each strike. */
export const backoffSeconds = (strikes: number) => Math.min(120, 15 * 2 ** Math.max(0, strikes - 1))