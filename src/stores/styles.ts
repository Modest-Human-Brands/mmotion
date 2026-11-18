import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import { getBlob, hashKey, putBlob } from '@/core/audio/cache'
import { generateImage } from '@/core/llm/client'
import { sampleMedia } from '@/core/samples'
import {
  STYLES,
  THUMBNAIL_SUBJECT,
  getStyle,
  styleLead,
  styleLine,
  type ArtStyle,
} from '@/core/styles'

import { useSettingsStore } from './settings'

const thumbnailKey = (art: ArtStyle) =>
  hashKey('style-thumbnail', art.id, art.prompt, art.avoid, THUMBNAIL_SUBJECT)

/**
 * Style thumbnails: the same subject drawn once in each style, on request, with the model the
 * router would use for that style. Cached on this device, so each is drawn only once.
 */
export const useStylesStore = defineStore('styles', () => {
  const settings = useSettingsStore()
  const thumbnails = reactive(new Map<string, string>())
  /** Styles waiting to be drawn, in order. */
  const queued = reactive(new Set<string>())
  const drawing = ref<string | null>(null)
  const failed = reactive(new Set<string>())

  async function load() {
    for (const art of STYLES) {
      if (thumbnails.has(art.id)) continue
      const blob = await getBlob(await thumbnailKey(art))
      if (blob) thumbnails.set(art.id, URL.createObjectURL(blob))
    }
  }
  void load()

  let running = false
  async function pump() {
    if (running) return
    running = true
    try {
      while (queued.size > 0) {
        const id = queued.values().next().value!
        queued.delete(id)
        if (thumbnails.has(id)) continue
        const art = getStyle(id)
        drawing.value = id
        try {
          const prompt = `${styleLead(art)} ${THUMBNAIL_SUBJECT} ${styleLine(art)} ${
            art.background === 'full-bleed'
              ? 'A complete picture with its own setting, edge to edge.'
              : 'Plain white background.'
          } No text.`
          const blob = await settings.attempt('draw', { prefer: art.best }, (model) =>
            generateImage(settings.saved.baseUrl, model, prompt, {
              size: '512x512',
              seed: 11,
              priority: 'background',
            }),
          )
          await putBlob(await thumbnailKey(art), blob)
          thumbnails.set(id, URL.createObjectURL(blob))
          failed.delete(id)
        } catch {
          failed.add(id)
        }
      }
    } finally {
      drawing.value = null
      running = false
    }
  }

  /** Draw thumbnails for these styles in the background (skips ones already drawn). */
  function request(ids: string[]) {
    for (const id of ids) if (!thumbnails.has(id)) queued.add(id)
    void pump()
  }

  /** Stop drawing the ones not started yet. */
  const cancel = () => queued.clear()

  /** Preview media for a style: its thumbnail once drawn, else a placeholder in its colours. */
  const media = (id: string) => {
    const art = getStyle(id)
    return sampleMedia(art, thumbnails.get(art.id))
  }

  return { thumbnails, queued, drawing, failed, request, cancel, media }
})