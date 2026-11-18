<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'

import { FORMATS, type Composition, type Scene, type TransitionId } from '@/core/composition/schema'
import {
  activeSpans,
  beatTimes,
  sceneSpans,
  transitionLength,
  type SceneSpan,
} from '@/core/composition/timing'
import { chapterPalette, getTemplate } from '@/core/templates'
import { loadGoogleFont } from '@/domain/fonts'

import type { TimedBeat } from './beats'
import { NO_MEDIA, type StageMedia } from './media'
import SceneView from './SceneView.vue'
import { stageFonts, stageVars } from './theme'

const props = withDefaults(
  defineProps<{ composition: Composition; seconds: number; media?: StageMedia }>(),
  { media: () => NO_MEDIA },
)

const root = useTemplateRef<HTMLElement>('root')
defineExpose({ element: () => root.value })

const size = computed(() => FORMATS[props.composition.format])
const template = computed(() => getTemplate(props.composition.templateId))
const vars = computed(() =>
  stageVars(template.value, props.composition.brand, props.composition.language),
)

// Fonts load on demand; the loader skips families it already has.
watch(
  () => stageFonts(props.composition.brand, props.composition.language),
  (families) => families.forEach((family) => void loadGoogleFont(family)),
  { immediate: true },
)
const spans = computed(() => sceneSpans(props.composition))
const visible = computed(() => activeSpans(spans.value, props.seconds))

const chapterIndex = computed(
  () => new Map(props.composition.chapters.map((chapter, index) => [chapter.id, index])),
)

function chapterOf(scene: Scene) {
  const index = chapterIndex.value.get(scene.chapterId) ?? 0
  const chapter = props.composition.chapters[index]!
  return {
    chapter,
    palette: chapterPalette(template.value, props.composition.brand, chapter, index),
  }
}

function timedBeats(scene: Scene): TimedBeat[] {
  const times = beatTimes(scene, props.media.words(scene))
  return scene.beats.map((beat, index) => ({ ...beat, time: times[index] ?? 0 }))
}

const easeOut = (t: number) => 1 - (1 - t) ** 3

/** How the entering scene covers the previous one; pure function of progress. */
function enterStyle(transition: TransitionId, progress: number): Record<string, string> {
  const p = easeOut(Math.min(1, Math.max(0, progress)))
  switch (transition) {
    case 'fade':
      return { opacity: String(p) }
    case 'slide':
      return { transform: `translateX(${(1 - p) * 100}%)` }
    case 'wipe':
      return { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }
    case 'zoom':
      return { opacity: String(p), transform: `scale(${1.12 - 0.12 * p})` }
    default:
      return {}
  }
}

function layerStyle(span: SceneSpan): Record<string, string> {
  const length = transitionLength(span.scene, span.index)
  if (visible.value.length < 2 || length === 0 || span !== visible.value.at(-1)) return {}
  return enterStyle(span.scene.transition, (props.seconds - span.start) / length)
}

// Remount a scene when anything that shapes its enter motion changes, so its timeline rebuilds.
const sceneKey = (span: SceneSpan) =>
  `${span.scene.id}:${props.composition.templateId}:${JSON.stringify(span.scene.chrome)}:${span.scene.element.kind}:${span.scene.element.items.length}`
</script>

<template>
  <div
    ref="root"
    class="mm-stage relative overflow-hidden bg-white"
    :style="{
      ...vars,
      width: `${size.width}px`,
      height: `${size.height}px`,
      containerType: 'size',
    }"
  >
    <div
      v-for="span in visible"
      :key="sceneKey(span)"
      class="absolute inset-0"
      :style="layerStyle(span)"
    >
      <SceneView
        :scene="span.scene"
        v-bind="chapterOf(span.scene)"
        :template="template"
        :brand="composition.brand"
        :beats="timedBeats(span.scene)"
        :image="media.image(span.scene)"
        :seconds="seconds"
        :local="Math.max(0, seconds - span.start)"
      />
    </div>
  </div>
</template>