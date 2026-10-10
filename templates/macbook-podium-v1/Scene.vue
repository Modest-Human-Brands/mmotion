<script setup lang="ts">
import Device from '@/components/studio/scene/Device.vue'
import SceneCamera from '@/components/studio/scene/SceneCamera.vue'
import SceneLights from '@/components/studio/scene/SceneLights.vue'
import SceneShadows from '@/components/studio/scene/SceneShadows.vue'
import { useTrack } from '@/components/studio/scene/context'

// Authored at 60 fps over 360 frames: a slow push-in while the lid opens on the podium.
const camera = useTrack([
  { frame: 0, value: [0, 1, 5.5], easing: 'easeOutCubic' },
  { frame: 360, value: [0, 1, 5] },
])

const lid = useTrack([
  { frame: 0, value: [1.75, 0, 0], easing: 'easeInOutSine' },
  { frame: 80, value: [0, 0, 0] },
])
</script>

<template>
  <SceneCamera :position="camera" :rotation="[-0.2, 0, 0]" :fov="32" />
  <SceneLights
    :ambient="0.9"
    :directional="[
      { position: [0, 7, 5], intensity: 2 },
      { position: [0, 4, -4], intensity: 2.4 },
      { position: [-5, 2, 3], intensity: 0.6 },
    ]"
  />
  <Device
    model="/models/apple-macbook-pro-m5-14-inch.glb"
    screen="HlQwFCAPWzetDQy"
    chassis="Body_Aluminum_Mesh"
    :position="[0, -0.15, 0]"
    :screen-transform="{ flipY: true }"
    :screen-material="{ roughness: 0.05, emissiveIntensity: 1.05 }"
    :chassis-material="{ metalness: 0.9, roughness: 0.28 }"
    :nodes="{ sCDUJzdvWbkmEnT_67: { rotation: lid } }"
  />
  <Device
    model="/models/podium-2.glb"
    chassis="*"
    :scale="7.5"
    :position="[0, 3.15, 2.5]"
    :chassis-material="{ color: '#ffffff', metalness: 0.04, roughness: 0.92 }"
  />
  <SceneShadows :opacity="0.9" :blur="2" />
</template>