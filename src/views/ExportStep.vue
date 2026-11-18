<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import UiButton from '@/components/ui/UiButton.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { FORMATS } from '@/core/composition/schema'
import { totalFrames, totalSeconds } from '@/core/composition/timing'
import { safeFileName, saveBlob } from '@/domain/download'
import { drawElement, prepareFonts } from '@/domain/export/compose'
import { ExportCancelled, exportVideo, type VideoQuality } from '@/domain/export/videoExport'
import VideoPlayer from '@/render/VideoPlayer.vue'
import { usePicturesStore } from '@/stores/pictures'
import { STEPS, stepIndex, useProjectStore } from '@/stores/project'

defineOptions({ name: 'ExportStep' })

type Format = 'mp4' | 'png'

const router = useRouter()
const project = useProjectStore()
// The export mixes the narration; a restored project records (or loads) it first.
onMounted(() => project.ensureVoices())
const player = useTemplateRef<InstanceType<typeof VideoPlayer>>('player')

const FORMAT_OPTIONS: { value: Format; label: string }[] = [
  { value: 'mp4', label: 'Video' },
  { value: 'png', label: 'Still (PNG)' },
]
const SCALES = [
  { value: '1', label: '100%' },
  { value: '0.5', label: '50%' },
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
const lastFile = ref<string | null>(null)
let controller: AbortController | null = null

const pictures = usePicturesStore()
const composition = computed(() => project.composition)
/** The player shows this time while exporting, and the studio's time otherwise. */
const exportSeconds = ref<number | null>(null)
const seconds = computed(
  () => exportSeconds.value ?? project.timeline.currentFrame.value / project.timeline.fps.value,
)

const pendingPictures = computed(
  () => pictures.progress.total - pictures.progress.done - pictures.progress.failed,
)

const size = computed(() => (composition.value ? FORMATS[composition.value.format] : null))
const outputLabel = computed(() => {
  if (!size.value || !composition.value) return ''
  const factor = Number(scale.value)
  const dims = `${Math.round(size.value.width * factor)} × ${Math.round(size.value.height * factor)} px`
  return format.value === 'mp4'
    ? `${dims} · ${totalSeconds(composition.value).toFixed(1)} s at ${composition.value.fps} fps${project.mix ? ' · with voiceover' : ''}`
    : dims
})

async function showFrame(atSeconds: number) {
  exportSeconds.value = atSeconds
  await nextTick()
}

async function download() {
  const current = composition.value
  const stage = player.value?.element()
  if (!current || !stage || !size.value) return
  busy.value = true
  error.value = null
  progress.value = 0
  controller = new AbortController()
  const factor = Number(scale.value)
  const { width, height } = size.value
  const base = safeFileName(fileName.value || current.title, 'motion').replace(
    /\.(mp4|webm|png)$/i,
    '',
  )

  try {
    const fonts = await prepareFonts(stage)
    const draw = async (atSeconds: number, canvas: HTMLCanvasElement) => {
      await showFrame(atSeconds)
      await drawElement(canvas, stage, width, height, fonts)
    }

    if (format.value === 'mp4') {
      const result = await exportVideo({
        width: width * factor,
        height: height * factor,
        fps: current.fps,
        totalFrames: totalFrames(current),
        quality: quality.value,
        audio: project.mix,
        drawFrame: (index, canvas) => draw(index / current.fps, canvas),
        onProgress: (fraction) => (progress.value = Math.round(fraction * 100)),
        signal: controller.signal,
      })
      saveBlob(result.blob, `${base}.${result.extension}`)
      lastFile.value = `${(result.blob.size / 1024 / 1024).toFixed(1)} MB ${result.extension.toUpperCase()}`
    } else {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * factor)
      canvas.height = Math.round(height * factor)
      await draw(seconds.value, canvas)
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Could not encode PNG.'))),
          'image/png',
        ),
      )
      saveBlob(blob, `${base}.png`)
      lastFile.value = `${(blob.size / 1024).toFixed(0)} KB PNG`
    }
  } catch (e) {
    if (!(e instanceof ExportCancelled)) {
      console.error('Export failed', e)
      error.value = e instanceof Error ? e.message : 'Could not render a frame.'
    }
  } finally {
    exportSeconds.value = null
    controller = null
    busy.value = false
  }
}
</script>

<template>
  <WizardShell
    v-if="composition"
    :step="stepIndex('studio')"
    title="Export"
    subtitle="Rendered in your browser. Nothing is uploaded."
  >
    <UiSegmentedControl v-model="format" label="Format" :options="FORMAT_OPTIONS" />
    <UiSegmentedControl v-model="scale" label="Resolution" :options="SCALES" />
    <UiSegmentedControl
      v-if="format === 'mp4'"
      v-model="quality"
      label="Video quality"
      :options="QUALITIES"
    />
    <UiTextField
      v-model="fileName"
      label="File name"
      hint="optional"
      :placeholder="composition.title"
    />

    <p
      v-if="pendingPictures > 0"
      class="rounded-md bg-warning-600/20 px-3 py-2 text-sm text-warning-400"
      role="status"
    >
      {{ pendingPictures }} illustration{{ pendingPictures === 1 ? ' is' : 's are' }} still
      rendering; exporting now shows placeholders for them.
    </p>

    <dl class="flex flex-col rounded-lg border border-dark-600 bg-dark-500 text-sm">
      <div class="flex gap-4 border-b border-dark-600 px-3 py-2.5">
        <dt class="w-24 shrink-0 text-light-400">Output</dt>
        <dd class="text-white">{{ outputLabel }}</dd>
      </div>
      <div class="flex gap-4 px-3 py-2.5">
        <dt class="w-24 shrink-0 text-light-400">Last file</dt>
        <dd class="text-white">{{ lastFile ?? '—' }}</dd>
      </div>
    </dl>

    <div v-if="busy && format === 'mp4'" class="flex flex-col gap-1.5" role="status">
      <div class="h-2 overflow-hidden rounded-full bg-dark-600">
        <div class="h-full bg-accent-500" :style="{ width: `${progress}%` }" />
      </div>
      <p class="text-xs text-light-400">
        Rendering frames… {{ progress }}%. Keep this tab open and visible.
      </p>
    </div>
    <p v-if="error" class="rounded-md bg-alert-600 px-3 py-2 text-sm text-white" role="alert">
      Export failed: {{ error }}
    </p>

    <template #note>{{
      format === 'png' ? 'Exports the frame shown in the preview' : ''
    }}</template>
    <template #actions>
      <UiButton v-if="busy" variant="ghost" @click="controller?.abort()">Cancel</UiButton>
      <UiButton v-else variant="ghost" @click="router.push(STEPS[stepIndex('studio')].path)"
        >Back to studio</UiButton
      >
      <UiButton :disabled="busy" @click="download">
        {{ busy ? 'Rendering…' : format === 'mp4' ? 'Render video' : 'Download PNG' }}
      </UiButton>
    </template>

    <template #preview>
      <VideoPlayer
        ref="player"
        :composition="composition"
        :seconds="seconds"
        :media="pictures.media"
        label="Final preview"
      />
    </template>
  </WizardShell>
</template>