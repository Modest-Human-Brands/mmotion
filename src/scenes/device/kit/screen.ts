import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import type { ScreenFitMode, TextureTransform } from '@/domain/animation/types'

import type { MediaFrameSource } from '../mediaSource'

const gltfLoader = new GLTFLoader()
const modelCache = new Map<string, Promise<THREE.Group>>()

export function loadModel(url: string): Promise<THREE.Group> {
  let pending = modelCache.get(url)
  if (!pending) {
    pending = gltfLoader.loadAsync(url).then((gltf) => gltf.scene)
    modelCache.set(url, pending)
    pending.catch(() => modelCache.delete(url))
  }
  return pending
}

/** Width / height of the screen as laid out in UV space, so media is never stretched. */
export function screenAspect(mesh: THREE.Mesh): number {
  const geo = mesh.geometry
  if (!geo.attributes.position || !geo.attributes.uv) return 16 / 10
  const pos = geo.attributes.position as THREE.BufferAttribute
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const idx = geo.index
  const tris = Math.min(idx ? idx.count / 3 : pos.count / 3, 20)
  let uDist = 0
  let vDist = 0
  let count = 0
  const pA = new THREE.Vector3()
  const pB = new THREE.Vector3()
  const pC = new THREE.Vector3()
  const uvA = new THREE.Vector2()
  const uvB = new THREE.Vector2()
  const uvC = new THREE.Vector2()
  for (let i = 0; i < tris; i++) {
    const iA = idx ? idx.getX(i * 3) : i * 3
    const iB = idx ? idx.getX(i * 3 + 1) : i * 3 + 1
    const iC = idx ? idx.getX(i * 3 + 2) : i * 3 + 2
    pA.fromBufferAttribute(pos, iA)
    pB.fromBufferAttribute(pos, iB)
    pC.fromBufferAttribute(pos, iC)
    uvA.fromBufferAttribute(uv, iA)
    uvB.fromBufferAttribute(uv, iB)
    uvC.fromBufferAttribute(uv, iC)
    const du1 = uvB.x - uvA.x
    const dv1 = uvB.y - uvA.y
    const du2 = uvC.x - uvA.x
    const dv2 = uvC.y - uvA.y
    const det = du1 * dv2 - du2 * dv1
    if (Math.abs(det) > 1e-4) {
      const dp1 = new THREE.Vector3().subVectors(pB, pA)
      const dp2 = new THREE.Vector3().subVectors(pC, pA)
      uDist += dp1
        .clone()
        .multiplyScalar(dv2)
        .sub(dp2.clone().multiplyScalar(dv1))
        .divideScalar(det)
        .length()
      vDist += dp2
        .clone()
        .multiplyScalar(du1)
        .sub(dp1.clone().multiplyScalar(du2))
        .divideScalar(det)
        .length()
      count++
    }
  }
  if (count > 0 && vDist > 0) return uDist / vDist
  if (!geo.boundingBox) geo.computeBoundingBox()
  const s = geo.boundingBox!.getSize(new THREE.Vector3())
  const sorted = [s.x, s.y, s.z].sort((a, b) => b - a)
  return (sorted[0] ?? 16) / (sorted[1] ?? 10)
}

export function screenCanvasSize(aspect: number, mobile: boolean): [number, number] {
  const max = mobile ? 1024 : 2048
  return aspect < 1
    ? [Math.max(2, Math.round(max * aspect)), max]
    : [max, Math.max(2, Math.round(max / aspect))]
}

export function paintScreen(
  canvas: HTMLCanvasElement,
  source: MediaFrameSource | null,
  fit: ScreenFitMode,
) {
  const context = canvas.getContext('2d')
  if (!context) return
  const { width, height } = canvas
  context.fillStyle = fit === 'fit' ? '#000000' : '#111827'
  context.fillRect(0, 0, width, height)
  if (!source || !source.width || !source.height) return
  if (fit === 'stretch') {
    context.drawImage(source.drawable, 0, 0, width, height)
    return
  }
  const scale =
    fit === 'cover'
      ? Math.max(width / source.width, height / source.height)
      : Math.min(width / source.width, height / source.height)
  const w = source.width * scale
  const h = source.height * scale
  context.drawImage(source.drawable, (width - w) / 2, (height - h) / 2, w, h)
}

export function applyTextureTransform(
  texture: THREE.Texture,
  transform: TextureTransform | undefined,
  mobile: boolean,
) {
  const flipX = transform?.flipX ?? false
  const flipY = transform?.flipY ?? false
  const center = transform?.center ?? [0.5, 0.5]
  texture.center.set(center[0], center[1])
  texture.rotation = transform?.rotation ?? 0
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(
    (transform?.repeat?.[0] ?? 1) * (flipX ? -1 : 1),
    (transform?.repeat?.[1] ?? 1) * (flipY ? -1 : 1),
  )
  if (transform?.offset) texture.offset.set(transform.offset[0], transform.offset[1])
  texture.anisotropy = mobile ? 2 : 16
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
}