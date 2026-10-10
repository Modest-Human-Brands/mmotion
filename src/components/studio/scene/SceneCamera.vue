<script setup lang="ts">
import { computed } from 'vue'

import type { Vector3Tuple } from '@/domain/animation/types'

import { useSceneContext } from './context'

const props = withDefaults(
  defineProps<{
    position: readonly number[]
    /** Euler rotation. When omitted the camera looks at `lookAt`. */
    rotation?: readonly number[]
    lookAt?: readonly number[]
    fov?: number
  }>(),
  { lookAt: () => [0, 0, 0], fov: 34 },
)

const scene = useSceneContext()

// The user's distance setting dollies the camera along its line to the origin.
const position = computed(
  () => props.position.map((value) => value * scene.cameraDistance.value) as Vector3Tuple,
)
const fov = computed(() => scene.cameraFov.value ?? props.fov)
</script>

<template>
  <TresPerspectiveCamera
    v-if="rotation"
    :position="position"
    :rotation="[...rotation]"
    :aspect="scene.aspect.value"
    :fov="fov"
  />
  <TresPerspectiveCamera
    v-else
    :position="position"
    :look-at="[...lookAt]"
    :aspect="scene.aspect.value"
    :fov="fov"
  />
</template>