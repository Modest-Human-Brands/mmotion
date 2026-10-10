<script setup lang="ts">
import Device from '@/components/studio/scene/Device.vue'
import SceneCamera from '@/components/studio/scene/SceneCamera.vue'
import SceneLights from '@/components/studio/scene/SceneLights.vue'
import { useTrack } from '@/components/studio/scene/context'

// Authored at 60 fps over 540 frames: spiral up, hold face-on, spiral away.
const camera = useTrack([
  { frame: 0, value: [0, 0, 12], easing: 'easeOutCubic' },
  { frame: 240, value: [0, 0, 10] },
  { frame: 360, value: [0, 0, 10], easing: 'easeInOutCubic' },
  { frame: 480, value: [0, 0, 12] },
])

const position = useTrack([
  { frame: 0, value: [0, -4.5, -0.4], easing: 'easeOutCubic' },
  { frame: 240, value: [0, 0, 0] },
  { frame: 360, value: [0, 0, 0], easing: 'easeInOutCubic' },
  { frame: 480, value: [0, -4.5, -0.4] },
])

const rotation = useTrack([
  { frame: 0, value: [0.4, -Math.PI, -0.25], easing: 'easeOutCubic' },
  { frame: 240, value: [0, Math.PI, 0] },
  { frame: 360, value: [0, Math.PI, 0], easing: 'easeInOutCubic' },
  { frame: 480, value: [-0.4, 3 * Math.PI, 0.25] },
])
</script>

<template>
  <SceneCamera :position="camera" :fov="34" />
  <SceneLights />
  <Device
    model="/models/apple-iphone-15-pro-max-black.glb"
    screen="pIJKfZsazmcpEiU"
    :position="position"
    :rotation="rotation"
    :screen-material="{ roughness: 0.1 }"
  />
</template>