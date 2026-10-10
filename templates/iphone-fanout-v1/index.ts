import { defineMotionTemplate } from '../motion'
import Scene from './Scene.vue'
import thumbnail from './thumbnail.png'

export default defineMotionTemplate({
  id: 'iphone-fanout-v1',
  label: 'iPhone Fanout',
  shortLabel: 'iPhone Fanout',
  category: 'Multi-device',
  description:
    'Five iPhones rise from below and fan out side by side, each showing your screen media.',
  resolution: { width: 3840, height: 2160, aspectRatio: '16 / 9', fps: 60, durationFrames: 300 },
  thumbnail,
  scene: Scene,
  defaults: { screenMedia: '/textures/preview-1.jpg', cameraFov: 34, background: 'studio' },
})