<script setup lang="ts">
import { onMounted } from 'vue'

import UiTextField from '@/components/ui/UiTextField.vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

onMounted(() => {
  if (settings.models.length === 0) void settings.refresh()
})

const selectClass =
  'h-9.5 w-full rounded-md border border-dark-600 bg-dark-500 px-2 text-sm text-white outline-none focus:border-accent-400'
</script>

<template>
  <section class="flex flex-col gap-3 rounded-lg border border-dark-600 p-3" aria-label="Models">
    <div class="flex items-end gap-2">
      <UiTextField
        v-model="settings.saved.baseUrl"
        class="flex-1"
        label="Model server"
        hint="OpenAI-compatible"
        @change="settings.refresh()"
      />
      <button
        type="button"
        class="h-9.5 rounded-md border border-dark-600 px-3 text-xs font-semi-bold text-white hover:border-light-400"
        :disabled="settings.loading"
        @click="settings.refresh()"
      >
        {{ settings.loading ? 'Loading…' : 'Reload' }}
      </button>
    </div>
    <p v-if="settings.error" class="text-xs text-alert-400" role="alert">{{ settings.error }}</p>
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1.5 text-sm font-semi-bold text-light-600">
        Writing
        <select v-model="settings.saved.textModel" :class="selectClass">
          <option value="" disabled>Choose a model</option>
          <option v-for="model in settings.writers" :key="model.id" :value="model.id">
            {{ model.id }}{{ model.local ? '' : ' (remote)' }}
          </option>
        </select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm font-semi-bold text-light-600">
        Illustrations
        <select v-model="settings.saved.imageModel" :class="selectClass">
          <option value="">No illustrations</option>
          <option v-for="model in settings.painters" :key="model.id" :value="model.id">
            {{ model.id }}
          </option>
        </select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm font-semi-bold text-light-600">
        Narration
        <select v-model="settings.saved.speechModel" :class="selectClass">
          <option value="">No voiceover</option>
          <option v-for="model in settings.speakers" :key="model.id" :value="model.id">
            {{ model.id }}
          </option>
        </select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm font-semi-bold text-light-600">
        Word timing
        <select v-model="settings.saved.hearingModel" :class="selectClass">
          <option value="">Even spacing</option>
          <option v-for="model in settings.listeners" :key="model.id" :value="model.id">
            {{ model.id }}
          </option>
        </select>
      </label>
    </div>
  </section>
</template>