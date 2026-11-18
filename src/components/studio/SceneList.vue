<script setup lang="ts">
import { computed } from 'vue'

import type { Composition, ElementKind } from '@/core/composition/schema'
import type { ImageState } from '@/render/elements/types'

const props = defineProps<{
  composition: Composition
  focusId: string | null
  currentId?: string
  images: Map<string, ImageState>
  /** Scenes still waiting for a visual. */
  pending?: Set<string>
}>()
const emit = defineEmits<{ select: [id: string] }>()

const ELEMENT_LABEL: Record<ElementKind, string> = {
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
  showcase: 'Showcase',
}

const STATUS_DOT: Record<string, string> = {
  done: 'bg-success-500',
  running: 'bg-warning-500 animate-pulse',
  queued: 'bg-light-400',
  error: 'bg-alert-500',
  idle: 'bg-dark-600',
}

const groups = computed(() =>
  props.composition.chapters
    .map((chapter) => ({
      chapter,
      scenes: props.composition.scenes
        .map((scene, index) => ({ scene, index }))
        .filter(({ scene }) => scene.chapterId === chapter.id),
    }))
    .filter((group) => group.scenes.length > 0),
)
</script>

<template>
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
        focusId === scene.id
          ? 'border-accent-400 bg-dark-500'
          : currentId === scene.id
            ? 'border-dark-600 bg-dark-500'
            : 'border-transparent hover:bg-dark-500'
      "
      :aria-pressed="focusId === scene.id"
      @click="emit('select', scene.id)"
    >
      <span class="w-5 text-xs text-light-400 tabular-nums">{{ index + 1 }}</span>
      <span class="flex w-22 shrink-0 items-center gap-1.5 text-xs text-light-400">
        <span
          v-if="scene.element.kind === 'illustration'"
          class="size-1.5 rounded-full"
          :class="STATUS_DOT[images.get(scene.id)?.status ?? 'idle']"
        />
        {{ pending?.has(scene.id) ? 'Waiting' : ELEMENT_LABEL[scene.element.kind] }}
      </span>
      <span class="min-w-0 flex-1 truncate text-sm text-white">
        {{ scene.chrome.headline || scene.element.text || scene.chrome.caption || '—' }}
      </span>
      <span v-if="scene.element.cast.length" class="truncate text-2xs text-light-400">
        {{ scene.element.cast.join(', ') }}
      </span>
      <span class="text-xs text-light-400 tabular-nums">{{ scene.duration.toFixed(1) }}s</span>
    </button>
  </template>
</template>