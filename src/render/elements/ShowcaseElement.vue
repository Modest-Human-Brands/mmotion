<script setup lang="ts">
import { computed } from 'vue'

import { progressAt } from '../beats'
import { elementProps } from './types'

const props = defineProps(elementProps)

// The real thing (logo, product, app screen), never redrawn: a card that settles and slowly
// pushes in.
const reveal = computed(() => progressAt(props.local, 0.3, 0.7))
const motion = computed(() => ({
  opacity: reveal.value,
  transform: `translateY(${(1 - reveal.value) * 4}cqmin) scale(${0.94 + 0.06 * reveal.value + Math.min(props.local, 12) * 0.002})`,
}))
</script>

<template>
  <div class="flex size-full items-center justify-center">
    <div
      v-if="image.url"
      class="flex max-h-[90%] max-w-[90%] items-center justify-center overflow-hidden rounded-(--radius) bg-white p-[3cqmin] shadow-lg"
      :style="motion"
    >
      <img :src="image.url" alt="" class="max-h-[70cqh] max-w-full object-contain" />
    </div>
    <p v-else class="font-(family-name:--font-body) text-[3.6cqmin] text-(--c-muted)">
      {{ element.cast[0] || 'Showcase' }}
    </p>
  </div>
</template>