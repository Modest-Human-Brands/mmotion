import { useStorage, watchDebounced } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, markRaw, reactive, ref, shallowRef, watch } from 'vue'

import { editComposition, writeStory, type Endpoint } from '@/core/agent'
import {
  cachedIllustration,
  illustrationKey,
  illustrationPrompt,
  illustrationSeed,
  renderIllustration,
} from '@/core/assets/illustrations'
import { fitToVoiceover, mixdown, narrate, type Narration } from '@/core/audio/voiceover'
import { applyOps } from '@/core/composition/ops'
import { compositionSchema, type Composition, type FormatId } from '@/core/composition/schema'
import { sceneSpans, totalFrames } from '@/core/composition/timing'
import { brandFromOrganization, getTemplate, isTemplate } from '@/core/templates'
import { useTimeline } from '@/domain/animation/timeline'
import { loadGoogleFont } from '@/domain/fonts'
import type { ImageState } from '@/render/elements/types'
import type { StageMedia } from '@/render/media'

import { useBrandStore } from './brand'
import { useSettingsStore } from './settings'

export const STEPS = [
  { name: 'template', label: 'Template', path: '/template' },
  { name: 'brand', label: 'Brand', path: '/brand' },
  { name: 'script', label: 'Script', path: '/script' },
  { name: 'studio', label: 'Studio', path: '/studio' },
] as const

export interface Version {
  composition: Composition
  label: string
  at: number
}

export interface ChatEntry {
  role: 'user' | 'assistant'
  text: string
  error?: boolean
}

type Phase = 'idle' | 'writing' | 'voicing' | 'editing'

const MAX_VERSIONS = 50

export const useProjectStore = defineStore('project', () => {
  const brand = useBrandStore()
  const settings = useSettingsStore()

  const draft = useStorage('mmotion.project', {
    templateId: 'soft-explainer',
    format: 'portrait' as FormatId,
    script: '',
    composition: null as Composition | null,
  })

  const restored = compositionSchema.safeParse(draft.value.composition)
  const versions = ref<Version[]>(
    restored.success ? [{ composition: restored.data, label: 'Restored', at: Date.now() }] : [],
  )
  const cursor = ref(versions.value.length - 1)
  const composition = computed(() => versions.value[cursor.value]?.composition ?? null)

  const chat = ref<ChatEntry[]>([])
  const phase = ref<Phase>('idle')
  const progress = ref('')
  const error = ref<string | null>(null)
  let controller: AbortController | null = null

  // Raw so Pinia doesn't unwrap the refs inside it: consumers read `timeline.currentFrame.value`.
  const timeline = markRaw(useTimeline(300, 30))
  const voices = shallowRef(new Map<string, Narration>())
  const mix = shallowRef<AudioBuffer | null>(null)

  const busy = computed(() => phase.value !== 'idle')
  const canUndo = computed(() => cursor.value > 0)
  const canRedo = computed(() => cursor.value < versions.value.length - 1)

  watch(
    composition,
    (current) => {
      draft.value.composition = current
      if (!current) return
      timeline.configure(current.fps, totalFrames(current))
      void loadGoogleFont(current.brand.fontDisplay)
      void loadGoogleFont(current.brand.fontBody)
    },
    { immediate: true },
  )

  function endpoint(): Endpoint {
    controller = new AbortController()
    return {
      baseUrl: settings.saved.baseUrl,
      model: settings.saved.textModel,
      signal: controller.signal,
    }
  }

  function commit(next: Composition, label: string) {
    versions.value = [
      ...versions.value.slice(0, cursor.value + 1),
      { composition: next, label, at: Date.now() },
    ].slice(-MAX_VERSIONS)
    cursor.value = versions.value.length - 1
  }

  /** Replace the current version in place (timing adjustments, not user-visible edits). */
  function amend(next: Composition) {
    const current = versions.value[cursor.value]
    if (!current) return
    versions.value = versions.value.map((version, index) =>
      index === cursor.value ? { ...current, composition: next } : version,
    )
  }

  // ------------------------------------------------------------------ narration

  /** Narrate every scene (cached per text), stretch scenes to fit, and rebuild the audio mix. */
  async function voice() {
    const current = composition.value
    if (!current) return
    const { baseUrl, speechModel, hearingModel } = settings.saved
    const next = new Map<string, Narration>()
    if (speechModel) {
      const narrated = current.scenes.filter((scene) => scene.voiceover.trim() !== '')
      phase.value = 'voicing'
      for (const [index, scene] of narrated.entries()) {
        progress.value = `Recording narration ${index + 1} of ${narrated.length}`
        next.set(
          scene.id,
          await narrate(baseUrl, speechModel, hearingModel, scene.voiceover, controller?.signal),
        )
      }
    }
    voices.value = next
    const fitted = fitToVoiceover(current, next)
    if (JSON.stringify(fitted) !== JSON.stringify(current)) amend(fitted)
    mix.value = await mixdown(fitted, next)
  }

  // --------------------------------------------------------------- illustrations

  /** Picture state per scene id; filled by the background queue, read by the renderer. */
  const images = reactive(new Map<string, ImageState>())
  const sceneKeys = new Map<string, string>()
  const urls = new Map<string, string>()
  const queue: { key: string; prompt: string; seed: number }[] = []
  let pumping = false
  /**
   * The picture being generated right now. A local server typically cannot hold the image model
   * and the writing or speech model at once, so model calls wait for it and the queue pauses
   * while they run; overlapping them stalls both.
   */
  let activeJob: Promise<unknown> | null = null
  const idle = async () => {
    while (busy.value) await new Promise((resolve) => setTimeout(resolve, 400))
  }

  function setState(key: string, state: ImageState) {
    for (const [sceneId, sceneKey] of sceneKeys) if (sceneKey === key) images.set(sceneId, state)
  }

  /** Set when the image server keeps failing; the queue waits for `retryIllustrations`. */
  const imageTrouble = ref<string | null>(null)
  const failedKeys = new Set<string>()

  async function pump() {
    if (pumping || imageTrouble.value) return
    pumping = true
    let failures = 0
    try {
      while (queue.length > 0 && !imageTrouble.value) {
        await idle()
        const job = queue.shift()
        // An edit may have replaced this picture while it waited.
        if (!job || ![...sceneKeys.values()].includes(job.key) || urls.has(job.key)) continue
        setState(job.key, { url: null, status: 'running' })
        try {
          activeJob = renderIllustration(
            settings.saved.baseUrl,
            settings.saved.imageModel,
            job.key,
            job.prompt,
            job.seed,
            // A stuck request must not hold up every edit behind it.
            AbortSignal.timeout(180_000),
          )
          const blob = (await activeJob) as Blob
          urls.set(job.key, URL.createObjectURL(blob))
          setState(job.key, { url: urls.get(job.key)!, status: 'done' })
          failures = 0
        } catch (e) {
          setState(job.key, { url: null, status: 'error' })
          failedKeys.add(job.key)
          // Two failures in a row usually mean the image server itself is unwell (e.g. out of
          // GPU memory); stop instead of failing every remaining picture.
          if (++failures >= 2)
            imageTrouble.value = e instanceof Error ? e.message : 'The image model keeps failing.'
        } finally {
          activeJob = null
        }
      }
    } finally {
      pumping = false
    }
  }

  /** Work out which pictures each scene needs; reuse cached ones and queue the rest. */
  async function syncIllustrations() {
    const current = composition.value
    if (!current) return
    const template = getTemplate(current.templateId)
    const model = settings.saved.imageModel
    const wanted = new Set<string>()
    for (const scene of current.scenes) {
      if (scene.element.kind !== 'illustration' || !scene.element.prompt.trim()) {
        sceneKeys.delete(scene.id)
        images.delete(scene.id)
        continue
      }
      const prompt = illustrationPrompt(template, current.cast, scene.element)
      const seed = illustrationSeed(current.cast, scene.element)
      const key = await illustrationKey(prompt, seed, model || 'none')
      wanted.add(scene.id)
      sceneKeys.set(scene.id, key)
      if (urls.has(key)) {
        images.set(scene.id, { url: urls.get(key)!, status: 'done' })
        continue
      }
      const cached = await cachedIllustration(key)
      if (cached) {
        urls.set(key, URL.createObjectURL(cached))
        images.set(scene.id, { url: urls.get(key)!, status: 'done' })
      } else if (model) {
        if (failedKeys.has(key)) {
          images.set(scene.id, { url: null, status: 'error' })
          continue
        }
        if (!queue.some((job) => job.key === key)) queue.push({ key, prompt, seed })
        if (images.get(scene.id)?.status !== 'running')
          images.set(scene.id, { url: null, status: 'queued' })
      } else images.set(scene.id, { url: null, status: 'idle' })
    }
    for (const sceneId of sceneKeys.keys()) if (!wanted.has(sceneId)) sceneKeys.delete(sceneId)
    void pump()
  }

  watchDebounced(
    () => [JSON.stringify(composition.value), settings.saved.imageModel],
    () => void syncIllustrations(),
    { debounce: 250, immediate: true },
  )

  /** Queue failed pictures again and resume. */
  function retryIllustrations() {
    imageTrouble.value = null
    failedKeys.clear()
    void syncIllustrations()
  }

  const illustrations = computed(() => {
    const states = [...images.values()]
    return {
      total: states.length,
      done: states.filter((state) => state.status === 'done').length,
      failed: states.filter((state) => state.status === 'error').length,
    }
  })

  /** Pictures and word timings for the renderer. */
  const media: StageMedia = {
    image: (scene) => images.get(scene.id) ?? { url: null, status: 'idle' },
    words: (scene) => voices.value.get(scene.id)?.words,
  }

  // --------------------------------------------------------------------- actions

  async function run(work: () => Promise<void>) {
    error.value = null
    try {
      if (activeJob) {
        phase.value = phase.value === 'idle' ? 'editing' : phase.value
        progress.value = 'Finishing the current illustration'
        await activeJob.catch(() => {})
      }
      await work()
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        error.value = e instanceof Error ? e.message : 'Something went wrong.'
      }
    } finally {
      phase.value = 'idle'
      progress.value = ''
      controller = null
    }
  }

  function generate() {
    return run(async () => {
      phase.value = 'writing'
      const template = getTemplate(draft.value.templateId)
      const next = await writeStory(
        endpoint(),
        {
          script: draft.value.script,
          templateId: template.id,
          brand: brandFromOrganization(brand.organization, template),
          format: draft.value.format,
          fps: 30,
        },
        (message) => (progress.value = message),
      )
      chat.value = [
        {
          role: 'assistant',
          text: `Drafted ${next.scenes.length} scenes in ${next.chapters.length} chapters${next.cast.members.length ? ` with ${next.cast.members.map((member) => member.name).join(' and ')}` : ''}. Illustrations render in the background.`,
        },
      ]
      commit(next, 'Generated from script')
      timeline.seek(0)
    }).then(() => {
      // The storyboard is usable now; narration records in the background.
      if (composition.value && !error.value) void run(voice)
    })
  }

  function edit(instruction: string, focusSceneId?: string) {
    const current = composition.value
    if (!current || !instruction.trim()) return Promise.resolve()
    chat.value = [...chat.value, { role: 'user', text: instruction.trim() }]
    return run(async () => {
      phase.value = 'editing'
      progress.value = 'Editing'
      const result = await editComposition(endpoint(), current, instruction, focusSceneId)
      const changed = JSON.stringify(result.composition) !== JSON.stringify(current)
      chat.value = [
        ...chat.value,
        { role: 'assistant', text: result.reply || (changed ? 'Done.' : 'No changes made.') },
        ...(result.errors.length > 0
          ? [
              {
                role: 'assistant' as const,
                text: `Skipped: ${result.errors.join('; ')}`,
                error: true,
              },
            ]
          : []),
      ]
      if (changed) {
        commit(result.composition, instruction.trim())
        await voice()
      }
    })
  }

  /** A new take of a scene's picture, without asking the model. */
  function redraw(sceneId: string) {
    const current = composition.value
    if (!current || busy.value) return
    const result = applyOps(current, [{ op: 'regenerateIllustration', sceneId }], isTemplate)
    if (result.errors.length === 0) commit(result.composition, 'Redrew an illustration')
  }

  function goTo(index: number) {
    const target = Math.min(Math.max(0, index), versions.value.length - 1)
    if (target === cursor.value || busy.value) return
    cursor.value = target
    void run(voice)
  }

  const undo = () => goTo(cursor.value - 1)
  const redo = () => goTo(cursor.value + 1)

  function cancel() {
    controller?.abort()
  }

  function reset() {
    cancel()
    versions.value = []
    cursor.value = -1
    chat.value = []
    voices.value = new Map()
    mix.value = null
    queue.length = 0
  }

  // A restored project has no audio in memory yet; rebuild it (cached voices make this fast).
  if (restored.success) void run(voice)

  /** Start frame of each scene, for timeline ticks and the scene list. */
  const sceneStarts = computed(() =>
    composition.value
      ? sceneSpans(composition.value).map((span) => Math.round(span.start * composition.value!.fps))
      : [],
  )

  return {
    draft,
    versions,
    cursor,
    composition,
    chat,
    phase,
    progress,
    error,
    busy,
    canUndo,
    canRedo,
    timeline,
    voices,
    mix,
    images,
    illustrations,
    imageTrouble,
    retryIllustrations,
    media,
    sceneStarts,
    generate,
    edit,
    redraw,
    voice,
    undo,
    redo,
    goTo,
    cancel,
    reset,
  }
})