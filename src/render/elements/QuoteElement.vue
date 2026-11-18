<script setup lang="ts">
import { elementProps } from './types'

defineProps(elementProps)
</script>

<template>
  <div class="flex size-full flex-col justify-center gap-[3cqmin] px-[4cqmin]">
    <span
      data-enter
      class="font-(family-name:--font-display) text-[22cqmin] leading-[0.6] text-(--c-accent)"
      aria-hidden="true"
      >“</span
    >
    <blockquote
      data-enter
      class="font-(family-name:--font-display) text-[6cqmin] leading-[1.25] text-balance text-(--c-text)"
    >
      {{ element.text }}
    </blockquote>
    <p
      v-if="element.subtext"
      data-enter
      class="font-(family-name:--font-body) text-[3cqmin] tracking-[0.12em] text-(--c-muted) uppercase"
    >
      — {{ element.subtext }}
    </p>
  </div>
</template>