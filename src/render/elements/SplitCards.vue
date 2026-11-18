<script setup lang="ts">
import { computed } from 'vue'

import { revealProgress } from '../beats'
import { ICONS } from '../icons'
import { elementProps } from './types'

const props = defineProps(elementProps)

const cards = computed(() =>
  props.element.items.slice(0, 3).map((item, index) => ({
    item,
    shown: revealProgress(props.beats, props.local, index, 0.5, 0.45),
  })),
)
</script>

<template>
  <div class="flex size-full flex-col justify-center gap-[3cqmin]">
    <div
      v-for="(card, index) in cards"
      :key="index"
      class="flex flex-1 items-center gap-[4cqmin] rounded-(--radius) px-[5cqmin] py-[4cqmin] shadow-sm"
      :style="{
        opacity: card.shown,
        transform: `translateX(${(1 - card.shown) * (index % 2 ? 6 : -6)}cqmin)`,
        backgroundColor: `color-mix(in srgb, var(--c-accent) ${12 + index * 8}%, var(--c-surface))`,
      }"
    >
      <span
        class="flex size-[14cqmin] shrink-0 items-center justify-center rounded-full bg-(--c-surface)"
      >
        <component :is="ICONS[card.item.icon]" class="size-[55%] text-(--c-accent)" />
      </span>
      <span class="flex flex-col gap-[1cqmin]">
        <span
          class="font-(family-name:--font-display) text-[4.6cqmin] leading-tight font-semibold text-(--c-text)"
          >{{ card.item.label }}</span
        >
        <span
          v-if="card.item.detail"
          class="font-(family-name:--font-body) text-[3cqmin] text-(--c-muted)"
          >{{ card.item.detail }}</span
        >
      </span>
    </div>
  </div>
</template>