import { defineMotionTemplate } from '../motion'
import Scene from './Scene.vue'
import thumbnail from './thumbnail.png'

export default defineMotionTemplate({
  id: 'iphone-helix-v1',
  label: 'iPhone Helix Showcase',
  shortLabel: 'iPhone Helix',
  category: 'Phone',
  description:
    'A single iPhone spirals up in a helix, settles face-on to show your screen, then spins away. Square 1:1 frame.',
  resolution: { width: 2160, height: 2160, aspectRatio: '1 / 1', fps: 60, durationFrames: 540 },
  thumbnail,
  scene: Scene,
  defaults: { screenMedia: '/textures/preview-1.jpg', cameraFov: 34, background: 'studio' },
})