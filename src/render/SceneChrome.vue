<script setup lang="ts">
import IconCheck from '~icons/lucide/check'
import { computed } from 'vue'

import type { BrandTokens, Chapter, Scene } from '@/core/composition/schema'
import type { Template } from '@/core/templates'

import { captionAt, progressAt, type TimedBeat } from './beats'

const props = defineProps<{
  scene: Scene
  chapter: Chapter
  template: Template
  brand: BrandTokens
  beats: TimedBeat[]
  local: number
}>()

const centered = computed(() => props.template.align === 'center')
/** With no visual, the headline carries the scene as a centred statement. */
const statement = computed(() => props.scene.element.kind === 'none')

const caption = computed(() => captionAt(props.beats, props.local, props.scene.chrome.caption))
// Captions crossfade when a caption beat swaps the text.
const captionIn = computed(() =>
  caption.value.since === -Infinity ? 1 : progressAt(props.local, caption.value.since, 0.35),
)
const footer = computed(() => props.brand.name.toUpperCase())
</script>

<template>
  <div
    class="relative flex size-full flex-col px-[7cqw] pt-[6cqh] pb-[4cqh]"
    :class="centered ? 'items-center text-center' : ''"
  >
    <header class="flex w-full flex-col gap-[2.2cqmin]" :class="centered ? 'items-center' : ''">
      <p v-if="chapter.title" data-enter class="eyebrow">{{ chapter.title }}</p>
      <span
        v-if="chapter.title && !centered"
        data-enter
        class="h-px w-full bg-(--c-muted) opacity-30"
      />
      <span
        v-if="scene.chrome.step"
        data-enter
        class="w-fit rounded-full bg-(--c-accent) px-[2.4cqmin] py-[0.8cqmin] font-(family-name:--font-body) text-[2.3cqmin] font-bold tracking-[0.08em] text-(--c-on-accent)"
        >STEP {{ scene.chrome.step }}</span
      >
      <h2
        v-if="scene.chrome.headline && !statement"
        data-enter
        class="heading max-w-[86cqw] text-balance"
      >
        {{ scene.chrome.headline }}
      </h2>
    </header>

    <div
      class="relative my-[3cqh] flex min-h-0 w-full flex-1 items-center justify-center"
      :style="{ containerType: 'size' }"
    >
      <h2
        v-if="statement"
        data-enter
        class="heading max-w-[80cqw] text-center text-[calc(var(--heading-size)*1.15)]! text-balance"
      >
        {{ scene.chrome.headline }}
      </h2>
      <slot v-else />
    </div>

    <p
      v-if="caption.text"
      class="flex w-full items-center gap-[2cqmin] rounded-(--radius) bg-(--c-surface) px-[3.5cqmin] py-[2.4cqmin] font-(family-name:--font-body) text-[3.2cqmin] text-(--c-text)"
      :class="scene.chrome.step ? 'justify-start' : 'justify-center text-center'"
      :style="{ opacity: captionIn }"
    >
      <span
        v-if="scene.chrome.step"
        class="flex size-[3.6cqmin] shrink-0 items-center justify-center rounded-[0.8cqmin] border-[0.35cqmin] border-(--c-accent)"
      >
        <IconCheck class="size-[80%] text-(--c-accent)" />
      </span>
      {{ caption.text }}
    </p>
    <footer
      class="mt-[2cqh] w-full font-(family-name:--font-body) text-[1.8cqmin] font-bold tracking-[0.18em] text-(--c-muted)"
      :class="centered ? 'text-center' : ''"
    >
      {{ footer }}
    </footer>
  </div>
</template>