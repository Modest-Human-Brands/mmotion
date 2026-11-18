import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { listModels, type ModelInfo } from '@/core/llm/client'

interface Settings {
  baseUrl: string
  textModel: string
  speechModel: string
  imageModel: string
  hearingModel: string
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = useStorage<Settings>(
    'mmotion.settings',
    {
      baseUrl: 'http://127.0.0.1:8981',
      textModel: '',
      speechModel: '',
      imageModel: '',
      hearingModel: '',
    },
    undefined,
    { mergeDefaults: true },
  )

  const models = ref<ModelInfo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const writers = computed(() => models.value.filter((model) => model.canWrite))
  const speakers = computed(() => models.value.filter((model) => model.canSpeak))
  const painters = computed(() => models.value.filter((model) => model.canDraw))
  const listeners = computed(() => models.value.filter((model) => model.canHear))
  const ready = computed(() => saved.value.baseUrl !== '' && saved.value.textModel !== '')

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      models.value = await listModels(saved.value.baseUrl)
    } catch (e) {
      models.value = []
      error.value =
        e instanceof Error ? `Could not reach ${saved.value.baseUrl}: ${e.message}` : 'Unreachable'
    } finally {
      loading.value = false
    }
  }

  return { saved, models, writers, speakers, painters, listeners, loading, error, ready, refresh }
})