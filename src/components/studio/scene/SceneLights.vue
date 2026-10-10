<script setup lang="ts">
import type { DirectionalLightConfig } from '@/domain/animation/types'

withDefaults(
  defineProps<{
    ambient?: number
    directional?: DirectionalLightConfig[]
  }>(),
  {
    ambient: 1,
    directional: () => [
      { position: [4, 6, 3], intensity: 1.8 },
      { position: [-4, -3, -2], intensity: 0.6 },
    ],
  },
)
</script>

<template>
  <TresAmbientLight :intensity="ambient" />
  <TresDirectionalLight
    v-for="(light, index) in directional"
    :key="index"
    :position="light.position"
    :intensity="light.intensity"
    :color="light.color ?? '#ffffff'"
  />
</template>