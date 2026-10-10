<script setup lang="ts">
import Device from '@/components/studio/scene/Device.vue'
import SceneCamera from '@/components/studio/scene/SceneCamera.vue'
import SceneLights from '@/components/studio/scene/SceneLights.vue'
import { useTrack } from '@/components/studio/scene/context'

// Authored at 60 fps over 360 frames: rise in, open the lid, hold on the screen, exit to camera.
const camera = useTrack([
  { frame: 0, value: [0, 2, 7], easing: 'easeOutCubic' },
  { frame: 360, value: [0, 1.5, 6] },
])

const position = useTrack([
  { frame: 0, value: [0, -1, 2], easing: 'easeOutCubic' },
  { frame: 90, value: [0, -0.5, 0] },
  { frame: 270, value: [0, -0.5, 0], easing: 'easeInOutCubic' },
  { frame: 360, value: [0, 2, 5] },
])

const rotation = useTrack([
  { frame: 0, value: [0.5, -0.5, 0], easing: 'easeOutCubic' },
  { frame: 90, value: [0.2, 0, 0] },
  { frame: 270, value: [0.2, 0, 0], easing: 'easeInOutCubic' },
  { frame: 360, value: [0, 1.5708, 0.2] },
])

// The hinge starts closed (rotated back) and opens over the first second.
const lid = useTrack([
  { frame: 0, value: [1.919, 0, 0], easing: 'easeInOutSine' },
  { frame: 60, value: [0, 0, 0] },
])
</script>

<template>
  <SceneCamera :position="camera" :fov="45" />
  <SceneLights />
  <Device
    model="/models/apple-macbook-pro-m3-16-inch.glb"
    screen="sfCQkHOWyrsLmor"
    chassis="Body_Aluminum_Mesh"
    :position="position"
    :rotation="rotation"
    :screen-material="{ roughness: 0.05, emissiveIntensity: 1.2 }"
    :chassis-material="{ metalness: 0.9, roughness: 0.4 }"
    :nodes="{ sCDUJzdvWbkmEnT_67: { rotation: lid } }"
  />
</template>