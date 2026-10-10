<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from 'vue'

import { useMotionWizardStore } from '@/stores/motionWizard'

import SceneStage from './SceneStage.vue'
import StageToolbar from './StageToolbar.vue'
import TimelinePanel from './TimelinePanel.vue'

const props = defineProps<{
  label: string
  showDownload?: boolean
  sample?: boolean
  downloadDisabled?: boolean
}>()

const emit = defineEmits<{ download: [] }>()

const wizard = useMotionWizardStore()
const stage = useTemplateRef<HTMLElement>('stage')
const sceneRef = useTemplateRef<InstanceType<typeof SceneStage>>('stageScene')
const overlayRef = useTemplateRef<HTMLElement>('overlay')
const { width: stageWidth, height: stageHeight } = useElementSize(stage)

const template = computed(() => wizard.template)
const settings = computed(() => (props.sample ? wizard.sampleSettings : wizard.settings))
const overlayProps = computed(() =>
  props.sample ? wizard.sampleOverlayProps : wizard.overlayProps,
)
const timeline = wizard.timeline

const output = computed(() => ({
  width: settings.value?.width ?? 1920,
  height: settings.value?.height ?? 1080,
}))
const fps = computed(() => settings.value?.fps ?? 60)

const PADDING = 48
const PREVIEW_WIDTH = 1280
const zoom = ref(100)

const fitScale = computed(() => {
  const availableWidth = Math.max(120, stageWidth.value - PADDING * 2)
  const availableHeight = Math.max(120, stageHeight.value - PADDING * 2)
  return Math.min(availableWidth / output.value.width, availableHeight / output.value.height)
})
const displayScale = computed(() => fitScale.value * (zoom.value / 100))

/** Fraction of the output resolution rendered while editing; raised to the export size on demand. */
const exportScale = ref<number | null>(null)
// Preview renders at the displayed size (sharp on HiDPI, capped) rather than a fixed resolution.
const pixelRatio = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
const renderScale = computed(
  () =>
    exportScale.value ??
    Math.min(1, PREVIEW_WIDTH / output.value.width, displayScale.value * pixelRatio),
)

watch(
  () => wizard.templateId,
  () => (zoom.value = 100),
)

// The WebGL scene only lives while this step is on screen, so kept-alive steps don't each hold a GPU context.
const active = ref(false)

function activate() {
  active.value = true
  timeline.start()
  timeline.play()
}

onMounted(() => {
  activate()
  window.addEventListener('keydown', onKeydown)
})
onActivated(activate)
onDeactivated(() => {
  active.value = false
  timeline.pause()
  timeline.stop()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)
}

function onKeydown(event: KeyboardEvent) {
  if (!active.value || !settings.value || typing(event.target) || timeline.locked.value) return
  const step = event.shiftKey ? 10 : 1
  if (event.code === 'Space') {
    event.preventDefault()
    timeline.toggle()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    timeline.pause()
    timeline.seek(timeline.currentFrame.value + step)
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    timeline.pause()
    timeline.seek(timeline.currentFrame.value - step)
  }
}

defineExpose({
  /** Raise the render resolution to `scale` of the output size and freeze playback. */
  async beginExport(scale: number) {
    timeline.pause()
    timeline.locked.value = true
    exportScale.value = scale
    await nextTick()
  },
  async endExport() {
    exportScale.value = null
    timeline.locked.value = false
    await nextTick()
  },
  async renderFrame(frame: number) {
    timeline.seek(frame)
    await nextTick()
    await sceneRef.value?.renderFrame(frame)
  },
  getCanvas: () => sceneRef.value?.getCanvas() ?? null,
  getOverlayElement: () => overlayRef.value,
  info: () => ({
    width: output.value.width,
    height: output.value.height,
    fps: fps.value,
    durationFrames: timeline.durationFrames.value,
  }),
})
</script>

<template>
  <section
    class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-dark-500"
    :aria-label="label"
  >
    <p class="px-5 pt-4 text-xs text-light-400">
      {{ label
      }}<span v-if="template"> · {{ output.width }} × {{ output.height }} px · {{ fps }} fps</span>
    </p>

    <div class="relative flex min-h-0 flex-1 flex-col">
      <div ref="stage" class="no-scrollbar relative flex min-h-0 flex-1 overflow-auto p-12">
        <div
          v-if="settings && active"
          class="relative m-auto shrink-0 overflow-hidden bg-black shadow-doc-page"
          :style="{
            width: `${output.width * displayScale}px`,
            height: `${output.height * displayScale}px`,
          }"
        >
          <div
            class="origin-top-left"
            :style="{
              width: `${Math.round(output.width * renderScale)}px`,
              height: `${Math.round(output.height * renderScale)}px`,
              transform: `scale(${displayScale / renderScale})`,
            }"
          >
            <SceneStage
              v-if="template"
              ref="stageScene"
              :key="template.id"
              :scene="template.scene"
              :settings="settings"
              :bloom="template.bloom"
              :current-frame="timeline.currentFrame.value"
              :render-scale="renderScale"
            />
          </div>

          <div
            v-if="template?.overlay && overlayProps"
            ref="overlay"
            class="pointer-events-none absolute top-0 left-0 origin-top-left"
            :style="{
              width: `${output.width}px`,
              height: `${output.height}px`,
              transform: `scale(${displayScale})`,
            }"
          >
            <component
              :is="template.overlay.component"
              v-bind="overlayProps"
              :current-frame="timeline.currentFrame.value"
              :fps="fps"
            />
          </div>
        </div>
        <p v-else-if="!template" class="m-auto text-sm text-light-400">
          Select a template to begin.
        </p>
      </div>

      <StageToolbar
        v-if="template"
        v-model:zoom="zoom"
        class="absolute bottom-4 left-1/2 -translate-x-1/2"
        :show-download="showDownload"
        :download-disabled="downloadDisabled"
        @fit="zoom = 100"
        @download="emit('download')"
      />
    </div>

    <TimelinePanel
      v-if="settings && active"
      :timeline="timeline"
      :keyframes="sceneRef?.keyframes ?? []"
      :disabled="timeline.locked.value"
    />
  </section>
</template>