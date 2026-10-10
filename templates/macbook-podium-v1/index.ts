import { defineMotionTemplate } from '../motion'
import Scene from './Scene.vue'
import thumbnail from './thumbnail.png'

export default defineMotionTemplate({
  id: 'macbook-podium-v1',
  label: 'MacBook Podium Showcase',
  shortLabel: 'MacBook Podium',
  category: 'Laptop',
  description:
    'A MacBook Pro on a lit podium with a slow push-in, soft contact shadows and a gentle bloom.',
  resolution: { width: 3840, height: 2160, aspectRatio: '16 / 9', fps: 60, durationFrames: 360 },
  thumbnail,
  scene: Scene,
  defaults: {
    screenMedia: '/textures/01-Dashboard.jpg',
    chassisColor: '#121316',
    cameraFov: 32,
    background: 'studio',
  },
  bloom: { intensity: 0.3, luminanceThreshold: 0.95, luminanceSmoothing: 0.2, mipmapBlur: true },
})