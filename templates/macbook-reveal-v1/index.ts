import { defineMotionTemplate } from '../motion'
import Scene from './Scene.vue'
import thumbnail from './thumbnail.png'

export default defineMotionTemplate({
  id: 'macbook-reveal-v1',
  label: 'MacBook Platform Reveal',
  shortLabel: 'MacBook Reveal',
  category: 'Laptop',
  description:
    'A MacBook Pro rises onto the platform, opens its lid, holds on your screen media, then exits toward the camera.',
  resolution: { width: 3840, height: 2160, aspectRatio: '16 / 9', fps: 60, durationFrames: 360 },
  thumbnail,
  scene: Scene,
  defaults: {
    screenMedia: '/textures/01-Dashboard.jpg',
    chassisColor: '#535150',
    cameraFov: 45,
    background: 'studio',
  },
})