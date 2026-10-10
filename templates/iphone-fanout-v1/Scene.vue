<script setup lang="ts">
import Device from '@/components/studio/scene/Device.vue'
import SceneCamera from '@/components/studio/scene/SceneCamera.vue'
import SceneLights from '@/components/studio/scene/SceneLights.vue'
import { useTrack } from '@/components/studio/scene/context'

// Authored at 60 fps over 300 frames: five phones rise together (0-50), then fan out (60-120).
const FLIP = Math.PI

const phones = [
  { name: 'center', end: [0, 0, 0.4], turn: 0 },
  { name: 'mid-left', end: [-1.4, 0, 0.1], turn: 0.1 },
  { name: 'far-left', end: [-2.8, 0, -0.2], turn: 0.18 },
  { name: 'mid-right', end: [1.4, 0, 0.1], turn: -0.1 },
  { name: 'far-right', end: [2.8, 0, -0.2], turn: -0.18 },
].map((phone) => ({
  ...phone,
  position: useTrack([
    { frame: 0, value: [0, -5, 0], easing: 'easeOutExpo' },
    { frame: 50, value: [0, 0, 0] },
    { frame: 60, value: [0, 0, 0], easing: 'easeInOutCubic' },
    { frame: 120, value: phone.end },
  ]),
  rotation: useTrack([
    { frame: 0, value: [0.4, FLIP, 0], easing: 'easeOutExpo' },
    { frame: 50, value: [0, FLIP, 0] },
    { frame: 60, value: [0, FLIP, 0], easing: 'easeInOutCubic' },
    { frame: 120, value: [0, FLIP + phone.turn, 0] },
  ]),
}))
</script>

<template>
  <SceneCamera :position="[0, 0, 7]" :fov="34" />
  <SceneLights />
  <Device
    v-for="phone in phones"
    :key="phone.name"
    model="/models/apple-iphone-15-pro-max-black.glb"
    screen="pIJKfZsazmcpEiU"
    chassis="oZRkkORNzkufnGD"
    :position="phone.position.value"
    :rotation="phone.rotation.value"
    :screen-material="{ roughness: 0.1 }"
    :chassis-material="{ metalness: 0.85, roughness: 0.25 }"
  />
</template>