<script setup lang="ts">
import { toRef, useTemplateRef } from 'vue'

import { useSeekableTimeline } from '@/domain/animation/gsap'

const props = defineProps<{
  headline: string
  subtitle: string
  fontFamily: string
  accent: string
  onAccent: string
  logo: string
  currentFrame: number
  fps: number
}>()

const root = useTemplateRef<HTMLElement>('root')

// Reveal once at the start of the clip. Pure function of the frame, so it scrubs and exports identically.
useSeekableTimeline(
  root,
  (timeline) => {
    timeline
      .fromTo(
        '[data-reveal="bar"]',
        { scaleY: 0 },
        { scaleY: 1, duration: 0.5, ease: 'power3.out' },
        0.6,
      )
      .fromTo(
        '[data-reveal="headline"]',
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
        0.7,
      )
      .fromTo(
        '[data-reveal="subtitle"]',
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
        0.95,
      )
    if (root.value?.querySelector('[data-reveal="logo"]')) {
      timeline.fromTo(
        '[data-reveal="logo"]',
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: 'power2.out' },
        1.1,
      )
    }
  },
  toRef(props, 'currentFrame'),
  toRef(props, 'fps'),
)
</script>

<template>
  <div
    ref="root"
    class="pointer-events-none absolute inset-0 text-white"
    :style="{ fontFamily, containerType: 'size' }"
  >
    <div
      v-show="headline || subtitle"
      class="absolute bottom-[8cqh] left-[6cqw] flex max-w-[70cqw] gap-[1.6cqh]"
    >
      <span
        data-reveal="bar"
        class="w-[0.7cqh] shrink-0 origin-top self-stretch"
        :style="{ backgroundColor: accent }"
      />
      <div class="min-w-0">
        <h1
          data-reveal="headline"
          class="text-[7cqh] leading-[1.1] font-bold drop-shadow-[0_0.4cqh_1.2cqh_rgb(0_0_0/0.45)]"
        >
          {{ headline }}
        </h1>
        <p
          v-show="subtitle"
          data-reveal="subtitle"
          class="mt-[1.2cqh] text-[3cqh] text-white/85 drop-shadow-[0_0.3cqh_1cqh_rgb(0_0_0/0.45)]"
        >
          {{ subtitle }}
        </p>
      </div>
    </div>
    <img
      v-if="logo"
      data-reveal="logo"
      :src="logo"
      alt=""
      class="absolute top-[6cqh] right-[6cqw] h-[8cqh] w-auto max-w-[16cqw] object-contain"
    />
  </div>
</template>