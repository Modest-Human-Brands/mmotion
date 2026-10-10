import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_VERY_HIGH,
  WebMOutputFormat,
  canEncodeVideo,
} from 'mediabunny'

export type VideoQuality = 'medium' | 'high' | 'very-high'

const QUALITY = {
  medium: QUALITY_MEDIUM,
  high: QUALITY_HIGH,
  'very-high': QUALITY_VERY_HIGH,
} as const

export interface VideoExportOptions {
  /** Pixel size of the encoded video. Made even, as H.264 requires. */
  width: number
  height: number
  fps: number
  totalFrames: number
  quality?: VideoQuality
  /** Paint frame `index` onto `canvas`. Must be deterministic and resolve once drawn. */
  drawFrame: (index: number, canvas: HTMLCanvasElement) => Promise<void>
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

export interface VideoExportResult {
  blob: Blob
  extension: 'mp4' | 'webm'
  codec: 'avc' | 'vp9'
}

const even = (value: number) => Math.max(2, Math.round(value / 2) * 2)

export class ExportCancelled extends Error {
  constructor() {
    super('Export cancelled.')
    this.name = 'ExportCancelled'
  }
}

async function pickCodec(width: number, height: number): Promise<'avc' | 'vp9'> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('This browser cannot encode video. Use a recent Chrome, Edge or Safari.')
  }
  if (await canEncodeVideo('avc', { width, height })) return 'avc'
  if (await canEncodeVideo('vp9', { width, height })) return 'vp9'
  throw new Error(`This browser cannot encode ${width} × ${height} video. Try a lower resolution.`)
}

export async function exportVideo(options: VideoExportOptions): Promise<VideoExportResult> {
  const { fps, totalFrames, drawFrame, onProgress, signal, quality = 'high' } = options
  const width = even(options.width)
  const height = even(options.height)
  const codec = await pickCodec(width, height)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const target = new BufferTarget()
  const output = new Output({
    format:
      codec === 'avc' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
    target,
  })
  const source = new CanvasSource(canvas, { codec, bitrate: QUALITY[quality] })
  output.addVideoTrack(source, { frameRate: fps })
  await output.start()

  const frameDuration = 1 / fps
  try {
    for (let index = 0; index < totalFrames; index++) {
      if (signal?.aborted) throw new ExportCancelled()
      await drawFrame(index, canvas)
      await source.add(index * frameDuration, frameDuration)
      onProgress?.((index + 1) / totalFrames)
    }
    source.close()
    await output.finalize()
  } catch (error) {
    await output.cancel().catch(() => {})
    throw error
  }

  const extension = codec === 'avc' ? 'mp4' : 'webm'
  return {
    blob: new Blob([target.buffer!], { type: codec === 'avc' ? 'video/mp4' : 'video/webm' }),
    extension,
    codec,
  }
}