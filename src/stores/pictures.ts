import { watchDebounced } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'

import { compareToReference, type Difference } from '@/core/agent/vision'
import {
  cachedPicture,
  drawPicture,
  restyleJob,
  sceneJob,
  sheetJob,
  type PictureJob,
  type PictureModels,
} from '@/core/assets/illustrations'
import { assetUrl, blobToDataUrl, getAsset, loadedAssetUrl, putAsset } from '@/core/assets/store'
import type { CastMember } from '@/core/composition/schema'
import { Preempted, foregroundPending, typicalSeconds } from '@/core/llm/client'
import { sceneStyle, type ArtStyle } from '@/core/styles'
import type { ImageState } from '@/render/elements/types'
import type { StageMedia } from '@/render/media'

import { useProjectStore } from './project'
import { useSettingsStore } from './settings'

/** A candidate look for a cast member, waiting to be chosen. */
export interface Take {
  asset: string
  url: string
}

export const usePicturesStore = defineStore('pictures', () => {
  const project = useProjectStore()
  const settings = useSettingsStore()

  /** Drawing models for this video, chosen per job type by the router. */
  function modelsFor(art: ArtStyle): PictureModels {
    const need = { ...project.need(), prefer: art.best }
    const reference = settings.modelFor('drawFromRefs', need)
    const restyle = settings.modelFor('restyle', need)
    return {
      image: settings.modelFor('draw', need),
      reference,
      maxReferences: reference ? settings.maxReferences(reference) : 1,
      restyle,
      restyleReferences: restyle ? settings.maxReferences(restyle) : 1,
    }
  }
  /** Drawing models for the video's own style (sheets), chosen by the router. */
  const videoStyle = computed(() => (project.composition ? sceneStyle(project.composition) : null))
  const models = computed<PictureModels>(() =>
    videoStyle.value ? modelsFor(videoStyle.value) : { image: '', reference: '', maxReferences: 1 },
  )

  // ------------------------------------------------------------------ asset urls

  /** Object URLs of every cast asset, loaded ahead so rendering stays synchronous. */
  const assetUrls = reactive(new Map<string, string>())
  async function loadAssets() {
    const members = project.composition?.cast.members ?? []
    const ids = [
      ...members.flatMap((member) => [member.sheet, ...member.refs]),
      ...(project.draft.source?.cast.flatMap((member) => member.refs) ?? []),
    ].filter(Boolean)
    for (const id of ids) {
      if (assetUrls.has(id)) continue
      const url = loadedAssetUrl(id) ?? (await assetUrl(id))
      if (url) assetUrls.set(id, url)
    }
  }
  watchDebounced(
    () => JSON.stringify([project.composition?.cast, project.draft.source?.cast]),
    () => void loadAssets(),
    { debounce: 100, immediate: true },
  )

  async function addAsset(blob: Blob): Promise<string> {
    const id = await putAsset(blob)
    assetUrls.set(id, loadedAssetUrl(id) ?? (await assetUrl(id)) ?? '')
    return id
  }

  // --------------------------------------------------------------- scene pictures

  /** Picture state per scene id; filled by the background queue, read by the renderer. */
  const images = reactive(new Map<string, ImageState>())
  const sceneKeys = new Map<string, string>()
  const urls = new Map<string, string>()
  const queue: PictureJob[] = []
  let pumping = false
  let lastModel = ''

  /** Set when the image server keeps failing; the queue waits for `retry`. */
  const trouble = ref<string | null>(null)
  const failedKeys = new Set<string>()
  /** Pictures that ran out of time once. */
  const timedOut = new Set<string>()
  /** Seconds a picture may run: three times the model's measured time, at least five minutes. */
  const pictureTimeout = (model: string) =>
    Math.max(300, 3 * (typicalSeconds(model) ?? 0) + 60) * 1000
  /** Pictures in full-bleed styles, shown framed instead of blended into the scene colour. */
  const framed = new Set<string>()

  function setState(key: string, state: ImageState) {
    for (const [sceneId, sceneKey] of sceneKeys)
      if (sceneKey === key) images.set(sceneId, { ...state, framed: framed.has(key) })
  }

  /**
   * Scene pictures wait while sheets are being redrawn: they would be drawn from the old sheets
   * and thrown away, and switching between the sheet model and the scene model between members
   * reloads a large model each time.
   */
  const sheetWork = ref(0)
  async function holdScenes<T>(work: () => Promise<T>): Promise<T> {
    sheetWork.value++
    try {
      return await work()
    } finally {
      sheetWork.value--
    }
  }

  /** Background work waits while the user is waiting on something else. */
  const quiet = async () => {
    while (project.busy || foregroundPending() || sheetWork.value > 0)
      await new Promise((resolve) => setTimeout(resolve, 400))
  }

  async function pump() {
    if (pumping || trouble.value) return
    pumping = true
    let failures = 0
    try {
      while (queue.length > 0 && !trouble.value) {
        await quiet()
        // Draw everything the loaded image model has queued before switching models.
        const same = queue.findIndex((item) => item.model === lastModel)
        const [job] = queue.splice(same === -1 ? 0 : same, 1)
        if (job) lastModel = job.model
        // An edit may have replaced this picture while it waited.
        if (!job || ![...sceneKeys.values()].includes(job.key) || urls.has(job.key)) continue
        setState(job.key, { url: null, status: 'running' })
        try {
          const blob = await drawPicture(settings.saved.baseUrl, job, {
            // A stuck request must not hold up every edit behind it; slow models get longer.
            timeout: pictureTimeout(job.model),
            priority: 'background',
          })
          urls.set(job.key, URL.createObjectURL(blob))
          setState(job.key, { url: urls.get(job.key)!, status: 'done' })
          settings.recovered(job.model)
          failures = 0
        } catch (e) {
          // Interrupted for something the user is waiting on: try again later.
          if (e instanceof Preempted) {
            queue.unshift(job)
            setState(job.key, { url: null, status: 'queued' })
            continue
          }
          const message = e instanceof Error ? e.message : String(e)
          // Ran out of time: the server is busy (it keeps working on requests the browser gave
          // up on), not broken. Try once more at the back of the queue; never skip the model.
          if (e instanceof DOMException && e.name === 'TimeoutError') {
            if (!timedOut.has(job.key)) {
              timedOut.add(job.key)
              queue.push(job)
              setState(job.key, { url: null, status: 'queued' })
            } else {
              setState(job.key, { url: null, status: 'error' })
              failedKeys.add(job.key)
            }
            continue
          }
          const { action, wait } = settings.report(job.model, e)
          // The engine is restarting: put the picture back and try again after a pause.
          if (action === 'retry') {
            queue.unshift(job)
            setState(job.key, { url: null, status: 'queued' })
            await settings.pause(job.model, wait)
            continue
          }
          // The model cannot work, or two pictures in a row failed on it: skip it for the session
          // and plan every waiting picture again on the next model.
          const unusable =
            action === 'next' ||
            (++failures >= 2 && settings.markDown(job.model, `failed twice: ${message}`))
          if (unusable) {
            failures = 0
            failedKeys.clear()
            setState(job.key, { url: null, status: 'queued' })
            queue.length = 0
            void sync()
            continue
          }
          setState(job.key, { url: null, status: 'error' })
          failedKeys.add(job.key)
        }
      }
    } finally {
      pumping = false
    }
  }

  /** Work out which pictures each scene needs; reuse cached ones and queue the rest. */
  async function sync() {
    const current = project.composition
    // Pictures are drawn from approved sheets, so nothing is drawn before the cast is approved.
    if (!current || !project.draft.approved.cast) return
    const wanted = new Set<string>()
    for (const scene of current.scenes) {
      const art = sceneStyle(current, scene)
      const job =
        scene.element.kind === 'illustration' && scene.element.prompt.trim()
          ? await sceneJob(art, current, scene.element, modelsFor(art))
          : null
      if (!job) {
        sceneKeys.delete(scene.id)
        if (scene.element.kind === 'illustration')
          images.set(scene.id, { url: null, status: 'idle' })
        else images.delete(scene.id)
        continue
      }
      wanted.add(scene.id)
      sceneKeys.set(scene.id, job.key)
      if (art.background === 'full-bleed') framed.add(job.key)
      const show = (state: ImageState) =>
        images.set(scene.id, { ...state, framed: framed.has(job.key) })
      if (urls.has(job.key)) {
        show({ url: urls.get(job.key)!, status: 'done' })
        continue
      }
      const cached = await cachedPicture(job.key)
      if (cached) {
        urls.set(job.key, URL.createObjectURL(cached))
        show({ url: urls.get(job.key)!, status: 'done' })
      } else if (failedKeys.has(job.key)) {
        show({ url: null, status: 'error' })
      } else {
        if (!queue.some((item) => item.key === job.key)) queue.push(job)
        if (images.get(scene.id)?.status !== 'running') show({ url: null, status: 'queued' })
      }
    }
    for (const sceneId of sceneKeys.keys()) if (!wanted.has(sceneId)) sceneKeys.delete(sceneId)
    // Scenes that no longer exist (removed, or a new story) leave no picture state behind.
    const present = new Set(current.scenes.map((scene) => scene.id))
    for (const sceneId of images.keys()) if (!present.has(sceneId)) images.delete(sceneId)
    void pump()
  }

  watchDebounced(
    () => [
      JSON.stringify(project.composition),
      project.draft.approved.cast,
      JSON.stringify(models.value),
      [...settings.down.keys()].join(),
    ],
    () => void sync(),
    { debounce: 250, immediate: true },
  )

  function retry() {
    trouble.value = null
    failedKeys.clear()
    timedOut.clear()
    void sync()
  }

  const progress = computed(() => {
    const states = [...images.values()]
    return {
      total: states.length,
      done: states.filter((state) => state.status === 'done').length,
      failed: states.filter((state) => state.status === 'error').length,
    }
  })

  /** Pictures and word timings for the renderer. */
  const media: StageMedia = {
    image: (scene) => {
      if (
        scene.element.kind === 'showcase' ||
        (scene.element.kind === 'logoReveal' && scene.element.cast.length > 0)
      ) {
        const member = project.composition?.cast.members.find(
          (item) => item.name === scene.element.cast[0],
        )
        const id = member?.sheet || member?.refs[0] || ''
        const url = id ? (assetUrls.get(id) ?? null) : null
        return { url, status: url ? 'done' : 'idle' }
      }
      return images.get(scene.id) ?? { url: null, status: 'idle' }
    },
    words: (scene) => project.voices.get(scene.id)?.words,
  }

  // ------------------------------------------------------------------- the cast

  /** Candidate looks per member name, newest first. */
  const takes = reactive(new Map<string, Take[]>())
  const drawing = ref<string | null>(null)

  async function keepTake(name: string, blob: Blob) {
    const asset = await addAsset(blob)
    const list = takes.get(name) ?? []
    takes.set(name, [
      { asset, url: assetUrls.get(asset)! },
      ...list.filter((t) => t.asset !== asset),
    ])
    return asset
  }

  /** Shown when a take had to be drawn from the description instead of the references. */
  const notice = ref<string | null>(null)

  async function drawTakes(
    name: string,
    jobs: (PictureJob | null)[],
    fallbacks: (PictureJob | null)[] = [],
    /** The same take planned again after a model was marked down (routes change). */
    replan?: (index: number) => Promise<PictureJob | null>,
  ) {
    notice.value = null
    const valid = jobs.filter((job): job is PictureJob => !!job)
    if (valid.length === 0) {
      project.error =
        'Choose an illustration model (and a consistent-pictures model to use references).'
      return
    }
    drawing.value = name
    await project.run(async () => {
      project.phase = 'drawing'
      for (const [index, job] of valid.entries()) {
        project.progress = `Drawing ${name} (${index + 1} of ${valid.length})`
        const signal = project.endpoint().signal
        let blob: Blob
        let current = job
        try {
          blob = await drawPicture(settings.saved.baseUrl, current, { signal })
        } catch (e) {
          if (signal?.aborted) throw e
          const { action, wait } = settings.report(current.model, e)
          // The engine is restarting: wait, then the retry below uses the same model again.
          if (action === 'retry') await settings.pause(current.model, wait, signal)
          // A model that cannot work is skipped for the session; plan the take on the next one.
          const replanned = action === 'next' && replan ? await replan(index) : null
          if (replanned) {
            current = replanned
            project.progress = `Drawing ${name} with ${current.model}`
          }
          // Image servers sometimes return nothing for one seed; another seed usually works,
          // and as a last resort the description alone.
          project.progress = `Drawing ${name} again`
          try {
            blob = await drawPicture(
              settings.saved.baseUrl,
              replanned ?? { ...current, seed: current.seed + 1, key: `${current.key}:retry` },
              { signal },
            )
          } catch (again) {
            const fallback = fallbacks[index]
            if (signal?.aborted || !fallback) throw again
            project.progress = `Drawing ${name} from the description`
            blob = await drawPicture(settings.saved.baseUrl, fallback, { signal })
            notice.value = `${name} could not be drawn from the references, so this take follows the description only. Check it against the references.`
          }
        }
        await keepTake(name, blob)
      }
    })
    drawing.value = null
  }

  /** Draw `count` candidate sheets for a member. The first one becomes the sheet if it has none. */
  async function drawSheets(member: CastMember, count = 1) {
    const current = project.composition
    if (!current) return
    const art = sceneStyle(current)
    const offset = takes.get(member.name)?.length ?? 0
    const jobs = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        sheetJob(art, current, member, models.value, offset + index),
      ),
    )
    const textOnly = { ...models.value, reference: '' }
    const fallbacks = member.refs.length
      ? await Promise.all(
          Array.from({ length: count }, (_, index) =>
            sheetJob(art, current, member, textOnly, offset + index),
          ),
        )
      : []
    await drawTakes(member.name, jobs, fallbacks, (index) =>
      sheetJob(art, current, member, models.value, offset + index),
    )
    const first = takes.get(member.name)?.[0]
    if (first && !member.sheet) chooseSheet(member.name, first.asset)
  }

  function chooseSheet(name: string, asset: string) {
    const current = project.composition
    const sheetStyle = current ? sceneStyle(current).id : ''
    project.updateMember(name, { sheet: asset, sheetStyle }, `New look for ${name}`)
  }

  /** Members whose sheet was drawn in another style than the video's current one. */
  const staleSheets = computed(() => {
    const current = project.composition
    if (!current) return []
    const style = sceneStyle(current).id
    return current.cast.members.filter(
      (member) =>
        member.sheet &&
        !member.exact &&
        member.look !== 'source' &&
        member.sheetStyle &&
        member.sheetStyle !== style,
    )
  })

  /** Redraw stale sheets in the current style from their references or old sheet. */
  async function redrawStale() {
    await holdScenes(async () => {
      for (const member of staleSheets.value) {
        if (member.locked) continue
        await drawSheets(member)
        const first = takes.get(member.name)?.[0]
        if (first) chooseSheet(member.name, first.asset)
      }
    })
  }

  /** Exact objects use their reference as the sheet: never redrawn. */
  function useReferenceAsSheet(member: CastMember) {
    if (member.refs[0]) project.updateMember(member.name, { sheet: member.refs[0], exact: true })
  }

  async function addReference(member: CastMember, file: Blob) {
    const asset = await addAsset(file)
    project.updateMember(member.name, { refs: [asset, ...member.refs].slice(0, 4) })
  }

  /** Differences between a member's sheet and a reference the user likes. */
  async function compare(
    member: CastMember,
    file: Blob,
  ): Promise<{ asset: string; differences: Difference[] } | null> {
    const visionModel = settings.modelFor('see')
    if (!visionModel) {
      project.error = 'The server has no model that can compare pictures.'
      return null
    }
    const sheet = await getAsset(member.sheet)
    if (!sheet) {
      project.error = `Draw ${member.name} first.`
      return null
    }
    const asset = await addAsset(file)
    let differences: Difference[] = []
    await project.run(async () => {
      project.phase = 'drawing'
      project.progress = `Comparing ${member.name} with the reference`
      differences = await compareToReference(
        project.endpoint(visionModel),
        await blobToDataUrl(sheet),
        await blobToDataUrl(file),
        member.name,
      )
    })
    return { asset, differences }
  }

  /** Redraw a member with the chosen differences carried over from the reference. */
  async function restyle(member: CastMember, reference: string, changes: string[], count = 1) {
    const jobs = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        restyleJob(
          member,
          reference,
          changes,
          models.value,
          (takes.get(member.name)?.length ?? 0) + index,
        ),
      ),
    )
    await drawTakes(member.name, jobs, [], (index) =>
      restyleJob(
        member,
        reference,
        changes,
        models.value,
        (takes.get(member.name)?.length ?? 0) + index,
      ),
    )
  }

  return {
    assetUrls,
    addAsset,
    images,
    progress,
    trouble,
    retry,
    media,
    takes,
    drawing,
    notice,
    drawSheets,
    chooseSheet,
    staleSheets,
    redrawStale,
    holdScenes,
    models,
    useReferenceAsSheet,
    addReference,
    compare,
    restyle,
  }
})