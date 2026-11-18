<script setup lang="ts">
import { computed } from 'vue'

import { progressAt } from '../beats'
import { elementProps } from './types'

const props = defineProps(elementProps)

// Soft dots float around the word, the way the reference frames its key terms.
const DOTS: [number, number, number][] = [
  [14, 18, 7],
  [82, 14, 9],
  [70, 34, 5],
  [10, 64, 8],
  [88, 72, 6],
  [30, 86, 5],
]

const dots = computed(() =>
  DOTS.map(([x, y, size], index) => ({
    x: x + Math.sin(props.local * 0.7 + index) * 2,
    y: y + Math.cos(props.local * 0.6 + index * 2) * 2,
    size,
    shown: progressAt(props.local, 0.2 + index * 0.1, 0.8),
    tint: 25 + (index % 3) * 15,
  })),
)
const word = computed(() => progressAt(props.local, 0.3, 0.7))
</script>

<template>
  <div class="relative flex size-full flex-col items-center justify-center gap-[3cqmin]">
    <span
      v-for="(dot, index) in dots"
      :key="index"
      class="absolute rounded-full"
      :style="{
        left: `${dot.x}%`,
        top: `${dot.y}%`,
        width: `${dot.size}cqmin`,
        height: `${dot.size}cqmin`,
        opacity: dot.shown * 0.8,
        backgroundColor: `color-mix(in srgb, var(--c-accent) ${dot.tint}%, var(--c-surface))`,
      }"
      aria-hidden="true"
    />
    <p
      class="relative max-w-[92%] text-center font-(family-name:--font-body) text-[12cqmin] leading-[0.95] font-extrabold tracking-tight text-(--c-text) uppercase"
      :style="{ opacity: word, transform: `scale(${0.85 + 0.15 * word})` }"
    >
      {{ element.text }}
    </p>
    <p
      v-if="element.subtext"
      data-enter
      class="relative max-w-[80%] text-center font-(family-name:--font-body) text-[3.6cqmin] text-(--c-muted)"
    >
      {{ element.subtext }}
    </p>
  </div>
</template>