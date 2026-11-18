<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import TimelinePanel from '@/components/studio/TimelinePanel.vue'
import UiButton from '@/components/ui/UiButton.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { createPlayback } from '@/core/audio/voiceover'
import { activeSpans, sceneSpans } from '@/core/composition/timing'
import VideoPlayer from '@/render/VideoPlayer.vue'
import { useProjectStore } from '@/stores/project'

defineOptions({ name: 'StudioStep' })

const router = useRouter()
const project = useProjectStore()
const timeline = project.timeline

const prompt = ref('')
const focusSceneId = ref<string | null>(null)

const SUGGESTIONS = [
  'Make this scene a diagram instead',
  'Make the headlines shorter',
  'Add a checklist recap before the closing chapter',
  'Make the characters smile more',
]

const seconds = computed(() => timeline.currentFrame.value / timeline.fps.value)
const spans = computed(() => (project.composition ? sceneSpans(project.composition) : []))
const currentSceneId = computed(() => activeSpans(spans.value, seconds.value).at(-1)?.scene.id)

function selectScene(id: string) {
  const span = spans.value.find((item) => item.scene.id === id)
  focusSceneId.value = focusSceneId.value === id ? null : id
  if (span && project.composition) {
    timeline.pause()
    timeline.seek(Math.round((span.start + 0.6) * project.composition.fps))
  }
}

async function send(text = prompt.value) {
  if (!text.trim() || project.busy) return
  prompt.value = ''
  await project.edit(text, focusSceneId.value ?? undefined)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    void send()
  }
}

// Voiceover follows the clock: restart on play, seek, loop or a new mix; stop on pause.
const playback = createPlayback()
function syncAudio() {
  if (timeline.isPlaying.value && project.mix) playback.play(project.mix, seconds.value)
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
}
onMounted(activate)
onActivated(activate)
onDeactivated(() => {
  window.removeEventListener('keydown', onShortcut)
  timeline.pause()
  timeline.stop()
  playback.stop()
})

const ELEMENT_LABEL: Record<string, string> = {
  none: 'Statement',
  illustration: 'Picture',
  radialDiagram: 'Diagram',
  chips: 'Chips',
  sliders: 'Sliders',
  checklist: 'Checklist',
  speechBubble: 'Speech',
  splitCards: 'Cards',
  bigWord: 'Big word',
  stat: 'Stat',
  quote: 'Quote',
  logoReveal: 'Logo',
}

const groups = computed(() => {
  const current = project.composition
  if (!current) return []
  return current.chapters
    .map((chapter) => ({
      chapter,
      scenes: current.scenes
        .map((scene, index) => ({ scene, index }))
        .filter(({ scene }) => scene.chapterId === chapter.id),
    }))
    .filter((group) => group.scenes.length > 0)
})

const STATUS_DOT: Record<string, string> = {
  done: 'bg-success-500',
  running: 'bg-warning-500 animate-pulse',
  queued: 'bg-light-400',
  error: 'bg-alert-500',
  idle: 'bg-dark-600',
}

const focusedIllustration = computed(() => {
  const scene = project.composition?.scenes.find((item) => item.id === focusSceneId.value)
  return scene?.element.kind === 'illustration' ? scene : null
})
</script>

<template>
  <WizardShell
    v-if="project.composition"
    :step="3"
    :title="project.composition.title"
    subtitle="Describe a change. Only what you ask for is edited; every version is kept."
  >
    <section class="flex flex-col gap-2" aria-label="Conversation">
      <p
        v-for="(entry, index) in project.chat"
        :key="index"
        class="rounded-md px-3 py-2 text-sm"
        :class="
          entry.role === 'user'
            ? 'self-end bg-accent-500 text-white'
            : entry.error
              ? 'bg-alert-600/20 text-alert-400'
              : 'bg-dark-500 text-light-600'
        "
      >
        {{ entry.text }}
      </p>
    </section>

    <div class="flex flex-col gap-2">
      <textarea
        v-model="prompt"
        rows="3"
        class="w-full resize-none rounded-md border border-dark-600 bg-dark-500 px-3 py-2 text-sm text-white outline-none placeholder:text-light-400 focus:border-accent-400"
        :placeholder="
          focusSceneId
            ? 'Change this scene… (Ctrl+Enter to send)'
            : 'e.g. Make scene 2 more energetic (Ctrl+Enter to send)'
        "
        :disabled="project.busy"
        aria-label="Change request"
        @keydown="onKeydown"
      />
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="suggestion in SUGGESTIONS"
          :key="suggestion"
          type="button"
          class="rounded-full border border-dark-600 px-2.5 py-1 text-xs text-light-500 hover:border-light-400 hover:text-white disabled:opacity-40"
          :disabled="project.busy"
          @click="send(suggestion)"
        >
          {{ suggestion }}
        </button>
      </div>
    </div>

    <section class="flex flex-col gap-1.5" aria-label="Scenes">
      <div class="flex items-center justify-between">
        <h3 class="text-xs tracking-[0.06em] text-light-400 uppercase">
          Scenes<span v-if="focusSceneId"> · editing the selected scene</span>
        </h3>
        <span v-if="project.illustrations.total" class="text-xs text-light-400" role="status">
          Illustrations {{ project.illustrations.done }}/{{ project.illustrations.total }}
          <span v-if="project.illustrations.failed" class="text-alert-400">
            · {{ project.illustrations.failed }} failed</span
          >
          <button
            v-if="project.illustrations.failed || project.imageTrouble"
            type="button"
            class="ml-1 underline hover:text-white"
            :title="project.imageTrouble ?? undefined"
            @click="project.retryIllustrations()"
          >
            Retry
          </button>
        </span>
      </div>
      <template v-for="group in groups" :key="group.chapter.id">
        <p class="mt-1 text-2xs font-bold tracking-[0.12em] text-light-500 uppercase">
          {{ group.chapter.title || 'Untitled chapter' }}
          <span v-if="group.chapter.tone === 'dark'" class="text-light-400">· dark</span>
        </p>
        <button
          v-for="{ scene, index } in group.scenes"
          :key="scene.id"
          type="button"
          class="flex items-center gap-3 rounded-md border px-3 py-2 text-left"
          :class="
            focusSceneId === scene.id
              ? 'border-accent-400 bg-dark-500'
              : currentSceneId === scene.id
                ? 'border-dark-600 bg-dark-500'
                : 'border-transparent hover:bg-dark-500'
          "
          :aria-pressed="focusSceneId === scene.id"
          @click="selectScene(scene.id)"
        >
          <span class="w-5 text-xs text-light-400 tabular-nums">{{ index + 1 }}</span>
          <span class="flex w-20 shrink-0 items-center gap-1.5 text-xs text-light-400">
            <span
              v-if="scene.element.kind === 'illustration'"
              class="size-1.5 rounded-full"
              :class="STATUS_DOT[project.images.get(scene.id)?.status ?? 'idle']"
            />
            {{ ELEMENT_LABEL[scene.element.kind] }}
          </span>
          <span class="min-w-0 flex-1 truncate text-sm text-white">
            {{ scene.chrome.headline || scene.element.text || scene.chrome.caption || '—' }}
          </span>
          <span class="text-xs text-light-400 tabular-nums">{{ scene.duration.toFixed(1) }}s</span>
        </button>
      </template>
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

    <section class="flex flex-col gap-1.5" aria-label="History">
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
      <UiButton variant="secondary" :disabled="project.busy || !prompt.trim()" @click="send()"
        >Apply</UiButton
      >
      <UiButton :disabled="project.busy" @click="router.push('/export')">Export</UiButton>
    </template>

    <template #preview>
      <VideoPlayer
        :composition="project.composition"
        :seconds="seconds"
        :media="project.media"
        label="Studio preview"
      >
        <TimelinePanel
          :timeline="timeline"
          :keyframes="project.sceneStarts"
          :disabled="project.busy && project.phase === 'writing'"
        />
      </VideoPlayer>
    </template>
  </WizardShell>
</template>