<script setup lang="ts">
import { computed } from 'vue'

import type { BackgroundKind } from '@/core/templates'

const props = defineProps<{ kind: BackgroundKind; seconds: number }>()

const drift = (speed: number, phase: number, range: number) =>
  50 + Math.sin(props.seconds * speed + phase) * range

const layer = computed(() => {
  const t = props.seconds
  switch (props.kind) {
    case 'grid':
      return {
        backgroundColor: 'var(--c-bg)',
        backgroundImage: [
          `radial-gradient(60cqmax 50cqmax at ${drift(0.25, 0, 18)}% ${drift(0.2, 1, 14)}%, color-mix(in srgb, var(--c-primary) 55%, transparent), transparent 70%)`,
          'linear-gradient(color-mix(in srgb, var(--c-text) 7%, transparent) 1px, transparent 1px)',
          'linear-gradient(90deg, color-mix(in srgb, var(--c-text) 7%, transparent) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: '100% 100%, 8cqmin 8cqmin, 8cqmin 8cqmin',
        backgroundPosition: `0 0, 0 ${t * 1.5}cqmin, ${t * 1.5}cqmin 0`,
      }
    case 'gradient':
      return {
        backgroundColor: 'var(--c-bg)',
        backgroundImage: [
          `radial-gradient(55cqmax 55cqmax at ${drift(0.3, 0, 30)}% ${drift(0.22, 2, 25)}%, color-mix(in srgb, var(--c-accent) 70%, transparent), transparent 70%)`,
          `radial-gradient(60cqmax 60cqmax at ${drift(0.18, 3, 30)}% ${drift(0.27, 5, 30)}%, color-mix(in srgb, var(--c-primary) 85%, transparent), transparent 70%)`,
        ].join(', '),
      }
    default:
      return { backgroundColor: 'var(--c-bg)' }
  }
})

// Large soft circles that drift slowly behind the content (the reference's paper-cut feel).
const circles = computed(() => [
  { x: 92 + Math.sin(props.seconds * 0.15) * 2, y: 6, size: 70 },
  { x: -10, y: 70 + Math.cos(props.seconds * 0.12) * 2, size: 55 },
])

const block = computed(() => ({
  transform: `translateX(${Math.sin(props.seconds * 0.35) * 4}cqw) rotate(-8deg)`,
}))
</script>

<template>
  <div class="absolute inset-0 overflow-hidden" :style="layer">
    <template v-if="kind === 'shapes'">
      <span
        v-for="(circle, index) in circles"
        :key="index"
        class="absolute rounded-full bg-white/35"
        :style="{
          left: `${circle.x}%`,
          top: `${circle.y}%`,
          width: `${circle.size}cqmin`,
          height: `${circle.size}cqmin`,
          transform: 'translate(-50%, -50%)',
        }"
      />
    </template>
    <template v-else-if="kind === 'blocks'">
      <div
        class="absolute -top-[10cqh] right-[-12cqw] h-[40cqh] w-[45cqw] bg-(--c-accent)"
        :style="block"
      />
      <div
        class="absolute bottom-[-14cqh] left-[-8cqw] h-[24cqh] w-[35cqw] bg-(--c-primary) opacity-90"
        :style="block"
      />
    </template>
  </div>
</template>