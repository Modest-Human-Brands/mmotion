<script setup lang="ts">
import { ContactShadows } from '@tresjs/cientos'
import { useTresContext } from '@tresjs/core'
import * as THREE from 'three'
import { onMounted, shallowRef } from 'vue'

import type { Vector3Tuple } from '@/domain/animation/types'

import { useSceneContext } from './context'

const props = withDefaults(
  defineProps<{
    /** Omit position/scale to place the shadow under the scene once everything has loaded. */
    position?: Vector3Tuple
    scale?: number
    opacity?: number
    blur?: number
    far?: number
    color?: string
    resolution?: number
  }>(),
  { opacity: 0.85, blur: 2.2, far: 3.5, color: '#070b1e' },
)

const scene = useSceneContext()
const { scene: tresScene } = useTresContext()
const placement = shallowRef<{ position: Vector3Tuple; scale: number } | null>(
  props.position && props.scale ? { position: props.position, scale: props.scale } : null,
)

// Measured once, from the first frame's pose: recomputing per frame was a major cost.
onMounted(async () => {
  if (placement.value) return
  await scene.whenReady()
  const box = new THREE.Box3()
  tresScene.value.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && child.visible && !child.userData.contactShadow) {
      box.expandByObject(child)
    }
  })
  if (box.isEmpty()) return
  placement.value = {
    position: props.position ?? [
      (box.min.x + box.max.x) / 2,
      box.min.y - 0.005,
      (box.min.z + box.max.z) / 2,
    ],
    scale: props.scale ?? Math.max((box.max.x - box.min.x) * 1.6, (box.max.z - box.min.z) * 1.6, 3),
  }
})
</script>

<template>
  <ContactShadows
    v-if="placement"
    :position="placement.position"
    :scale="placement.scale"
    :opacity="opacity"
    :blur="blur"
    :far="far"
    :color="color"
    :resolution="resolution ?? (scene.isMobile ? 256 : 512)"
  />
</template>