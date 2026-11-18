<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import StylePicker from '@/components/start/StylePicker.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
import { getStyle, sceneStyle } from '@/core/styles'
import { useProjectStore } from '@/stores/project'

/** The art style of the whole video, the selected scene's chapter or the selected scene. */
const props = defineProps<{ sceneId?: string | null }>()

const project = useProjectStore()
const open = ref(false)
const scope = ref<'video' | 'chapter' | 'scene'>('video')
watch(
  () => props.sceneId,
  (id) => {
    if (!id) scope.value = 'video'
  },
)

const scene = computed(() =>
  props.sceneId ? project.composition?.scenes.find((item) => item.id === props.sceneId) : undefined,
)
const chapter = computed(() =>
  scene.value
    ? project.composition?.chapters.find((item) => item.id === scene.value!.chapterId)
    : undefined,
)

const value = computed(() => {
  if (scope.value === 'scene') return scene.value?.styleId ?? ''
  if (scope.value === 'chapter') return chapter.value?.styleId ?? ''
  return project.composition?.styleId ?? ''
})

/** What "" falls back to at this scope. */
const inherited = computed(() => {
  const current = project.composition
  if (!current) return ''
  if (scope.value === 'scene' && scene.value)
    return sceneStyle(current, { ...scene.value, styleId: '' }).name
  if (scope.value === 'chapter') return sceneStyle(current).name
  return getStyle(sceneStyle({ ...current, styleId: '' }).id).name
})

const shown = computed(() =>
  project.composition ? sceneStyle(project.composition, scene.value).name : '',
)

function choose(id: string) {
  const target =
    scope.value === 'scene'
      ? (scene.value?.id ?? null)
      : scope.value === 'chapter'
        ? (chapter.value?.id ?? null)
        : null
  project.setStyle(id, target)
}
</script>

<template>
  <section class="flex flex-col gap-2 rounded-lg border border-dark-600 p-3" aria-label="Art style">
    <button
      type="button"
      class="flex items-center justify-between text-left text-sm font-semi-bold text-light-600"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span
        >Art style <span class="font-normal text-light-400">· {{ shown }}</span></span
      >
      <span class="text-xs text-light-400">{{ open ? 'Hide' : 'Change' }}</span>
    </button>
    <template v-if="open">
      <UiSegmentedControl
        v-if="scene"
        v-model="scope"
        :options="[
          { value: 'video', label: 'Whole video' },
          { value: 'chapter', label: 'This chapter' },
          { value: 'scene', label: 'This scene' },
        ]"
      />
      <StylePicker
        :model-value="value"
        :inherit="
          scope === 'video' ? `The look's (${inherited})` : `Same as around it (${inherited})`
        "
        :disabled="project.busy"
        @update:model-value="choose"
      />
      <p class="text-2xs text-light-400">
        Pictures redraw from the approved cast sheets in the new style. To redraw the sheets
        themselves, open Cast.
      </p>
    </template>
  </section>
</template>