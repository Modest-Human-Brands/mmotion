<script setup lang="ts">
import { computed } from 'vue'

import { revealProgress } from '../beats'
import { elementProps } from './types'

const props = defineProps(elementProps)

// Chips sit around the centre text and drift on their own slow orbits.
const SLOTS: [number, number][] = [
  [20, 16],
  [78, 12],
  [14, 72],
  [82, 68],
  [50, 90],
  [48, 8],
  [86, 40],
  [12, 42],
]

const chips = computed(() =>
  props.element.items.map((item, index) => {
    const [x, y] = SLOTS[index % SLOTS.length]!
    const phase = index * 1.7
    return {
      item,
      shown: revealProgress(props.beats, props.local, index, 0.5, 0.25),
      x: x + Math.sin(props.local * 0.6 + phase) * 2.5,
      y: y + Math.cos(props.local * 0.5 + phase) * 2,
      tint: 18 + (index % 3) * 8,
    }
  }),
)
</script>

<template>
  <div class="relative size-full">
    <p
      v-if="element.text"
      data-enter
      class="absolute top-1/2 left-1/2 w-[62%] -translate-x-1/2 -translate-y-1/2 text-center font-(family-name:--font-display) text-[5cqmin] leading-tight text-(--c-text)"
    >
      {{ element.text }}
    </p>
    <span
      v-for="(chip, index) in chips"
      :key="index"
      class="absolute rounded-full px-[3cqmin] py-[1.2cqmin] font-(family-name:--font-body) text-[3cqmin] font-semibold whitespace-nowrap text-(--c-text) shadow-sm"
      :style="{
        left: `${chip.x}%`,
        top: `${chip.y}%`,
        opacity: chip.shown,
        transform: `translate(-50%, -50%) scale(${0.7 + 0.3 * chip.shown})`,
        backgroundColor: `color-mix(in srgb, var(--c-accent) ${chip.tint}%, var(--c-surface))`,
      }"
      >{{ chip.item.label }}</span
    >
  </div>
</template>