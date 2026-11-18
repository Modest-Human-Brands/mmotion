import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'

import { LlmError, listModels, type ModelInfo } from '@/core/llm/client'
import { TASKS, type Task } from '@/core/models/catalog'
import { backoffSeconds, classifyFailure, route, type Need, type Route } from '@/core/models/router'

interface Settings {
  baseUrl: string
  /** Models the user fixed for a task; missing or "" = automatic. */
  pins: Partial<Record<Task, string>>
}

const DOWN_KEY = 'mmotion.down'
function readDown(): [string, string][] {
  try {
    return JSON.parse(sessionStorage.getItem(DOWN_KEY) ?? '[]') as [string, string][]
  } catch {
    return []
  }
}
function writeDown(entries: [string, string][]) {
  try {
    sessionStorage.setItem(DOWN_KEY, JSON.stringify(entries))
  } catch {
    // Only a convenience.
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = useStorage<Settings>(
    'mmotion.settings',
    { baseUrl: 'http://127.0.0.1:8981', pins: {} },
    undefined,
    { mergeDefaults: true },
  )

  const models = ref<ModelInfo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** Models that failed in a way that means they are unusable this session, with the reason. */
  const down = reactive(new Map<string, string>(readDown()))
  // Kept for the browser session, so a reload does not retry a model that keeps failing.
  watch(down, () => writeDown([...down.entries()]), { deep: true })

  /** Fetch the model list. `retry`: also give models marked unusable another chance. */
  async function refresh(retry = false) {
    loading.value = true
    error.value = null
    try {
      models.value = await listModels(saved.value.baseUrl)
      if (retry) down.clear()
    } catch (e) {
      models.value = []
      error.value =
        e instanceof Error ? `Could not reach ${saved.value.baseUrl}: ${e.message}` : 'Unreachable'
    } finally {
      loading.value = false
    }
  }

  /** The model for a task right now, or null when the server has none. */
  function pick(task: Task, need: Need = {}): Route | null {
    return route(task, need, {
      models: models.value,
      down: new Set(down.keys()),
      pins: saved.value.pins,
    })
  }

  /** Model id for a task ("" when none). */
  const modelFor = (task: Task, need: Need = {}) => pick(task, need)?.model ?? ''

  /** References the reference-drawing model accepts per picture. */
  function maxReferences(model: string) {
    return models.value.find((item) => item.id === model)?.maxReferences ?? 1
  }

  /** Skip a model for the rest of the session (it keeps failing). */
  function markDown(model: string, reason: string): true {
    down.set(model, reason.split('\n')[0]!.slice(0, 160))
    return true
  }

  /** Times each model failed as `unwell` in a row; three strikes and it is skipped. */
  const strikes = new Map<string, number>()
  /** Shown while waiting for an engine to recover. */
  const waiting = ref<string | null>(null)

  /**
   * Record a failure and say what to do: `retry` the same model after `wait` seconds, `next` model
   * (this one is now skipped), or `fail` (the request itself failed).
   */
  function report(
    model: string,
    failure: unknown,
  ): { action: 'retry' | 'next' | 'fail'; wait: number } {
    const message = failure instanceof Error ? failure.message : String(failure)
    const kind = failure instanceof LlmError ? classifyFailure(message) : 'other'
    if (kind === 'gone') {
      markDown(model, message)
      return { action: 'next', wait: 0 }
    }
    if (kind === 'unwell') {
      const count = (strikes.get(model) ?? 0) + 1
      strikes.set(model, count)
      if (count >= 3) {
        markDown(model, `kept failing to load: ${message}`)
        return { action: 'next', wait: 0 }
      }
      return { action: 'retry', wait: backoffSeconds(count) }
    }
    return { action: 'fail', wait: 0 }
  }

  /** A successful call clears the model's strikes. */
  const recovered = (model: string) => strikes.delete(model)

  /** Wait out an engine restart, telling the user why. */
  async function pause(model: string, seconds: number, signal?: AbortSignal) {
    waiting.value = `${model} is restarting on the server; trying again in ${seconds} s`
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, seconds * 1000)
        signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(signal.reason)
        })
      })
    } finally {
      waiting.value = null
    }
  }

  /**
   * Run `work` with the best model for `task`. An engine that is restarting gets a few retries
   * with growing pauses; a model that cannot work is skipped for the next best one.
   */
  async function attempt<T>(
    task: Task,
    need: Need,
    work: (model: string) => Promise<T>,
    signal?: AbortSignal,
  ) {
    let lastError: unknown = new Error(`No model on the server can do: ${task}`)
    for (let tries = 0; tries < 6; tries++) {
      const model = modelFor(task, need)
      if (!model) break
      try {
        const result = await work(model)
        recovered(model)
        return result
      } catch (e) {
        lastError = e
        if (signal?.aborted) throw e
        const { action, wait } = report(model, e)
        if (action === 'fail') throw e
        if (action === 'retry') await pause(model, wait, signal)
      }
    }
    throw lastError
  }

  /** Resolves once the server's model list has been fetched (or failed) at least once. */
  const loaded = refresh()

  const ready = computed(() => saved.value.baseUrl !== '' && modelFor('write') !== '')

  /** Every task with its current route, for the settings panel. */
  const routes = computed(() => TASKS.map((task) => ({ task, route: pick(task) })))

  return {
    saved,
    models,
    loading,
    error,
    down,
    ready,
    routes,
    refresh,
    loaded,
    pick,
    modelFor,
    maxReferences,
    report,
    recovered,
    pause,
    waiting,
    markDown,
    attempt,
  }
})