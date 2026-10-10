<script setup lang="ts">
import IconDownload from '~icons/lucide/download'
import IconScan from '~icons/lucide/scan'
import IconZoomIn from '~icons/lucide/zoom-in'
import IconZoomOut from '~icons/lucide/zoom-out'

const zoom = defineModel<number>('zoom', { default: 100 })

defineProps<{ downloadDisabled?: boolean; showDownload?: boolean }>()

const emit = defineEmits<{ fit: []; download: [] }>()

const MIN_ZOOM = 25
const MAX_ZOOM = 300
const STEP = 25

const buttonClass =
  'flex size-8 items-center justify-center rounded-full text-light-500 outline-none transition-colors hover:text-white focus-visible:shadow-focus-ring disabled:opacity-40'

function zoomBy(delta: number) {
  zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value + delta))
}
</script>

<template>
  <div
    class="flex items-center gap-1 rounded-full border border-dark-600 bg-dark-400 py-1.5 pr-1.5 pl-2 shadow-toolbar"
    role="toolbar"
    aria-label="Stage tools"
  >
    <button
      type="button"
      :class="buttonClass"
      aria-label="Zoom out"
      :disabled="zoom <= MIN_ZOOM"
      @click="zoomBy(-STEP)"
    >
      <IconZoomOut class="size-4.5 [--icon-stroke:1.5]" aria-hidden="true" />
    </button>
    <span class="w-11 text-center text-xs font-semi-bold text-white" aria-live="polite"
      >{{ zoom }}%</span
    >
    <button
      type="button"
      :class="buttonClass"
      aria-label="Zoom in"
      :disabled="zoom >= MAX_ZOOM"
      @click="zoomBy(STEP)"
    >
      <IconZoomIn class="size-4.5 [--icon-stroke:1.5]" aria-hidden="true" />
    </button>
    <button type="button" :class="buttonClass" aria-label="Fit to screen" @click="emit('fit')">
      <IconScan class="size-4.5 [--icon-stroke:1.5]" aria-hidden="true" />
    </button>
    <template v-if="showDownload">
      <span class="h-5 w-px bg-dark-600" aria-hidden="true" />
      <button
        type="button"
        class="flex size-9 items-center justify-center rounded-full bg-accent-500 text-white outline-none transition-colors hover:bg-accent-400 focus-visible:shadow-focus-ring disabled:bg-dark-600 disabled:text-light-400"
        aria-label="Download"
        :disabled="downloadDisabled"
        @click="emit('download')"
      >
        <IconDownload class="size-4.5 [--icon-stroke:1.5]" aria-hidden="true" />
      </button>
    </template>
  </div>
</template>