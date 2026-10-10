<script setup lang="ts">
import type { MotionTemplateDefinition } from '@templates/types'

defineProps<{ template: MotionTemplateDefinition }>()
</script>

<template>
  <span class="flex size-full items-center justify-center" aria-hidden="true">
    <img
      :src="template.thumbnail"
      alt=""
      loading="lazy"
      class="max-h-35 max-w-40 rounded-sm object-cover shadow-doc-page"
      :style="{ aspectRatio: template.resolution.aspectRatio }"
    />
  </span>
</template>