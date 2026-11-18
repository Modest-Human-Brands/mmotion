<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'

import type { Composition } from '@/core/composition/schema'
import { totalFrames } from '@/core/composition/timing'
import { useTimeline } from '@/domain/animation/timeline'

import type { StageMedia } from './media'
import VideoPlayer from './VideoPlayer.vue'

const props = defineProps<{ composition: Composition; media?: StageMedia; label?: string }>()

// Previews loop on their own clock, independent of the project timeline.
const timeline = useTimeline(totalFrames(props.composition), props.composition.fps)
watch(
  () => totalFrames(props.composition),
  (frames) => timeline.configure(props.composition.fps, frames),
)
const seconds = computed(() => timeline.currentFrame.value / timeline.fps.value)

onMounted(() => {
  timeline.start()
  timeline.play()
})
onBeforeUnmount(timeline.stop)
</script>

<template>
  <VideoPlayer :composition="composition" :seconds="seconds" :media="media" :label="label" />
</template>