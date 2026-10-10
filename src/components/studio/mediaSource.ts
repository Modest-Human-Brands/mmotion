import { mediaKind } from '@/domain/media'

/**
 * Anything that can paint a picture for a given point in time. Screen media
 * (image, video, Rive) all reduce to this so the 3D scene treats them alike.
 */
export interface MediaFrameSource {
  readonly width: number
  readonly height: number
  seek(seconds: number): Promise<void>
  readonly drawable: CanvasImageSource
  dispose(): void
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load the screen image.'))
    image.src = url
  })
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.onloadeddata = () => resolve(video)
    video.onerror = () => reject(new Error('Could not load the screen video.'))
    video.src = url
  })
}

function seekVideo(video: HTMLVideoElement, seconds: number): Promise<void> {
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0
  const target = duration ? seconds % duration : 0
  if (Math.abs(video.currentTime - target) < 1e-3) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done)
      resolve()
    }
    video.addEventListener('seeked', done)
    video.currentTime = target
  })
}

export async function loadMediaSource(url: string): Promise<MediaFrameSource> {
  switch (mediaKind(url)) {
    case 'video': {
      const video = await loadVideo(url)
      return {
        width: video.videoWidth,
        height: video.videoHeight,
        drawable: video,
        seek: (seconds) => seekVideo(video, seconds),
        dispose() {
          video.removeAttribute('src')
          video.load()
        },
      }
    }
    case 'rive': {
      const { createRiveSource } = await import('./riveRuntime')
      return createRiveSource(url)
    }
    default: {
      const image = await loadImage(url)
      return {
        width: image.naturalWidth,
        height: image.naturalHeight,
        drawable: image,
        seek: () => Promise.resolve(),
        dispose() {},
      }
    }
  }
}