import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef, watch } from 'vue'

import {
  directScenes,
  editComposition,
  writeOutline,
  type Brief,
  type Endpoint,
} from '@/core/agent'
import { blobToDataUrl, getAsset } from '@/core/assets/store'
import {
  fitToVoiceover,
  mixdown,
  narrate,
  type ClonedVoice,
  type Narration,
} from '@/core/audio/voiceover'
import { applyOps } from '@/core/composition/ops'
import {
  castMemberSchema,
  compositionSchema,
  spokenWords,
  type CastMember,
  type Composition,
  type FormatId,
  type Voice,
} from '@/core/composition/schema'
import { sceneSpans, totalFrames } from '@/core/composition/timing'
import { brandFromOrganization, getTemplate, isTemplate } from '@/core/templates'
import { useTimeline } from '@/domain/animation/timeline'
import { loadGoogleFont } from '@/domain/fonts'

import { blocksToScript, parseScript, type Block } from '@/core/blocks'
import { getKind } from '@/core/kinds'
import { isStyle } from '@/core/styles'
import { profile } from '@/core/models/catalog'

import { useBrandStore } from './brand'
import { useSettingsStore } from './settings'

/**
 * The flow. Each stage after Source is a checkpoint: it runs only the next cheap step and waits for
 * the user to approve it before the more expensive ones start.
 */
export const STEPS = [
  { name: 'template', label: 'Start', path: '/template' },
  { name: 'brand', label: 'Brand', path: '/brand' },
  { name: 'source', label: 'Source', path: '/source' },
  { name: 'story', label: 'Story', path: '/story' },
  { name: 'cast', label: 'Cast', path: '/cast' },
  { name: 'storyboard', label: 'Storyboard', path: '/storyboard' },
  { name: 'studio', label: 'Studio', path: '/studio' },
] as const
export type StepName = (typeof STEPS)[number]['name']
export const stepIndex = (name: StepName) => STEPS.findIndex((step) => step.name === name)

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

type Phase =
  | 'idle'
  | 'starting'
  | 'analyzing'
  | 'writing'
  | 'directing'
  | 'voicing'
  | 'editing'
  | 'drawing'

/** What the source step found in a video, kept until the story is written from it. */
export interface SourceNotes {
  videoName: string
  title: string
  purpose: string
  suggestedTemplate: string
  suggestedKind?: string
  cast: CastMember[]
  /** Narration clip from the video, offered as the voice to clone. */
  voiceSample: string
  voiceSampleText: string
}

const MAX_VERSIONS = 50

export const useProjectStore = defineStore('project', () => {
  const brand = useBrandStore()
  const settings = useSettingsStore()

  const draft = useStorage(
    'mmotion.project',
    {
      /** Kind of video, look (stored as templateId) and art style ("" = the look's). */
      kindId: 'explainer',
      templateId: 'soft-explainer',
      styleId: '',
      format: 'portrait' as FormatId,
      /** Goal, audience, tone, call to action and target length. */
      brief: { goal: '', audience: '', tone: '', cta: '', length: 60 } as Brief,
      /** The story builder's scene blocks. */
      blocks: [] as Block[],
      /** Before blocks: one script text. Read once into blocks. */
      script: '',
      keepWording: true,
      /** Language of the next video. */
      language: 'en',
      /** Asked for every video before the story is written; null = not answered yet. */
      commercial: null as boolean | null,
      source: null as SourceNotes | null,
      composition: null as Composition | null,
      /** Stages the user has approved; later stages only run after earlier ones. */
      approved: { story: false, cast: false, storyboard: false },
      /** Scenes the direction pass has seen (new or rewritten scenes need it again). */
      directed: [] as string[],
    },
    undefined,
    { mergeDefaults: true },
  )

  // Drafts saved before the story builder had one script text.
  if (draft.value.blocks.length === 0 && draft.value.script.trim()) {
    draft.value.blocks = parseScript(draft.value.script)
    draft.value.script = ''
  }

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

  /** Scenes added or rewritten since the last direction pass. */
  const undirected = computed(() => {
    const seen = new Set(draft.value.directed)
    return composition.value?.scenes.filter((scene) => !seen.has(scene.id)) ?? []
  })

  /** The furthest step the user may open. */
  const reachable = computed<StepName>(() => {
    const { approved } = draft.value
    if (!composition.value) return 'source'
    if (!approved.story) return 'story'
    if (!approved.cast) return 'cast'
    if (!approved.storyboard) return 'storyboard'
    return 'studio'
  })

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

  function endpoint(model = settings.modelFor('write')): Endpoint {
    controller = new AbortController()
    return { baseUrl: settings.saved.baseUrl, model, signal: controller.signal }
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

  async function run(work: () => Promise<void>) {
    error.value = null
    // Busy at once, so a second caller in the same tick sees it and does not start the same work.
    if (phase.value === 'idle') phase.value = 'starting'
    try {
      // Routing needs the server's model list.
      await settings.loaded
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

  // ------------------------------------------------------------------ narration

  /** The sample to clone, when cloning is asked for and a model may do it for this video. */
  async function clonedVoice(voice: Voice): Promise<ClonedVoice | undefined> {
    if (voice.mode !== 'clone' || !voice.sample) return undefined
    if (!settings.modelFor('clone', need())) return undefined
    const blob = await getAsset(voice.sample)
    if (!blob) return undefined
    return {
      id: voice.sample,
      sample: { audio: await blobToDataUrl(blob), text: voice.sampleText },
    }
  }

  /** What the router needs to know about this video. */
  const need = (current: Composition | null = composition.value) => ({
    language: current?.language ?? draft.value.language,
    commercial: current?.commercial ?? draft.value.commercial ?? false,
  })

  /** One narration line with the routed speech model; falls back when a model is broken. */
  async function line(
    current: Composition,
    scene: { voiceover: string; voiceTake?: number },
    timed: boolean,
    cloned: ClonedVoice | undefined,
  ): Promise<Narration> {
    const task = cloned ? 'clone' : 'speak'
    const hearingModel = timed ? settings.modelFor('time', need(current)) : ''
    return settings.attempt(task, need(current), (speechModel) =>
      narrate({
        baseUrl: settings.saved.baseUrl,
        speechModel,
        hearingModel,
        text: scene.voiceover,
        language: current.language,
        keepTags: !!profile(speechModel)?.tags,
        take: scene.voiceTake ?? 0,
        voice: cloned,
        signal: controller?.signal,
      }),
    )
  }

  /** Narrate every scene (cached per text, voice and take), stretch scenes to fit, rebuild the mix. */
  async function voice() {
    const current = composition.value
    if (!current) return
    const next = new Map<string, Narration>()
    const cloned = await clonedVoice(current.voice)
    if (settings.modelFor(cloned ? 'clone' : 'speak', need(current))) {
      const narrated = current.scenes.filter((scene) => spokenWords(scene.voiceover) !== '')
      phase.value = 'voicing'
      // Record every line first, then time the words: alternating the speech and transcription
      // models per line makes a local server swap models every few seconds.
      for (const [index, scene] of narrated.entries()) {
        progress.value = `Recording narration ${index + 1} of ${narrated.length}`
        next.set(scene.id, await line(current, scene, false, cloned))
      }
      if (settings.modelFor('time', need(current)))
        for (const [index, scene] of narrated.entries()) {
          progress.value = `Timing words ${index + 1} of ${narrated.length}`
          next.set(scene.id, await line(current, scene, true, cloned))
        }
    }
    voices.value = next
    const fitted = fitToVoiceover(current, next, getKind(current.kindId).sceneSeconds[0])
    if (JSON.stringify(fitted) !== JSON.stringify(current)) amend(fitted)
    mix.value = await mixdown(fitted, next)
  }

  /** Record one scene's narration again (new take) and rebuild the mix. */
  function retake(sceneId: string) {
    change('New narration take', (next) => {
      const scene = next.scenes.find((item) => item.id === sceneId)
      if (scene) scene.voiceTake += 1
    })
    return run(voice)
  }

  /** One line in the chosen voice, to hear it before the whole story is recorded. */
  async function previewVoice(text: string): Promise<AudioBuffer | null> {
    const current = composition.value
    if (!current) return null
    let result: AudioBuffer | null = null
    await run(async () => {
      phase.value = 'voicing'
      progress.value = 'Recording a sample line'
      endpoint()
      const narration = await line(
        current,
        { voiceover: text },
        false,
        await clonedVoice(current.voice),
      )
      result = narration.buffer
    })
    return result
  }

  // ---------------------------------------------------------------------- stages

  /** Source → Story: write chapters, cast and narration only. */
  function writeStory() {
    return run(async () => {
      phase.value = 'writing'
      const template = getTemplate(draft.value.templateId)
      const next = await settings.attempt('write', need(null), (model) =>
        writeOutline(
          endpoint(model),
          {
            script: blocksToScript(draft.value.blocks),
            templateId: template.id,
            kindId: draft.value.kindId,
            styleId: draft.value.styleId,
            brief: draft.value.brief,
            brand: brandFromOrganization(brand.organization, template),
            format: draft.value.format,
            fps: 30,
            cast: draft.value.source?.cast,
            language: draft.value.language,
            commercial: draft.value.commercial ?? false,
          },
          (message) => (progress.value = message),
        ),
      )
      const sample = draft.value.source?.voiceSample
      if (sample)
        next.voice = { mode: 'default', sample, sampleText: draft.value.source!.voiceSampleText }
      chat.value = []
      versions.value = []
      cursor.value = -1
      commit(next, 'Story written')
      draft.value.approved = { story: false, cast: false, storyboard: false }
      draft.value.directed = []
      voices.value = new Map()
      mix.value = null
      timeline.seek(0)
    })
  }

  // -------------------------------------------------------------- kind, look, style

  /** A new kind of video starts from that kind's look, art style, format and length. */
  function chooseKind(id: string) {
    const kind = getKind(id)
    draft.value.kindId = kind.id
    draft.value.templateId = kind.look
    draft.value.styleId = kind.style
    draft.value.format = kind.format
    draft.value.brief = { ...draft.value.brief, length: kind.lengths[0] ?? 0 }
  }

  /** Art style the next video starts with. */
  const draftStyle = computed(
    () => draft.value.styleId || getTemplate(draft.value.templateId).style,
  )

  /**
   * Change the art style of the whole video, a chapter or a scene ("" = inherit). Pictures redraw
   * from the cast sheets; sheets themselves are redrawn on request (Cast step).
   */
  function setStyle(styleId: string, targetId: string | null = null) {
    const current = composition.value
    if (!current) {
      draft.value.styleId = styleId
      return
    }
    const result = applyOps(current, [{ op: 'setStyle', styleId, targetId }], isTemplate, isStyle)
    if (result.errors.length) error.value = result.errors.join('; ')
    else {
      commit(result.composition, 'Changed the art style')
      if (targetId === null) draft.value.styleId = styleId
    }
  }

  function approve(stage: 'story' | 'cast' | 'storyboard') {
    draft.value.approved = { ...draft.value.approved, [stage]: true }
  }

  /** Storyboard: choose and fill a visual for every scene not directed yet. */
  function direct(force = false) {
    const current = composition.value
    if (!current) return Promise.resolve()
    const ids = (force ? current.scenes : undirected.value).map((scene) => scene.id)
    if (ids.length === 0) return Promise.resolve()
    return run(async () => {
      phase.value = 'directing'
      const next = await settings.attempt('write', need(current), (model) =>
        directScenes(endpoint(model), current, ids, (message) => (progress.value = message)),
      )
      commit(next, force ? 'Storyboard redone' : 'Storyboard')
      draft.value.directed = [...new Set([...draft.value.directed, ...ids])]
    })
  }

  /** Approve the storyboard: record narration, then the studio has the full video. */
  function finish() {
    approve('storyboard')
    return run(voice)
  }

  // ----------------------------------------------------------------------- edits

  function edit(instruction: string, focusSceneId?: string) {
    const current = composition.value
    if (!current || !instruction.trim()) return Promise.resolve()
    chat.value = [...chat.value, { role: 'user', text: instruction.trim() }]
    return run(async () => {
      phase.value = 'editing'
      progress.value = 'Editing'
      const result = await settings.attempt('write', need(current), (model) =>
        editComposition(endpoint(model), current, instruction, focusSceneId),
      )
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
      if (!changed) return
      commit(result.composition, instruction.trim())
      // Rewritten scenes need a visual again once the storyboard stage is reached.
      const before = new Map(current.scenes.map((scene) => [scene.id, scene]))
      const rewritten = new Set(
        result.composition.scenes
          .filter((scene) => {
            const old = before.get(scene.id)
            return !old || (old.brief !== scene.brief && scene.element.kind === old.element.kind)
          })
          .map((scene) => scene.id),
      )
      draft.value.directed = draft.value.directed.filter((id) => !rewritten.has(id))
      if (draft.value.approved.storyboard) await voice()
    })
  }

  /** A direct change made in the UI (inline text edits, cast cards, voice). */
  function change(label: string, update: (draft: Composition) => void) {
    const current = composition.value
    if (!current) return
    const next = JSON.parse(JSON.stringify(current)) as Composition
    update(next)
    const parsed = compositionSchema.safeParse(next)
    if (parsed.success) commit(parsed.data, label)
    else error.value = parsed.error.issues[0]?.message ?? 'That change is not valid.'
  }

  function updateMember(name: string, patch: Partial<CastMember>, label = `Updated ${name}`) {
    change(label, (next) => {
      const member = next.cast.members.find((item) => item.name === name)
      if (!member) return
      Object.assign(member, patch)
      // Renaming keeps scene references in step.
      if (patch.name && patch.name !== name)
        for (const scene of next.scenes)
          scene.element.cast = scene.element.cast.map((item) =>
            item === name ? patch.name! : item,
          )
    })
  }

  function addMember(kind: CastMember['kind']) {
    change('Added to cast', (next) => {
      const base = kind === 'object' ? 'Object' : 'Character'
      let n = next.cast.members.length + 1
      while (next.cast.members.some((member) => member.name === `${base} ${n}`)) n++
      next.cast.members.push(
        castMemberSchema.parse({ name: `${base} ${n}`, description: '', kind }),
      )
    })
  }

  function removeMember(name: string) {
    change(`Removed ${name}`, (next) => {
      next.cast.members = next.cast.members.filter((member) => member.name !== name)
      for (const scene of next.scenes)
        scene.element.cast = scene.element.cast.filter((item) => item !== name)
    })
  }

  function setVoice(patch: Partial<Voice>) {
    change('Narrator voice', (next) => {
      next.voice = { ...next.voice, ...patch }
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
    if (draft.value.approved.storyboard) void run(voice)
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
    draft.value.source = null
    draft.value.commercial = null
    draft.value.approved = { story: false, cast: false, storyboard: false }
    draft.value.directed = []
  }

  /**
   * A restored project has no audio in memory yet; rebuild it when the cut is opened (cached
   * voices make this fast). Not on start-up: a cache miss would block every other model call.
   */
  function ensureVoices() {
    if (draft.value.approved.storyboard && voices.value.size === 0 && !busy.value) void run(voice)
  }

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
    sceneStarts,
    undirected,
    reachable,
    endpoint,
    run,
    commit,
    change,
    writeStory,
    approve,
    chooseKind,
    draftStyle,
    setStyle,
    direct,
    finish,
    edit,
    updateMember,
    addMember,
    removeMember,
    setVoice,
    previewVoice,
    retake,
    need,
    redraw,
    voice,
    ensureVoices,
    undo,
    redo,
    goTo,
    cancel,
    reset,
  }
})