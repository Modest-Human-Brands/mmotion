<script setup lang="ts">
import { computed } from 'vue'

import { firedAt, progressAt, revealProgress } from '../beats'
import { ICONS } from '../icons'
import { elementProps } from './types'

const props = defineProps(elementProps)

// Nodes sit on a circle around the hub; a highlight beat tints a node and it stays lit,
// so the diagram fills in as the narration names each part.
const nodes = computed(() => {
  const count = Math.max(1, props.element.items.length)
  return props.element.items.map((item, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2
    const lit = firedAt(props.beats, 'highlight', index)
    return {
      item,
      x: 50 + Math.cos(angle) * 34,
      y: 50 + Math.sin(angle) * 34,
      shown: revealProgress(props.beats, props.local, index, 0.6, 0.2),
      lit: lit === null ? 0 : progressAt(props.local, lit, 0.4),
    }
  })
})
</script>

<template>
  <div class="relative" :style="{ width: 'min(100cqw, 100cqh)', height: 'min(100cqw, 100cqh)' }">
    <svg
      class="absolute inset-0 size-full text-(--c-muted)"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <line
        v-for="(node, index) in nodes"
        :key="index"
        x1="50"
        y1="50"
        :x2="50 + (node.x - 50) * node.shown"
        :y2="50 + (node.y - 50) * node.shown"
        stroke="currentColor"
        stroke-width="0.35"
        stroke-dasharray="1 1"
      />
    </svg>
    <div
      data-enter
      class="absolute top-1/2 left-1/2 flex size-[26%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-[1%] rounded-full bg-(--c-surface) shadow-lg"
    >
      <component :is="ICONS[element.center.icon]" class="size-[45%] text-(--c-text)" />
      <span class="font-(family-name:--font-body) text-[2.6cqmin] text-(--c-muted)">{{
        element.center.label
      }}</span>
    </div>
    <div
      v-for="(node, index) in nodes"
      :key="`n${index}`"
      class="absolute flex size-[19%] flex-col items-center justify-center gap-[2%] rounded-full border-[0.5cqmin]"
      :style="{
        left: `${node.x}%`,
        top: `${node.y}%`,
        opacity: node.shown,
        transform: `translate(-50%, -50%) scale(${(0.6 + 0.4 * node.shown) * (1 + 0.1 * node.lit)})`,
        backgroundColor: `color-mix(in srgb, var(--c-accent) ${node.lit * 28}%, var(--c-surface))`,
        borderColor: `color-mix(in srgb, var(--c-accent) ${node.lit * 100}%, transparent)`,
      }"
    >
      <component :is="ICONS[node.item.icon]" class="size-[42%] text-(--c-text)" />
      <span class="font-(family-name:--font-body) text-[2.6cqmin] font-semibold text-(--c-text)">{{
        node.item.label
      }}</span>
    </div>
  </div>
</template>