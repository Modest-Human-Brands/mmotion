<script setup lang="ts">
import IconPause from '~icons/lucide/pause'
import IconPlay from '~icons/lucide/play'
import IconRotateCcw from '~icons/lucide/rotate-ccw'
import { computed } from 'vue'

import type { Timeline } from '@/domain/animation/timeline'

const props = defineProps<{
  timeline: Timeline
  /** Keyframe positions in output frames. */
  keyframes: number[]
  disabled?: boolean
}>()

const last = computed(() => Math.max(1, props.timeline.durationFrames.value - 1))
const percent = (frame: number) => `${Math.min(100, Math.max(0, (frame / last.value) * 100))}%`

function seekFromPointer(event: PointerEvent, rail: HTMLElement) {
  const rect = rail.getBoundingClientRect()
  const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
  props.timeline.seek((x / rect.width) * last.value)
}

function onScrub(event: PointerEvent) {
  if (props.disabled) return
  const rail = event.currentTarget as HTMLElement
  const wasPlaying = props.timeline.isPlaying.value
  props.timeline.pause()
  rail.setPointerCapture(event.pointerId)
  seekFromPointer(event, rail)
  const move = (e: PointerEvent) => seekFromPointer(e, rail)
  const up = () => {
    rail.removeEventListener('pointermove', move)
    rail.removeEventListener('pointerup', up)
    rail.removeEventListener('pointercancel', up)
    if (wasPlaying) props.timeline.play()
  }
  rail.addEventListener('pointermove', move)
  rail.addEventListener('pointerup', up)
  rail.addEventListener('pointercancel', up)
}

const buttonClass =
  'flex size-8 shrink-0 items-center justify-center rounded-full text-light-500 outline-none transition-colors hover:text-white focus-visible:shadow-focus-ring disabled:opacity-40'
</script>

<template>
  <div class="flex items-center gap-3 border-t border-dark-600 bg-dark-400 px-4 py-2.5 select-none">
    <button
      type="button"
      :class="buttonClass"
      :aria-label="timeline.isPlaying.value ? 'Pause' : 'Play'"
      :disabled="disabled"
      @click="timeline.toggle()"
    >
      <IconPause
        v-if="timeline.isPlaying.value"
        class="size-4.5 [--icon-stroke:1.5]"
        aria-hidden="true"
      />
      <IconPlay v-else class="size-4.5 [--icon-stroke:1.5]" aria-hidden="true" />
    </button>
    <button
      type="button"
      :class="buttonClass"
      aria-label="Back to start"
      :disabled="disabled"
      @click="timeline.seek(0)"
    >
      <IconRotateCcw class="size-4.5 [--icon-stroke:1.5]" aria-hidden="true" />
    </button>

    <span class="w-24 shrink-0 text-xs font-semi-bold text-white tabular-nums">
      {{ timeline.currentTimeSec.value }}s
      <span class="text-light-400">/ {{ timeline.totalTimeSec.value }}s</span>
    </span>

    <div
      class="group relative flex h-8 flex-1 cursor-pointer touch-none items-center"
      role="slider"
      aria-label="Timeline"
      :aria-valuemin="0"
      :aria-valuemax="last"
      :aria-valuenow="timeline.currentFrame.value"
      @pointerdown="onScrub"
    >
      <div class="relative h-1.5 w-full rounded-full bg-dark-600">
        <div
          class="absolute inset-y-0 left-0 rounded-full bg-accent-500"
          :style="{ width: percent(timeline.currentFrame.value) }"
        />
        <span
          v-for="frame in keyframes"
          :key="frame"
          class="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-light-400"
          :style="{ left: percent(frame) }"
        />
      </div>
      <span
        class="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent-500 shadow transition-transform group-hover:scale-110"
        :style="{ left: percent(timeline.currentFrame.value) }"
      />
    </div>

    <span class="w-28 shrink-0 text-right text-xs text-light-400 tabular-nums">
      {{ timeline.currentFrame.value + 1 }} / {{ timeline.durationFrames.value }} ·
      {{ timeline.fps.value }} fps
    </span>
  </div>
</template>