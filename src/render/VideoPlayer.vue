<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import { FORMATS, type Composition } from '@/core/composition/schema'

import type { StageMedia } from './media'
import VideoStage from './VideoStage.vue'

const props = withDefaults(
  defineProps<{
    composition: Composition
    seconds: number
    media?: StageMedia
    label?: string
    padding?: number
  }>(),
  { label: '', padding: 32 },
)

const box = useTemplateRef<HTMLElement>('box')
const stage = useTemplateRef<InstanceType<typeof VideoStage>>('stage')
const { width, height } = useElementSize(box)

const size = computed(() => FORMATS[props.composition.format])
const scale = computed(() =>
  Math.max(
    0.05,
    Math.min(
      (width.value - props.padding * 2) / size.value.width,
      (height.value - props.padding * 2) / size.value.height,
    ),
  ),
)

defineExpose({ element: () => stage.value?.element() ?? null })
</script>

<template>
  <section
    class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-dark-500"
    :aria-label="label || 'Video preview'"
  >
    <p v-if="label" class="px-5 pt-4 text-xs text-light-400">
      {{ label }} · {{ size.width }} × {{ size.height }}
    </p>
    <div ref="box" class="relative flex min-h-0 flex-1">
      <div
        class="m-auto shrink-0 overflow-hidden shadow-doc-page"
        :style="{ width: `${size.width * scale}px`, height: `${size.height * scale}px` }"
      >
        <div class="origin-top-left" :style="{ transform: `scale(${scale})` }">
          <VideoStage ref="stage" :composition="composition" :seconds="seconds" :media="media" />
        </div>
      </div>
    </div>
    <slot />
  </section>
</template>