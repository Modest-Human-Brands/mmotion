<script setup lang="ts">
import { computed } from 'vue'

import { firedAt, hasAction, progressAt } from '../beats'
import { ICONS } from '../icons'
import { elementProps } from './types'

const props = defineProps(elementProps)

const LOW = 0.18
const HIGH = 0.9

const sliders = computed(() => {
  const driven = hasAction(props.beats, 'raise')
  const all = props.element.items.length
  return props.element.items.map((item, index) => {
    // With raise beats a slider rises when named, or with a beat targeting the whole group
    // (target = item count); without beats they rise together once the scene settles.
    const at = driven
      ? (firedAt(props.beats, 'raise', index) ?? firedAt(props.beats, 'raise', all))
      : 1.2 + index * 0.12
    const level = at === null ? LOW : LOW + (HIGH - LOW) * progressAt(props.local, at, 0.9)
    return { item, level, hue: index * 40 }
  })
})
</script>

<template>
  <div
    data-enter
    class="flex h-[85%] w-full max-w-[85cqmin] items-stretch justify-between gap-[2cqmin] rounded-(--radius) bg-(--c-surface) p-[4cqmin] shadow-sm"
  >
    <div
      v-for="(slider, index) in sliders"
      :key="index"
      class="flex min-w-0 flex-1 flex-col items-center gap-[2cqmin]"
    >
      <component :is="ICONS[slider.item.icon]" class="size-[5cqmin] shrink-0 text-(--c-muted)" />
      <div class="relative w-[1.4cqmin] flex-1">
        <div class="absolute inset-0 rounded-full bg-(--c-muted) opacity-20" />
        <div
          class="absolute bottom-0 w-full rounded-full bg-(--c-accent)"
          :style="{ height: `${slider.level * 100}%`, filter: `hue-rotate(${slider.hue}deg)` }"
        />
        <div
          class="absolute left-1/2 size-[4cqmin] -translate-x-1/2 translate-y-1/2 rounded-full border-[0.6cqmin] border-white bg-(--c-accent) shadow"
          :style="{ bottom: `${slider.level * 100}%`, filter: `hue-rotate(${slider.hue}deg)` }"
        />
      </div>
      <span
        class="max-w-full truncate font-(family-name:--font-body) text-[2.6cqmin] text-(--c-text)"
        >{{ slider.item.label }}</span
      >
    </div>
  </div>
</template>