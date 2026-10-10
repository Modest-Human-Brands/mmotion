<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { BloomPmndrs, EffectComposerPmndrs } from '@tresjs/post-processing'
import * as THREE from 'three'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  useTemplateRef,
  watch,
  type Component,
} from 'vue'

import type { BloomConfig } from '@/domain/animation/types'
import { authoredFrame, outputFrame, type SceneSettings } from '@templates/motion'

import { provideSceneContext, type TimeSource } from './scene/context'
import { createShaderBackground, isStaticBackground } from './shaderBackground'

const props = withDefaults(
  defineProps<{
    scene: Component
    settings: SceneSettings
    currentFrame: number
    /** Fraction of the output resolution to render at (preview < 1, export up to 1). */
    renderScale?: number
    bloom?: BloomConfig
  }>(),
  { renderScale: 0.5 },
)

const isMobile =
  typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const root = useTemplateRef<HTMLElement>('root')
const renderWidth = computed(() =>
  Math.max(2, Math.round(props.settings.width * props.renderScale)),
)
const renderHeight = computed(() =>
  Math.max(2, Math.round(props.settings.height * props.renderScale)),
)

const keyTracks = reactive(new Map<number, number[]>())
const pending = new Set<Promise<unknown>>()
const timeSources = new Set<TimeSource>()
let nextKeyId = 0

provideSceneContext({
  frame: computed(() => authoredFrame(props.currentFrame, props.settings)),
  seconds: computed(() => props.currentFrame / props.settings.fps),
  screenMedia: computed(() => props.settings.screenMedia),
  chassisColor: computed(() => props.settings.chassisColor),
  cameraFov: computed(() => props.settings.cameraFov),
  cameraDistance: computed(() => props.settings.cameraDistance),
  aspect: computed(() => props.settings.width / props.settings.height),
  isMobile,
  async whenReady() {
    while (pending.size > 0) await Promise.allSettled(pending)
  },
  registerKeys(frames) {
    const id = nextKeyId++
    keyTracks.set(id, frames)
    return () => keyTracks.delete(id)
  },
  track(promise) {
    pending.add(promise)
    void promise.finally(() => pending.delete(promise)).catch(() => {})
  },
  registerTimeSource(source) {
    timeSources.add(source)
    return () => timeSources.delete(source)
  },
})

/** Keyframe positions in output frames, for the timeline. */
const keyframes = computed(() => {
  const frames = new Set<number>()
  for (const list of keyTracks.values()) {
    for (const frame of list) frames.add(Math.round(outputFrame(frame, props.settings)))
  }
  return [...frames].sort((a, b) => a - b)
})

// Sized to the output aspect so it is never stretched (e.g. square templates). This is only the
// fallback size: once the shader runs, the snapshot follows the on-screen GPU canvas.
const BACKGROUND_LONG_SIDE = 640
const aspect = props.settings.width / props.settings.height
const background = createShaderBackground(
  aspect >= 1
    ? { width: BACKGROUND_LONG_SIDE, height: Math.round(BACKGROUND_LONG_SIDE / aspect) }
    : { width: Math.round(BACKGROUND_LONG_SIDE * aspect), height: BACKGROUND_LONG_SIDE },
  props.settings.background,
  () => markBackgroundDirty(),
)
const backgroundTexture = new THREE.CanvasTexture(background.canvas)
backgroundTexture.colorSpace = THREE.SRGBColorSpace

onMounted(() => {
  if (root.value) background.attach(root.value)
})

const animatedBackground = computed(() => !isStaticBackground(props.settings.background))

let textureSizeVersion = 0

function markBackgroundDirty() {
  // A resized source needs fresh GPU storage; WebGL textures cannot grow in place.
  if (background.sizeVersion !== textureSizeVersion) {
    textureSizeVersion = background.sizeVersion
    backgroundTexture.dispose()
  }
  backgroundTexture.needsUpdate = true
}

async function refreshBackground(seconds: number) {
  await background.seek(seconds)
  markBackgroundDirty()
}

watch(
  () => props.settings.background,
  (next) => {
    background.update(next)
    void refreshBackground(props.currentFrame / props.settings.fps)
  },
  { deep: true, immediate: true },
)

let syncing = false
let queued: number | null = null

/** Move everything time-based (animated background, video, Rive) to `frame`. Latest wins. */
async function syncTime(frame: number): Promise<void> {
  if (syncing) {
    queued = frame
    return
  }
  syncing = true
  try {
    let target: number | null = frame
    while (target !== null) {
      queued = null
      const seconds = target / props.settings.fps
      const jobs: Promise<void>[] = [...timeSources].map((source) => source.seek(seconds))
      if (animatedBackground.value) jobs.push(refreshBackground(seconds))
      await Promise.all(jobs)
      target = queued
    }
  } finally {
    syncing = false
  }
}

watch(
  () => props.currentFrame,
  (frame) => {
    if (timeSources.size > 0 || animatedBackground.value) void syncTime(frame)
  },
)

/** Browsers stop animation frames in hidden tabs, so wait for the tab to come back instead of hanging. */
async function nextFrame(): Promise<void> {
  if (document.visibilityState === 'hidden') {
    await new Promise<void>((resolve) => {
      const onChange = () => {
        if (document.visibilityState !== 'visible') return
        document.removeEventListener('visibilitychange', onChange)
        resolve()
      }
      document.addEventListener('visibilitychange', onChange)
    })
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

function getCanvas(): HTMLCanvasElement | null {
  return root.value?.querySelector('canvas') ?? null
}

/** Show exactly `frame`: everything loaded, sources seeked, Vue flushed and the GPU drawn. */
async function renderFrame(frame: number): Promise<void> {
  for (let waited = 0; waited < 120; waited++) {
    const canvas = getCanvas()
    if (canvas && canvas.width === renderWidth.value && canvas.height === renderHeight.value) break
    await nextFrame()
  }
  while (pending.size > 0) await Promise.allSettled(pending)
  await syncTime(frame)
  await nextTick()
  await nextFrame()
  await nextFrame()
}

defineExpose({ getCanvas, renderFrame, keyframes })

onBeforeUnmount(() => {
  background.dispose()
  backgroundTexture.dispose()
})
</script>

<template>
  <div
    ref="root"
    class="relative overflow-hidden"
    :style="{ width: `${renderWidth}px`, height: `${renderHeight}px` }"
  >
    <TresCanvas
      :dpr="1"
      :output-color-space="THREE.SRGBColorSpace"
      :gl="{ preserveDrawingBuffer: true, antialias: true, powerPreference: 'high-performance' }"
    >
      <primitive :object="backgroundTexture" attach="background" />
      <component :is="scene" />
      <EffectComposerPmndrs v-if="bloom && !isMobile">
        <BloomPmndrs
          :intensity="bloom.intensity ?? 0.3"
          :luminance-threshold="bloom.luminanceThreshold ?? 0.95"
          :luminance-smoothing="bloom.luminanceSmoothing ?? 0.2"
          :mipmap-blur="bloom.mipmapBlur ?? true"
        />
      </EffectComposerPmndrs>
    </TresCanvas>
  </div>
</template>