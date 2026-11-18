<script setup lang="ts">
import IconCheck from '~icons/lucide/check'
import { computed } from 'vue'

import { firedAt, hasAction, progressAt, revealProgress } from '../beats'
import { ICONS } from '../icons'
import { elementProps } from './types'

const props = defineProps(elementProps)

const rows = computed(() => {
  const driven = hasAction(props.beats, 'check')
  return props.element.items.map((item, index) => {
    const shown = revealProgress(props.beats, props.local, index, 0.5, 0.35)
    const at = driven ? firedAt(props.beats, 'check', index) : 1 + index * 0.6
    return { item, shown, checked: at === null ? 0 : progressAt(props.local, at, 0.35) }
  })
})
</script>

<template>
  <ul class="flex w-full max-w-[88cqmin] flex-col justify-center gap-[2.4cqmin]">
    <li
      v-for="(row, index) in rows"
      :key="index"
      class="flex items-center gap-[3cqmin] rounded-(--radius) bg-(--c-surface) px-[3.5cqmin] py-[2.6cqmin] shadow-sm"
      :style="{ opacity: row.shown, transform: `translateY(${(1 - row.shown) * 3}cqmin)` }"
    >
      <span
        class="flex size-[5.5cqmin] shrink-0 items-center justify-center rounded-[1.2cqmin] border-[0.5cqmin] border-(--c-accent)"
        :style="{
          backgroundColor: `color-mix(in srgb, var(--c-accent) ${row.checked * 100}%, transparent)`,
        }"
      >
        <IconCheck
          class="size-[70%] text-(--c-on-accent)"
          :style="{ opacity: row.checked, transform: `scale(${0.5 + 0.5 * row.checked})` }"
        />
      </span>
      <component
        :is="ICONS[row.item.icon]"
        v-if="row.item.icon"
        class="size-[5cqmin] shrink-0 text-(--c-muted)"
      />
      <span class="flex flex-col">
        <span
          class="font-(family-name:--font-body) text-[3.6cqmin] font-semibold text-(--c-text)"
          >{{ row.item.label }}</span
        >
        <span
          v-if="row.item.detail"
          class="font-(family-name:--font-body) text-[2.8cqmin] text-(--c-muted)"
          >{{ row.item.detail }}</span
        >
      </span>
    </li>
  </ul>
</template>