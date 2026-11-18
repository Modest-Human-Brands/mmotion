<script setup lang="ts">
import IconImage from '~icons/lucide/image'
import { computed } from 'vue'

import { elementProps } from './types'

const props = defineProps(elementProps)

// A slow drift and push-in keeps still pictures alive without fighting the narration.
const motion = computed(() => ({
  transform: `translateY(${Math.sin(props.local * 0.9) * 0.6}cqmin) scale(${1 + Math.min(props.local, 12) * 0.003})`,
}))
</script>

<template>
  <div class="flex size-full items-center justify-center">
    <img
      v-if="image.url"
      data-enter
      :src="image.url"
      alt=""
      class="max-h-full max-w-full object-contain"
      :class="image.framed ? 'rounded-(--radius) shadow-[0_2cqmin_6cqmin_#0003]' : 'cutout'"
      :style="motion"
    />
    <div
      v-else
      data-enter
      class="flex aspect-square h-[80%] max-w-full flex-col items-center justify-center gap-[3cqmin] rounded-(--radius) border-2 border-dashed border-(--c-muted) text-(--c-muted)"
    >
      <IconImage class="size-[12cqmin]" aria-hidden="true" />
      <span class="max-w-[80%] text-center font-(family-name:--font-body) text-[3.6cqmin]">
        {{ image.status === 'error' ? 'Illustration failed' : 'Illustrating…' }}
      </span>
      <span
        class="max-w-[80%] text-center font-(family-name:--font-body) text-[2.8cqmin] opacity-70"
      >
        {{ element.prompt }}
      </span>
    </div>
  </div>
</template>

<style scoped>
/* A figure drawn on white melts into a light scene colour. */
.cutout {
  mix-blend-mode: multiply;
}
/* On a dark scene that would darken the whole figure, so it sits on a soft light card. */
[data-tone='dark'] .cutout {
  mix-blend-mode: normal;
  background: #fff;
  border-radius: var(--radius);
  box-shadow: 0 2cqmin 6cqmin #0004;
}
</style>