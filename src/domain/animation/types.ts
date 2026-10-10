export type ScreenFitMode = 'fit' | 'cover' | 'stretch'

export type Vector3Tuple = [x: number, y: number, z: number]
export type Vector2Tuple = [x: number, y: number]

export interface DirectionalLightConfig {
  position: Vector3Tuple
  intensity: number
  color?: string
}

export interface BloomConfig {
  intensity?: number
  luminanceThreshold?: number
  luminanceSmoothing?: number
  mipmapBlur?: boolean
}

export interface TextureTransform {
  rotation?: number
  flipX?: boolean
  flipY?: boolean
  offset?: Vector2Tuple
  repeat?: Vector2Tuple
  center?: Vector2Tuple
}

export interface MaterialProperties {
  color?: string
  metalness?: number
  roughness?: number
  emissive?: string
  emissiveIntensity?: number
  toneMapped?: boolean
  transparent?: boolean
  opacity?: number
}

export interface BackgroundConfig {
  type: 'shader' | 'solid'
  preset?: string
  colorA: string
  colorB: string
}