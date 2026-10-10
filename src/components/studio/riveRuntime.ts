import RiveFactory, {
  type Artboard,
  type LinearAnimationInstance,
  type RiveCanvas,
  type StateMachineInstance,
} from '@rive-app/webgl2-advanced'
import riveWasmUrl from '@rive-app/webgl2-advanced/rive.wasm?url'

import type { MediaFrameSource } from './mediaSource'

const STEP = 1 / 60

let runtime: Promise<RiveCanvas> | null = null

/** The WASM is bundled with the app, so nothing is fetched from a CDN. */
function getRive(): Promise<RiveCanvas> {
  runtime ??= RiveFactory({ locateFile: () => riveWasmUrl })
  return runtime
}

/**
 * Plays a .riv file as a seekable frame source. Uses the low-level API so the
 * clock is ours: `seek(t)` always shows exactly time `t`, in preview and export.
 */
export async function createRiveSource(url: string): Promise<MediaFrameSource> {
  const rive = await getRive()
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
  const file = await rive.load(bytes)

  const canvas = document.createElement('canvas')
  const renderer = rive.makeRenderer(canvas, true)

  let artboard: Artboard
  let animation: LinearAnimationInstance | null = null
  let machine: StateMachineInstance | null = null
  let machineTime = 0

  function build() {
    animation?.delete()
    machine?.delete()
    artboard?.delete()
    artboard = file.defaultArtboard()
    animation = null
    machine = null
    machineTime = 0
    if (artboard.animationCount() > 0) {
      animation = new rive.LinearAnimationInstance(artboard.animationByIndex(0), artboard)
    } else if (artboard.stateMachineCount() > 0) {
      machine = new rive.StateMachineInstance(artboard.stateMachineByIndex(0), artboard)
    }
  }
  build()

  const bounds = artboard!.bounds
  const width = Math.max(2, Math.round(bounds.maxX - bounds.minX))
  const height = Math.max(2, Math.round(bounds.maxY - bounds.minY))
  canvas.width = width
  canvas.height = height

  function draw() {
    renderer.save()
    renderer.align(
      rive.Fit.contain,
      rive.Alignment.center,
      { minX: 0, minY: 0, maxX: width, maxY: height },
      artboard.bounds,
    )
    artboard.draw(renderer)
    renderer.restore()
    renderer.flush()
  }

  return {
    width,
    height,
    drawable: canvas,
    async seek(seconds) {
      if (animation) {
        const length = animation.duration / (animation.fps || 1)
        animation.time =
          length > 0 ? animation.workStart / (animation.fps || 1) + (seconds % length) : 0
        animation.apply(1)
        artboard.advance(0)
      } else if (machine) {
        // State machines are stateful: replay from the start whenever time moves backwards.
        if (seconds < machineTime) build()
        while (machineTime < seconds - 1e-9) {
          const dt = Math.min(STEP, seconds - machineTime)
          machine!.advanceAndApply(dt)
          machineTime += dt
        }
      } else {
        artboard.advance(0)
      }
      draw()
    },
    dispose() {
      animation?.delete()
      machine?.delete()
      artboard.delete()
      renderer.delete?.()
    },
  }
}