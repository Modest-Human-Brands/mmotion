<script setup lang="ts">
import { computed } from 'vue'

import { progressAt } from '../beats'
import { elementProps } from './types'

const props = defineProps(elementProps)

const CHARS_PER_SECOND = 22

// The text types itself out after a short "…" pause, like someone composing a reply.
const typed = computed(() => {
  const start = 1.1
  const count = Math.max(0, Math.floor((props.local - start) * CHARS_PER_SECOND))
  return props.element.text.slice(0, count)
})
const thinking = computed(() => typed.value.length === 0)
const dots = computed(() => '•••'.slice(0, 1 + (Math.floor(props.local * 3) % 3)))
const pop = computed(() => progressAt(props.local, 0.4, 0.5))
</script>

<template>
  <div class="flex size-full items-center justify-center">
    <div
      class="relative max-w-[80%] min-w-[30%] rounded-[5cqmin] bg-(--c-surface) px-[5cqmin] py-[4cqmin] shadow-md"
      :style="{ opacity: pop, transform: `scale(${0.6 + 0.4 * pop})`, transformOrigin: '20% 100%' }"
    >
      <p
        class="min-h-[1.3em] font-(family-name:--font-display) text-[5cqmin] leading-snug text-(--c-text)"
      >
        {{ thinking ? dots : typed }}
      </p>
      <p
        v-if="element.subtext && !thinking"
        class="mt-[1.5cqmin] font-(family-name:--font-body) text-[2.8cqmin] text-(--c-muted)"
      >
        {{ element.subtext }}
      </p>
      <span
        class="absolute -bottom-[3cqmin] left-[12%] size-[6cqmin] rotate-45 bg-(--c-surface)"
        aria-hidden="true"
      />
    </div>
  </div>
</template>