<script setup lang="ts">
import { computed } from 'vue'

import { progressAt } from '../beats'
import { elementProps } from './types'

const props = defineProps(elementProps)

const disc = computed(() => progressAt(props.local, 0.3, 0.9))
const words = computed(() => progressAt(props.local, 1.1, 0.8))
const initial = computed(() => (props.brand.name.trim().charAt(0) || '•').toUpperCase())
</script>

<template>
  <div class="flex size-full flex-col items-center justify-center gap-[4cqmin]">
    <div
      class="flex size-[42cqmin] items-center justify-center overflow-hidden rounded-full bg-(--c-surface)"
      :style="{ transform: `scale(${0.4 + 0.6 * disc})`, opacity: disc }"
    >
      <img v-if="brand.logo" :src="brand.logo" alt="" class="size-[62%] object-contain" />
      <span
        v-else
        class="font-(family-name:--font-display) text-[20cqmin] font-bold text-(--c-text)"
        >{{ initial }}</span
      >
    </div>
    <p
      v-if="element.text"
      class="max-w-[85%] text-center font-(family-name:--font-body) text-[6.5cqmin] leading-tight font-bold tracking-[0.06em] text-(--c-text) uppercase"
      :style="{ opacity: words, transform: `translateY(${(1 - words) * 3}cqmin)` }"
    >
      {{ element.text }}
    </p>
    <p
      v-if="element.subtext"
      class="font-(family-name:--font-body) text-[3cqmin] text-(--c-muted)"
      :style="{ opacity: words }"
    >
      {{ element.subtext }}
    </p>
  </div>
</template>