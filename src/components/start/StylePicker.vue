<script setup lang="ts">
import { computed, ref } from 'vue'

import { STYLE_FAMILIES, STYLES, getStyle, type StyleFamily } from '@/core/styles'
import { useSettingsStore } from '@/stores/settings'
import { useStylesStore } from '@/stores/styles'

const props = defineProps<{
  /** Selected style id; "" = inherit (only when `inherit` is given). */
  modelValue: string
  /** Label of the "" option, e.g. "Same as the video (Watercolour)". Omit to hide it. */
  inherit?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [id: string] }>()

const settings = useSettingsStore()
const styles = useStylesStore()

const family = ref<StyleFamily>(
  props.modelValue ? getStyle(props.modelValue).family : STYLE_FAMILIES[0].id,
)
const shown = computed(() => STYLES.filter((style) => style.family === family.value))
const missing = computed(() => shown.value.filter((style) => !styles.thumbnails.has(style.id)))
const canDraw = computed(() => !!settings.modelFor('draw'))

const swatch = (id: string) => {
  const [a, b] = getStyle(id).swatch
  return { background: `linear-gradient(135deg, ${a}, ${b})` }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap gap-1" role="tablist" aria-label="Style families">
      <button
        v-for="item in STYLE_FAMILIES"
        :key="item.id"
        type="button"
        role="tab"
        :aria-selected="family === item.id"
        class="rounded-full border px-2.5 py-1 text-xs"
        :class="
          family === item.id
            ? 'border-accent-400 bg-dark-500 text-white'
            : 'border-dark-600 text-light-400 hover:text-white'
        "
        @click="family = item.id"
      >
        {{ item.name }}
      </button>
    </div>

    <div class="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Art style">
      <button
        v-if="inherit !== undefined"
        type="button"
        role="radio"
        :aria-checked="modelValue === ''"
        :disabled="disabled"
        class="flex flex-col gap-1 rounded-md border p-1 text-left"
        :class="modelValue === '' ? 'border-accent-400' : 'border-dark-600 hover:border-light-400'"
        @click="emit('update:modelValue', '')"
      >
        <span
          class="flex aspect-square w-full items-center justify-center rounded-sm bg-dark-600 text-2xs text-light-400"
          >Inherit</span
        >
        <span class="truncate text-2xs text-light-500">{{ inherit }}</span>
      </button>
      <button
        v-for="style in shown"
        :key="style.id"
        type="button"
        role="radio"
        :aria-checked="modelValue === style.id"
        :disabled="disabled"
        :title="style.prompt"
        class="flex flex-col gap-1 rounded-md border p-1 text-left"
        :class="
          modelValue === style.id ? 'border-accent-400' : 'border-dark-600 hover:border-light-400'
        "
        @click="emit('update:modelValue', style.id)"
      >
        <span class="relative block aspect-square w-full overflow-hidden rounded-sm bg-white">
          <img
            v-if="styles.thumbnails.get(style.id)"
            :src="styles.thumbnails.get(style.id)"
            alt=""
            class="size-full object-cover"
          />
          <span v-else class="block size-full opacity-80" :style="swatch(style.id)" />
          <span
            v-if="styles.drawing === style.id"
            class="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-2xs text-white"
            >Drawing…</span
          >
          <span
            v-else-if="styles.queued.has(style.id)"
            class="absolute inset-x-0 bottom-0 bg-black/40 py-0.5 text-center text-2xs text-white"
            >Queued</span
          >
        </span>
        <span class="truncate text-2xs text-light-500">{{ style.name }}</span>
      </button>
    </div>

    <div v-if="missing.length" class="flex items-center gap-2 text-2xs text-light-400">
      <button
        type="button"
        class="rounded border border-dark-600 px-2 py-0.5 hover:text-white disabled:opacity-50"
        :disabled="!canDraw || missing.every((style) => styles.queued.has(style.id))"
        @click="styles.request(missing.map((style) => style.id))"
      >
        Draw previews ({{ missing.length }})
      </button>
      <span>{{
        canDraw
          ? 'One small picture per style, drawn once and kept on this device.'
          : 'No picture model on the server.'
      }}</span>
    </div>
  </div>
</template>