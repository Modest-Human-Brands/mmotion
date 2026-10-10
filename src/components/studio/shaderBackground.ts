import type { BackgroundConfig } from '@/domain/animation/types'
import { hexToHsl, hslToHex } from '@/domain/proceduralGradient'

export interface ShaderBackgroundHandle {
  /** Always a 2D canvas holding the latest rendered frame (GPU output is snapshotted into it). */
  readonly canvas: HTMLCanvasElement
  /** Bumped whenever `canvas` is resized, so textures built from it can be reallocated. */
  readonly sizeVersion: number
  seek(seconds: number): Promise<void>
  update(config: BackgroundConfig): void
  /**
   * Give the GPU canvas a home in the page. The shader renderer sizes itself from the
   * element's layout and visibility, so it must live in the document: off-screen or
   * detached canvases collapse to 1×1. Place it behind the 3D canvas.
   */
  attach(host: HTMLElement): void
  dispose(): void
}

type Preset = { components: { type: string; props: Record<string, unknown> }[] }

/** Backgrounds that do not change over time: rendered once, never per frame. */
export const isStaticBackground = (config: BackgroundConfig) =>
  config.type === 'solid' || config.preset === 'studio'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Near-grey brand colours make muddy gradients, so they borrow a default hue. */
function vivid(hex: string, fallbackHue: number, lightness: [number, number]): string {
  const [h, s, l] = hexToHsl(hex)
  const grey = s < 12
  return hslToHex(grey ? fallbackHue : h, grey ? 70 : clamp(s, 45, 90), clamp(l, ...lightness))
}

/** A pale tint of a colour, for studio walls and lights. */
function tint(hex: string, saturation: number, lightness: number): string {
  const [h, s] = hexToHsl(hex)
  return hslToHex(h, Math.min(s, saturation), lightness)
}

function presetFor(config: BackgroundConfig): Preset {
  const { colorA, colorB } = config
  switch (config.preset) {
    case 'studio':
      return {
        components: [
          {
            type: 'StudioBackground',
            props: {
              color: tint(colorA, 18, 86),
              keyColor: tint(colorB, 35, 93),
              fillColor: tint(colorA, 25, 90),
              backColor: tint(colorB, 30, 84),
              ambientIntensity: 0,
            },
          },
        ],
      }
    case 'plasma':
      return {
        components: [
          {
            type: 'Plasma',
            props: { colorA: vivid(colorA, 250, [18, 40]), colorB: vivid(colorB, 20, [50, 68]) },
          },
        ],
      }
    case 'aurora':
      return {
        components: [
          {
            type: 'Aurora',
            props: {
              colorA: vivid(colorA, 250, [20, 45]),
              colorB: vivid(colorB, 180, [50, 70]),
              colorC: vivid(colorB, 300, [40, 60]),
            },
          },
        ],
      }
    default:
      return {
        components: [
          {
            type: 'MeshGradient',
            props: { colorA: vivid(colorA, 250, [25, 50]), colorB: vivid(colorB, 20, [55, 72]) },
          },
        ],
      }
  }
}

function paintFallback(canvas: HTMLCanvasElement, config: BackgroundConfig) {
  const context = canvas.getContext('2d')
  if (!context) return
  const { width, height } = canvas
  if (config.type === 'solid') {
    context.fillStyle = config.colorA
    context.fillRect(0, 0, width, height)
    return
  }
  const light = config.preset === 'studio'
  const inner = light ? tint(config.colorB, 35, 93) : vivid(config.colorB, 20, [55, 72])
  const outer = light ? tint(config.colorA, 18, 80) : vivid(config.colorA, 250, [20, 40])
  const gradient = context.createRadialGradient(
    width / 2,
    height * 0.4,
    0,
    width / 2,
    height / 2,
    Math.hypot(width, height) / 2,
  )
  gradient.addColorStop(0, inner)
  gradient.addColorStop(1, outer)
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)
}

/**
 * A time-seekable background. Uses the `shaders` frame-locked renderer (WebGPU)
 * when available and a static gradient otherwise. `size` should match the output
 * aspect ratio so the texture is never stretched.
 */
export function createShaderBackground(
  size: { width: number; height: number },
  initial: BackgroundConfig,
  /** Called when the picture changed on its own (e.g. the GPU canvas finally got its size). */
  onChange: () => void = () => {},
): ShaderBackgroundHandle {
  let config = initial
  const snapshot = document.createElement('canvas')
  snapshot.width = size.width
  snapshot.height = size.height

  let disposed = false
  let currentTime = 0
  let renderer: {
    renderFrame(options: { deltaSeconds: number; waitForGpu?: boolean }): Promise<void>
    updatePreset(preset: Preset): void
    dispose(): void
  } | null = null
  let gpuCanvas: HTMLCanvasElement | null = null
  let ready: Promise<void> | null = null
  let queue: Promise<void> = Promise.resolve()
  let attachTo: (host: HTMLElement) => void = () => {}
  const attached = new Promise<HTMLElement>((resolve) => (attachTo = resolve))
  // Shader pipelines compile asynchronously, so the first frames after a (re)build can be blank.
  let settling = true
  let renderedSize = ''
  let sizeVersion = 0
  // When the GPU canvas gets (or changes) its real size, redraw the current instant.
  const sizeWatch = setInterval(() => {
    if (!renderer || !gpuCanvas || gpuCanvas.width <= 2 || gpuCanvas.height <= 2) return
    if (`${gpuCanvas.width}x${gpuCanvas.height}` === renderedSize) return
    settling = true
    queue = queue.then(() => renderAt(currentTime)).then(onChange)
  }, 250)
  let presetKey = JSON.stringify(presetFor(config))

  paintFallback(snapshot, config)

  async function init() {
    if (!('gpu' in navigator)) return
    try {
      const { createRendererFromJSON } = await import('shaders/core')
      if (disposed) return
      gpuCanvas = document.createElement('canvas')
      // Start tiny: the renderer resizes it to the layout box, which is our cue that it is ready.
      gpuCanvas.width = 1
      gpuCanvas.height = 1
      gpuCanvas.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none'
      gpuCanvas.setAttribute('aria-hidden', 'true')
      ;(await attached).append(gpuCanvas)
      const created = createRendererFromJSON(presetFor(config))
      let failed = false
      created.setOnUnavailable(() => (failed = true))
      await created.initialize(gpuCanvas)
      if (disposed || failed) {
        created.dispose()
        gpuCanvas.remove()
        gpuCanvas = null
        return
      }
      renderer = created as typeof renderer
    } catch {
      renderer = null
    }
  }

  async function renderAt(seconds: number) {
    if (config.type === 'solid') {
      paintFallback(snapshot, config)
      return
    }
    ready ??= init()
    await ready
    if (!renderer || !gpuCanvas) {
      paintFallback(snapshot, config)
      return
    }
    // The renderer sizes its canvas on an animation frame after layout; until then it is 1×1
    // (and in a hidden tab it stays so). Show the gradient fallback rather than one flat pixel.
    if (gpuCanvas.width <= 2 || gpuCanvas.height <= 2) {
      paintFallback(snapshot, config)
      renderedSize = ''
      return
    }
    renderedSize = `${gpuCanvas.width}x${gpuCanvas.height}`
    // The renderer is frame-locked: it only advances by deltas, so seek by difference.
    await renderer.renderFrame({ deltaSeconds: seconds - currentTime, waitForGpu: false })
    currentTime = seconds
    copy()
    if (!settling) return
    // Repaint the same instant until the picture stops changing (pipelines finished compiling).
    let previous = fingerprint()
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      await renderer.renderFrame({ deltaSeconds: 0, waitForGpu: false })
      copy()
      const next = fingerprint()
      if (next === previous && !isFlat()) break
      previous = next
    }
    settling = false
  }

  function copy() {
    if (!gpuCanvas) return
    // Match the GPU canvas (which follows the on-screen size) instead of a fixed large
    // snapshot: uploading a big texture every frame was the main cost of animated backgrounds.
    if (snapshot.width !== gpuCanvas.width || snapshot.height !== gpuCanvas.height) {
      snapshot.width = gpuCanvas.width
      snapshot.height = gpuCanvas.height
      sizeVersion++
    }
    const context = snapshot.getContext('2d')
    context?.clearRect(0, 0, snapshot.width, snapshot.height)
    context?.drawImage(gpuCanvas, 0, 0)
  }

  const probes = [
    [0.5, 0.05],
    [0.5, 0.5],
    [0.5, 0.95],
    [0.05, 0.5],
    [0.95, 0.5],
  ] as const

  function samples(): number[] {
    const context = snapshot.getContext('2d', { willReadFrequently: true })
    if (!context) return []
    return probes.flatMap(([x, y]) =>
      Array.from(
        context
          .getImageData(
            Math.floor(x * (snapshot.width - 1)),
            Math.floor(y * (snapshot.height - 1)),
            1,
            1,
          )
          .data.slice(0, 3),
      ),
    )
  }

  const fingerprint = () => samples().join(',')

  /** A single colour everywhere means the shader has not produced a real frame yet. */
  function isFlat(): boolean {
    const values = samples()
    return values.every((value, index) => value === values[index % 3])
  }

  return {
    canvas: snapshot,
    get sizeVersion() {
      return sizeVersion
    },
    seek(seconds) {
      queue = queue.then(() => renderAt(seconds))
      return queue
    },
    update(next) {
      config = next
      const preset = presetFor(next)
      const key = JSON.stringify(preset)
      if (key === presetKey) return
      presetKey = key
      settling = true
      renderer?.updatePreset(preset)
      if (!renderer) paintFallback(snapshot, next)
    },
    attach(host) {
      attachTo(host)
    },
    dispose() {
      disposed = true
      clearInterval(sizeWatch)
      renderer?.dispose()
      renderer = null
      gpuCanvas?.remove()
    },
  }
}