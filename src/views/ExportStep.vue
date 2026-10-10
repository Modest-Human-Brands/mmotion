<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import StageViewport from '@/components/studio/StageViewport.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { safeFileName, saveBlob } from '@/domain/download'
import { composeFrame, prepareOverlay } from '@/domain/export/compose'
import { ExportCancelled, exportVideo, type VideoQuality } from '@/domain/export/videoExport'
import { STEPS, useMotionWizardStore } from '@/stores/motionWizard'

defineOptions({ name: 'ExportStep' })

type Format = 'mp4' | 'png' | 'webp' | 'jpeg'

const router = useRouter()
const wizard = useMotionWizardStore()
const stage = useTemplateRef<InstanceType<typeof StageViewport>>('stage')

const FORMATS: { value: Format; label: string }[] = [
  { value: 'mp4', label: 'Video' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
  { value: 'jpeg', label: 'JPEG' },
]
const SCALES = [
  { value: '1', label: '100%' },
  { value: '0.5', label: '50%' },
  { value: '0.25', label: '25%' },
]
const QUALITIES: { value: VideoQuality; label: string }[] = [
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'very-high', label: 'Very high' },
]

const format = ref<Format>('mp4')
const scale = ref('0.5')
const quality = ref<VideoQuality>('high')
const fileName = ref('')
const busy = ref(false)
const progress = ref(0)
const error = ref<string | null>(null)
const lastSize = ref<string | null>(null)
let controller: AbortController | null = null

const template = computed(() => wizard.template)
const settings = computed(() => wizard.settings)
const label = computed(() => template.value?.label ?? 'Design')
const defaultName = computed(() => template.value?.id ?? 'motion')
const isVideo = computed(() => format.value === 'mp4')

const outputSize = computed(() => {
  const output = settings.value
  if (!output) return ''
  const factor = Number(scale.value)
  return `${Math.round(output.width * factor)} × ${Math.round(output.height * factor)} px`
})
const durationLabel = computed(() => {
  const output = settings.value
  if (!output) return ''
  const seconds = output.durationFrames / output.fps
  return `${seconds.toFixed(1)} s · ${output.durationFrames} frames at ${output.fps} fps`
})

const MIME = { png: 'image/png', webp: 'image/webp', jpeg: 'image/jpeg' } as const

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Your browser cannot encode this image.')),
      type,
      0.95,
    ),
  )
}

async function download() {
  const active = stage.value
  if (!active || !settings.value) return
  busy.value = true
  error.value = null
  progress.value = 0
  controller = new AbortController()

  const factor = Number(scale.value)
  const startFrame = wizard.timeline.currentFrame.value
  const base = safeFileName(fileName.value || defaultName.value, 'motion').replace(
    /\.(mp4|webm|png|webp|jpe?g)$/i,
    '',
  )

  try {
    await active.beginExport(factor)
    const info = active.info()
    const width = Math.round(info.width * factor)
    const height = Math.round(info.height * factor)
    const overlay = active.getOverlayElement()
    const fontEmbedCSS = await prepareOverlay(overlay)

    const draw = async (frame: number, canvas: HTMLCanvasElement) => {
      await active.renderFrame(frame)
      const source = active.getCanvas()
      if (!source) throw new Error('The 3D scene is not ready yet.')
      await composeFrame(canvas, {
        width: canvas.width,
        height: canvas.height,
        designWidth: info.width,
        designHeight: info.height,
        scene: source,
        overlay,
        fontEmbedCSS,
      })
    }

    if (isVideo.value) {
      const result = await exportVideo({
        width,
        height,
        fps: info.fps,
        totalFrames: info.durationFrames,
        quality: quality.value,
        drawFrame: draw,
        onProgress: (fraction) => (progress.value = Math.round(fraction * 100)),
        signal: controller.signal,
      })
      saveBlob(result.blob, `${base}.${result.extension}`)
      lastSize.value = `${(result.blob.size / 1024 / 1024).toFixed(1)} MB`
    } else {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      if (format.value === 'jpeg') {
        const context = canvas.getContext('2d')!
        context.fillStyle = '#000000'
        context.fillRect(0, 0, width, height)
      }
      await draw(startFrame, canvas)
      const type = MIME[format.value as keyof typeof MIME]
      const blob = await toBlob(canvas, type)
      saveBlob(blob, `${base}.${format.value === 'jpeg' ? 'jpg' : format.value}`)
      lastSize.value = `${(blob.size / 1024).toFixed(0)} KB`
    }
    progress.value = 100
  } catch (e) {
    if (!(e instanceof ExportCancelled)) {
      console.error('Export failed', e)
      error.value = describeError(e)
    }
  } finally {
    await active.endExport()
    wizard.timeline.seek(startFrame)
    controller = null
    busy.value = false
  }
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message
  // html-to-image rejects with the failing image's error Event
  if (e instanceof Event)
    return 'Could not render the title overlay. Try removing the logo or title.'
  return 'Export failed.'
}

function cancel() {
  controller?.abort()
}
</script>

<template>
  <WizardShell
    :step="3"
    title="Export your motion"
    subtitle="Rendered in your browser. Nothing is uploaded."
  >
    <UiSegmentedControl v-model="format" label="Format" :options="FORMATS" />
    <UiSegmentedControl v-model="scale" label="Resolution" :options="SCALES" />
    <UiSegmentedControl
      v-if="isVideo"
      v-model="quality"
      label="Video quality"
      :options="QUALITIES"
    />
    <UiTextField v-model="fileName" label="File name" hint="optional" :placeholder="defaultName" />

    <dl class="flex flex-col rounded-lg border border-dark-600 bg-dark-500">
      <div class="flex gap-4 border-b border-dark-600 px-3 py-2.5">
        <dt class="w-28 shrink-0 text-sm text-light-400">Template</dt>
        <dd class="text-sm text-white">{{ label }}</dd>
      </div>
      <div class="flex gap-4 border-b border-dark-600 px-3 py-2.5">
        <dt class="w-28 shrink-0 text-sm text-light-400">Output size</dt>
        <dd class="text-sm text-white">{{ outputSize }}</dd>
      </div>
      <div v-if="isVideo" class="flex gap-4 border-b border-dark-600 px-3 py-2.5">
        <dt class="w-28 shrink-0 text-sm text-light-400">Length</dt>
        <dd class="text-sm text-white">{{ durationLabel }}</dd>
      </div>
      <div class="flex gap-4 px-3 py-2.5">
        <dt class="w-28 shrink-0 text-sm text-light-400">Last file</dt>
        <dd class="text-sm text-white">{{ lastSize ?? '—' }}</dd>
      </div>
    </dl>

    <div v-if="busy && isVideo" class="flex flex-col gap-1.5" role="status">
      <div class="h-2 overflow-hidden rounded-full bg-dark-600">
        <div
          class="h-full bg-accent-500 transition-[width] duration-100 ease-linear"
          :style="{ width: `${progress}%` }"
        />
      </div>
      <p class="text-xs text-light-400">
        Rendering frames… {{ progress }}%. Keep this tab open and visible until it finishes.
      </p>
    </div>

    <p v-if="error" class="rounded-md bg-alert-600 px-3 py-2 text-sm text-white" role="alert">
      Export failed: {{ error }}
    </p>

    <template #note>{{ `${label} ready to export` }}</template>
    <template #actions>
      <UiButton v-if="!busy" variant="ghost" @click="router.push(STEPS[2].path)">Back</UiButton>
      <UiButton v-else variant="ghost" @click="cancel">Cancel</UiButton>
      <UiButton :disabled="busy || !template" @click="download">{{
        busy ? 'Rendering…' : isVideo ? 'Render video' : `Download ${format.toUpperCase()}`
      }}</UiButton>
    </template>

    <template #preview>
      <StageViewport
        ref="stage"
        :label="`Final preview · ${label}`"
        show-download
        :download-disabled="busy"
        @download="download"
      />
    </template>
  </WizardShell>
</template>