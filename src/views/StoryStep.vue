<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import PromptBox from '@/components/studio/PromptBox.vue'
import UiButton from '@/components/ui/UiButton.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import type { Scene } from '@/core/composition/schema'
import LivePreview from '@/render/LivePreview.vue'
import { usePicturesStore } from '@/stores/pictures'
import { STEPS, stepIndex, useProjectStore } from '@/stores/project'

defineOptions({ name: 'StoryStep' })

const router = useRouter()
const project = useProjectStore()
const pictures = usePicturesStore()
const focusSceneId = ref<string | null>(null)

const SUGGESTIONS = [
  'Make the hook stronger',
  'Shorten the narration of this scene',
  'Split this scene in two',
  'Merge the last two scenes',
]

const groups = computed(() => {
  const current = project.composition
  if (!current) return []
  return current.chapters.map((chapter) => ({
    chapter,
    scenes: current.scenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => scene.chapterId === chapter.id),
  }))
})

const words = computed(
  () =>
    project.composition?.scenes.reduce(
      (sum, scene) => sum + scene.voiceover.split(/\s+/).filter(Boolean).length,
      0,
    ) ?? 0,
)

type Field = 'headline' | 'brief' | 'voiceover' | 'step'

function setScene(scene: Scene, field: Field, value: string) {
  const current = field === 'headline' || field === 'step' ? scene.chrome[field] : scene[field]
  if (value === current) return
  project.change(`Edited scene ${field}`, (next) => {
    const target = next.scenes.find((item) => item.id === scene.id)
    if (!target) return
    if (field === 'headline' || field === 'step') target.chrome[field] = value
    else target[field] = value
  })
  // A new visual idea needs direction again; wording alone keeps the current visual.
  if (field === 'brief')
    project.draft.directed = project.draft.directed.filter((id) => id !== scene.id)
}

function setChapter(id: string, patch: { title?: string; tone?: 'light' | 'dark' }) {
  project.change('Edited chapter', (next) => {
    const chapter = next.chapters.find((item) => item.id === id)
    if (chapter) Object.assign(chapter, patch)
  })
}

function removeScene(id: string) {
  if ((project.composition?.scenes.length ?? 0) <= 1) return
  project.change('Removed a scene', (next) => {
    next.scenes = next.scenes.filter((scene) => scene.id !== id)
  })
}

const value = (event: Event) => (event.target as HTMLInputElement | HTMLTextAreaElement).value

async function send(text: string) {
  await project.edit(text, focusSceneId.value ?? undefined)
}

async function approve() {
  project.approve('story')
  await router.push(STEPS[stepIndex('cast')].path)
}

const inputClass =
  'w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-white outline-none hover:border-dark-600 focus:border-accent-400 focus:bg-dark-500'
</script>

<template>
  <WizardShell
    v-if="project.composition"
    :step="stepIndex('story')"
    title="Story"
    subtitle="Chapters, scenes and narration, nothing drawn or recorded yet. Edit any line in place, or ask for changes. Approve when the story reads right."
  >
    <PromptBox :suggestions="SUGGESTIONS" :focused="!!focusSceneId" @send="send" />

    <section class="flex flex-col gap-3" aria-label="Story">
      <div v-for="group in groups" :key="group.chapter.id" class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <input
            :value="group.chapter.title"
            class="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-xs font-bold tracking-[0.12em] text-light-500 uppercase outline-none hover:border-dark-600 focus:border-accent-400"
            aria-label="Chapter title"
            :disabled="project.busy"
            @change="setChapter(group.chapter.id, { title: value($event) })"
          />
          <button
            type="button"
            class="rounded border border-dark-600 px-2 py-0.5 text-2xs text-light-400 hover:text-white"
            :disabled="project.busy"
            @click="
              setChapter(group.chapter.id, {
                tone: group.chapter.tone === 'dark' ? 'light' : 'dark',
              })
            "
          >
            {{ group.chapter.tone }}
          </button>
        </div>
        <article
          v-for="{ scene, index } in group.scenes"
          :key="scene.id"
          class="flex gap-2 rounded-md border p-2"
          :class="focusSceneId === scene.id ? 'border-accent-400' : 'border-dark-600'"
          @focusin="focusSceneId = scene.id"
        >
          <button
            type="button"
            class="w-6 shrink-0 self-start pt-1 text-xs text-light-400 tabular-nums hover:text-white"
            :aria-pressed="focusSceneId === scene.id"
            :title="focusSceneId === scene.id ? 'Prompts edit this scene' : 'Select'"
            @click="focusSceneId = focusSceneId === scene.id ? null : scene.id"
          >
            {{ index + 1 }}
          </button>
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <div class="flex items-center gap-1">
              <input
                :value="scene.chrome.headline"
                :class="[inputClass, 'font-bold']"
                aria-label="Headline"
                :disabled="project.busy"
                @change="setScene(scene, 'headline', value($event))"
              />
              <input
                :value="scene.chrome.step"
                :class="[inputClass, 'w-16 text-xs text-light-400']"
                placeholder="step"
                aria-label="Step badge"
                :disabled="project.busy"
                @change="setScene(scene, 'step', value($event))"
              />
            </div>
            <input
              :value="scene.brief"
              :class="[inputClass, 'text-xs text-light-400 italic']"
              placeholder="What the visual shows"
              aria-label="Visual idea"
              :disabled="project.busy"
              @change="setScene(scene, 'brief', value($event))"
            />
            <textarea
              :value="scene.voiceover"
              rows="2"
              :class="[inputClass, 'resize-none text-light-600']"
              aria-label="Narration"
              :disabled="project.busy"
              @change="setScene(scene, 'voiceover', value($event))"
            />
          </div>
          <button
            type="button"
            class="self-start px-1 text-light-400 hover:text-alert-400"
            aria-label="Remove scene"
            :disabled="project.busy"
            @click="removeScene(scene.id)"
          >
            ×
          </button>
        </article>
      </div>
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
          : `${project.composition.scenes.length} scenes · ${words} words · about ${Math.round(words / 2.5)} s`
      }}
    </template>
    <template #actions>
      <UiButton v-if="project.busy" variant="ghost" @click="project.cancel()">Stop</UiButton>
      <template v-else>
        <UiButton variant="ghost" @click="router.push(STEPS[stepIndex('source')].path)"
          >Back</UiButton
        >
        <UiButton variant="ghost" :disabled="!project.canUndo" @click="project.undo()"
          >Undo</UiButton
        >
      </template>
      <UiButton :disabled="project.busy" @click="approve">Approve story</UiButton>
    </template>

    <template #preview>
      <LivePreview
        :composition="project.composition"
        :media="pictures.media"
        label="Story preview (headlines only)"
      />
    </template>
  </WizardShell>
</template>