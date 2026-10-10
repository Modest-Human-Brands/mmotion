<script setup lang="ts">
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { computed, onBeforeUnmount, shallowRef, watch, watchEffect } from 'vue'

import type {
  MaterialProperties,
  ScreenFitMode,
  TextureTransform,
  Vector3Tuple,
} from '@/domain/animation/types'
import { mediaKind } from '@/domain/media'

import { loadMediaSource, type MediaFrameSource } from '../mediaSource'
import { useSceneContext } from './context'
import {
  applyTextureTransform,
  loadModel,
  paintScreen,
  screenAspect,
  screenCanvasSize,
} from './screen'

interface NodeOffset {
  position?: readonly number[]
  rotation?: readonly number[]
}

const props = withDefaults(
  defineProps<{
    model: string
    /** Substring of the mesh, material or texture name that is the display. */
    screen?: string
    /** Substring of the body mesh/material name, or `*` for every other mesh. */
    chassis?: string
    position?: readonly number[]
    rotation?: readonly number[]
    scale?: number
    /** Fit the model into a ~2.4 unit box. */
    autoScale?: boolean
    autoCenter?: boolean
    /** Media for this device's screen; defaults to the template's screen media. */
    media?: string
    fit?: ScreenFitMode
    screenTransform?: TextureTransform
    screenMaterial?: MaterialProperties
    /** Body material. A `color` here is fixed; otherwise the user's body colour is used. */
    chassisMaterial?: MaterialProperties
    /** Offsets added to named nodes (e.g. a laptop lid hinge), keyed by node name. */
    nodes?: Record<string, NodeOffset>
  }>(),
  {
    position: () => [0, 0, 0],
    rotation: () => [0, 0, 0],
    scale: 1,
    autoScale: true,
    autoCenter: true,
    fit: 'cover',
  },
)

const scene = useSceneContext()
const group = shallowRef<THREE.Group | null>(null)

interface ScreenEntry {
  canvas: HTMLCanvasElement
  texture: THREE.CanvasTexture
  material: THREE.MeshStandardMaterial
}

const screens: ScreenEntry[] = []
const chassisMaterials: THREE.MeshStandardMaterial[] = []
const initial = new Map<string, { position: THREE.Vector3; rotation: THREE.Euler }>()

const media = computed(() => props.media ?? scene.screenMedia.value)
const bodyColor = computed(
  () => props.chassisMaterial?.color ?? scene.chassisColor.value ?? '#242426',
)

function matches(mesh: THREE.Mesh, needle: string): boolean {
  const material = mesh.material as THREE.MeshStandardMaterial
  return (
    (mesh.name || '').includes(needle) ||
    (material?.name || '').includes(needle) ||
    (material?.map?.name || '').includes(needle)
  )
}

async function build() {
  const base = await loadModel(props.model)
  const model = SkeletonUtils.clone(base) as THREE.Group

  const box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const target = (props.autoScale ? 2.4 / (Math.max(size.x, size.y, size.z) || 1) : 1) * props.scale
  if (props.autoCenter)
    model.position.set(-center.x * target, -center.y * target, -center.z * target)
  model.scale.setScalar(target)

  model.traverse((child) => {
    initial.set(child.name, { position: child.position.clone(), rotation: child.rotation.clone() })
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry?.computeVertexNormals()

    if (props.screen && matches(mesh, props.screen)) {
      const canvas = document.createElement('canvas')
      ;[canvas.width, canvas.height] = screenCanvasSize(screenAspect(mesh), scene.isMobile)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      applyTextureTransform(texture, props.screenTransform, scene.isMobile)
      const material = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0xffffff,
        emissiveMap: texture,
        emissiveIntensity: props.screenMaterial?.emissiveIntensity ?? 1.2,
        roughness: props.screenMaterial?.roughness ?? 0.05,
        metalness: 0,
      })
      mesh.material = material
      screens.push({ canvas, texture, material })
    } else if (props.chassis === '*' || (props.chassis && matches(mesh, props.chassis))) {
      const material = new THREE.MeshStandardMaterial({
        color: bodyColor.value,
        metalness: props.chassisMaterial?.metalness ?? 0.85,
        roughness: props.chassisMaterial?.roughness ?? 0.25,
      })
      mesh.material = material
      chassisMaterials.push(material)
    }
  })

  const wrapper = new THREE.Group()
  wrapper.add(model)
  group.value = wrapper
}

scene.track(build())

watch(bodyColor, (color) => chassisMaterials.forEach((material) => material.color.set(color)))

let source: MediaFrameSource | null = null
let unregisterTime: (() => void) | null = null

function repaint() {
  for (const entry of screens) {
    paintScreen(entry.canvas, source, props.fit)
    entry.texture.needsUpdate = true
  }
}

async function loadMedia(url: string) {
  unregisterTime?.()
  unregisterTime = null
  source?.dispose()
  source = null
  if (url) {
    try {
      source = await loadMediaSource(url)
    } catch {
      source = null
    }
  }
  if (url !== media.value) return
  // Stills are painted once; only video and Rive need repainting as time moves.
  if (source && mediaKind(url) !== 'image') {
    const timed = source
    unregisterTime = scene.registerTimeSource({
      async seek(seconds) {
        await timed.seek(seconds)
        repaint()
      },
    })
    await timed.seek(scene.seconds.value)
  }
  repaint()
}

watch(
  [media, group],
  ([url, ready]) => {
    if (ready) scene.track(loadMedia(url))
  },
  { immediate: true },
)
watch(() => props.fit, repaint)

watchEffect(() => {
  const root = group.value
  if (!root || !props.nodes) return
  for (const [name, offset] of Object.entries(props.nodes)) {
    const node = root.getObjectByName(name)
    const start = initial.get(name)
    if (!node || !start) continue
    if (offset.rotation) {
      const [x = 0, y = 0, z = 0] = offset.rotation
      node.rotation.set(start.rotation.x + x, start.rotation.y + y, start.rotation.z + z)
    }
    if (offset.position) {
      const [x = 0, y = 0, z = 0] = offset.position
      node.position.set(start.position.x + x, start.position.y + y, start.position.z + z)
    }
  }
})

const position = computed(() => [...props.position] as Vector3Tuple)
const rotation = computed(() => [...props.rotation] as Vector3Tuple)

onBeforeUnmount(() => {
  unregisterTime?.()
  source?.dispose()
  for (const entry of screens) {
    entry.texture.dispose()
    entry.material.dispose()
  }
  chassisMaterials.forEach((material) => material.dispose())
})
</script>

<template>
  <primitive v-if="group" :object="group" :position="position" :rotation="rotation" />
</template>