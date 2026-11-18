<script setup lang="ts">
import { computed, onActivated, onDeactivated, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import NarrationPanel from '@/components/studio/NarrationPanel.vue'
import PromptBox from '@/components/studio/PromptBox.vue'
import SceneList from '@/components/studio/SceneList.vue'
import StyleControl from '@/components/studio/StyleControl.vue'
import TimelinePanel from '@/components/studio/TimelinePanel.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { createPlayback } from '@/core/audio/voiceover'
import { activeSpans, sceneSpans } from '@/core/composition/timing'
import VideoPlayer from '@/render/VideoPlayer.vue'
import { usePicturesStore } from '@/stores/pictures'
import { STEPS, stepIndex, useProjectStore } from '@/stores/project'

defineOptions({ name: 'StudioStep' })

const route = useRoute()
const router = useRouter()
const project = useProjectStore()
const pictures = usePicturesStore()
const timeline = project.timeline

/** The same workspace serves two checkpoints: the storyboard (no narration yet) and the final cut. */
const storyboard = computed(() => route.name === 'storyboard')
const focusSceneId = ref<string | null>(null)
/** Studio side panel: the scene list or the narration editor. */
const panel = ref<'scenes' | 'narration'>('scenes')

const suggestions = computed(() =>
  storyboard.value
    ? [
        'Make this scene a diagram instead',
        'Use more pictures of the cast',
        'Add a checklist recap before the closing chapter',
        'In this picture they should be sitting together',
      ]
    : [
        'Make the headlines shorter',
        'Make this scene a diagram instead',
        'Switch to the Bold editorial look',
        'Draw the pictures in watercolour',
        'Make the characters smile more',
      ],
)

const seconds = computed(() => timeline.currentFrame.value / timeline.fps.value)
const spans = computed(() => (project.composition ? sceneSpans(project.composition) : []))
const currentSceneId = computed(() => activeSpans(spans.value, seconds.value).at(-1)?.scene.id)
const pending = computed(() => new Set(project.undirected.map((scene) => scene.id)))

function selectScene(id: string) {
  const span = spans.value.find((item) => item.scene.id === id)
  focusSceneId.value = focusSceneId.value === id ? null : id
  if (span && project.composition) {
    timeline.pause()
    timeline.seek(Math.round((span.start + 0.6) * project.composition.fps))
  }
}

async function send(text: string) {
  await project.edit(text, focusSceneId.value ?? undefined)
  // New or rewritten scenes get their visual straight away on the storyboard.
  if (storyboard.value && project.undirected.length > 0) await project.direct()
}

async function approve() {
  await project.finish()
  if (!project.error) await router.push(STEPS[stepIndex('studio')].path)
}

// Voiceover follows the clock: restart on play, seek, loop or a new mix; stop on pause.
const playback = createPlayback()
function syncAudio() {
  if (!storyboard.value && timeline.isPlaying.value && project.mix)
    playback.play(project.mix, seconds.value)
  else playback.stop()
}
watch(() => timeline.isPlaying.value, syncAudio)
watch(() => project.mix, syncAudio)
watch(
  () => timeline.currentFrame.value,
  (frame, previous) => {
    // A jump (scrub or loop) rather than steady playback.
    if (timeline.isPlaying.value && (frame < previous || frame - previous > timeline.fps.value / 2))
      syncAudio()
  },
)

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)
}

/** Space plays/pauses; arrows step one frame (Shift: ten). */
function onShortcut(event: KeyboardEvent) {
  if (typing(event.target) || timeline.locked.value) return
  const step = event.shiftKey ? 10 : 1
  if (event.code === 'Space') {
    event.preventDefault()
    timeline.toggle()
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault()
    timeline.pause()
    timeline.seek(timeline.currentFrame.value + (event.key === 'ArrowRight' ? step : -step))
  }
}

function activate() {
  timeline.start()
  window.addEventListener('keydown', onShortcut)
  // Entering the storyboard directs whatever has no visual yet.
  if (storyboard.value && !project.busy && project.undirected.length > 0) void project.direct()
  if (!storyboard.value) project.ensureVoices()
}
// Kept alive (App.vue), so this also runs on the first mount; onMounted as well would run it twice.
onActivated(activate)
onDeactivated(() => {
  window.removeEventListener('keydown', onShortcut)
  timeline.pause()
  timeline.stop()
  playback.stop()
})

const focusedIllustration = computed(() => {
  const scene = project.composition?.scenes.find((item) => item.id === focusSceneId.value)
  return scene?.element.kind === 'illustration' ? scene : null
})
</script>

<template>
  <WizardShell
    v-if="project.composition"
    :step="stepIndex(storyboard ? 'storyboard' : 'studio')"
    :title="storyboard ? 'Storyboard' : project.composition.title"
    :subtitle="
      storyboard
        ? 'One visual per scene, reacting to the narration. Pictures are drawn from the approved cast while you review. Ask for changes, then approve to record the narration.'
        : 'Describe a change. Only what you ask for is edited; every version is kept.'
    "
  >
    <PromptBox :suggestions="suggestions" :focused="!!focusSceneId" @send="send" />

    <UiSegmentedControl
      v-if="!storyboard"
      v-model="panel"
      :options="[
        { value: 'scenes', label: 'Scenes' },
        { value: 'narration', label: 'Narration' },
      ]"
    />
    <NarrationPanel v-if="!storyboard && panel === 'narration'" @select="selectScene" />
    <section v-else class="flex flex-col gap-1.5" aria-label="Scenes">
      <div class="flex items-center justify-between">
        <h3 class="text-xs tracking-[0.06em] text-light-400 uppercase">
          Scenes<span v-if="focusSceneId"> · editing the selected scene</span>
        </h3>
        <span v-if="pictures.progress.total" class="text-xs text-light-400" role="status">
          Pictures {{ pictures.progress.done }}/{{ pictures.progress.total }}
          <span v-if="pictures.progress.failed" class="text-alert-400">
            · {{ pictures.progress.failed }} failed</span
          >
          <button
            v-if="pictures.progress.failed || pictures.trouble"
            type="button"
            class="ml-1 underline hover:text-white"
            :title="pictures.trouble ?? undefined"
            @click="pictures.retry()"
          >
            Retry
          </button>
        </span>
      </div>
      <SceneList
        :composition="project.composition"
        :focus-id="focusSceneId"
        :current-id="currentSceneId"
        :images="pictures.images"
        :pending="pending"
        @select="selectScene"
      />
      <button
        v-if="focusedIllustration"
        type="button"
        class="self-start rounded-md border border-dark-600 px-3 py-1.5 text-xs font-semi-bold text-white hover:border-light-400 disabled:opacity-40"
        :disabled="project.busy"
        @click="project.redraw(focusedIllustration.id)"
      >
        Redraw this picture
      </button>
    </section>

    <StyleControl :scene-id="focusSceneId" />

    <section v-if="!storyboard" class="flex flex-col gap-1.5" aria-label="History">
      <h3 class="text-xs tracking-[0.06em] text-light-400 uppercase">History</h3>
      <ol class="flex flex-col gap-0.5">
        <li v-for="(version, index) in project.versions" :key="version.at + index">
          <button
            type="button"
            class="w-full truncate rounded px-2 py-1 text-left text-xs"
            :class="
              index === project.cursor
                ? 'bg-dark-500 text-white'
                : 'text-light-400 hover:text-white'
            "
            :disabled="project.busy"
            @click="project.goTo(index)"
          >
            {{ index + 1 }}. {{ version.label }}
          </button>
        </li>
      </ol>
    </section>

    <p
      v-if="project.error"
      class="rounded-md bg-alert-600 px-3 py-2 text-sm text-white"
      role="alert"
    >
      {{ project.error }}
    </p>

    <template #note>
      {{
        project.busy
          ? `${project.progress}…`
          : storyboard
            ? `${project.composition.scenes.length} scenes · narration is recorded after you approve`
            : `Version ${project.cursor + 1} of ${project.versions.length}`
      }}
    </template>
    <template #actions>
      <UiButton v-if="project.busy" variant="ghost" @click="project.cancel()">Stop</UiButton>
      <template v-else>
        <UiButton variant="ghost" :disabled="!project.canUndo" @click="project.undo()"
          >Undo</UiButton
        >
        <UiButton variant="ghost" :disabled="!project.canRedo" @click="project.redo()"
          >Redo</UiButton
        >
      </template>
      <UiButton v-if="storyboard" :disabled="project.busy || pending.size > 0" @click="approve"
        >Approve · record narration</UiButton
      >
      <UiButton v-else :disabled="project.busy" @click="router.push('/export')">Export</UiButton>
    </template>

    <template #preview>
      <VideoPlayer
        :composition="project.composition"
        :seconds="seconds"
        :media="pictures.media"
        :label="storyboard ? 'Storyboard preview' : 'Studio preview'"
      >
        <TimelinePanel
          :timeline="timeline"
          :keyframes="project.sceneStarts"
          :disabled="project.busy && project.phase === 'directing'"
        />
      </VideoPlayer>
    </template>
  </WizardShell>
</template>