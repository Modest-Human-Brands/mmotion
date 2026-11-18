/** Reading a user's video in the browser: frames, contact sheets, audio and crops. */

export interface Frame {
  /** 1-based number shown on the contact sheet. */
  n: number
  /** Seconds into the video. */
  at: number
  image: Blob
  width: number
  height: number
}

export interface VideoInfo {
  duration: number
  width: number
  height: number
}

const FRAME_EDGE = 1024

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'auto'
    video.playsInline = true
    video.onloadeddata = () => resolve(video)
    video.onerror = () => reject(new Error('This video cannot be read by the browser.'))
    video.src = url
  })
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    video.onseeked = () => resolve()
    video.currentTime = time
  })
}

const toBlob = (canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.88) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))),
      type,
      quality,
    ),
  )

function fit(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** Evenly spaced frames, one every `spacing` seconds (at most `max`). */
export async function sampleFrames(
  file: Blob,
  options: { spacing?: number; max?: number } = {},
): Promise<{ info: VideoInfo; frames: Frame[] }> {
  const url = URL.createObjectURL(file)
  try {
    const video = await loadVideo(url)
    const info = { duration: video.duration, width: video.videoWidth, height: video.videoHeight }
    const count = Math.max(
      1,
      Math.min(options.max ?? 36, Math.floor(info.duration / (options.spacing ?? 4))),
    )
    const size = fit(info.width, info.height, FRAME_EDGE)
    const canvas = document.createElement('canvas')
    Object.assign(canvas, size)
    const context = canvas.getContext('2d')!
    const frames: Frame[] = []
    for (let index = 0; index < count; index++) {
      const at = ((index + 0.5) / count) * info.duration
      await seek(video, at)
      context.drawImage(video, 0, 0, size.width, size.height)
      frames.push({ n: index + 1, at, image: await toBlob(canvas), ...size })
    }
    return { info, frames }
  } finally {
    URL.revokeObjectURL(url)
  }
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

/** Frames tiled into numbered grids, so a vision model sees the whole video in a few images. */
export async function contactSheets(frames: Frame[], perSheet = 9): Promise<Blob[]> {
  const sheets: Blob[] = []
  for (let start = 0; start < frames.length; start += perSheet) {
    const group = frames.slice(start, start + perSheet)
    const columns = Math.ceil(Math.sqrt(perSheet))
    const rows = Math.ceil(group.length / columns)
    const first = group[0]!
    const cell = fit(first.width, first.height, 1536 / columns)
    const canvas = document.createElement('canvas')
    canvas.width = cell.width * columns
    canvas.height = cell.height * rows
    const context = canvas.getContext('2d')!
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    for (const [index, frame] of group.entries()) {
      const x = (index % columns) * cell.width
      const y = Math.floor(index / columns) * cell.height
      const bitmap = await createImageBitmap(frame.image)
      context.drawImage(bitmap, x, y, cell.width, cell.height)
      bitmap.close()
      const label = `#${frame.n} ${clock(frame.at)}`
      context.font = `bold ${Math.round(cell.width / 11)}px sans-serif`
      const pad = cell.width / 40
      const metrics = context.measureText(label)
      context.fillStyle = 'rgba(0,0,0,0.75)'
      context.fillRect(x, y, metrics.width + pad * 2, cell.width / 11 + pad * 2)
      context.fillStyle = '#fff'
      context.textBaseline = 'top'
      context.fillText(label, x + pad, y + pad)
      context.strokeStyle = '#000'
      context.strokeRect(x, y, cell.width, cell.height)
    }
    sheets.push(await toBlob(canvas, 'image/jpeg', 0.85))
  }
  return sheets
}

/** The video's soundtrack, decoded (null when it has none). */
export async function decodeSoundtrack(file: Blob): Promise<AudioBuffer | null> {
  try {
    const context = new OfflineAudioContext(1, 1, 16_000)
    return await context.decodeAudioData(await file.arrayBuffer())
  } catch {
    return null
  }
}

/** Mono 16-bit WAV of `buffer` between `from` and `to` seconds, resampled to `rate`. */
export async function toWav(
  buffer: AudioBuffer,
  rate: number,
  from = 0,
  to = buffer.duration,
): Promise<Blob> {
  const length = Math.max(1, Math.ceil((to - from) * rate))
  const context = new OfflineAudioContext(1, length, rate)
  const source = context.createBufferSource()
  source.buffer = buffer
  source.connect(context.destination)
  source.start(0, from, to - from)
  const samples = (await context.startRendering()).getChannelData(0)
  const data = new DataView(new ArrayBuffer(44 + samples.length * 2))
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++)
      data.setUint8(offset + index, value.charCodeAt(index))
  }
  text(0, 'RIFF')
  data.setUint32(4, 36 + samples.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  data.setUint32(16, 16, true)
  data.setUint16(20, 1, true)
  data.setUint16(22, 1, true)
  data.setUint32(24, rate, true)
  data.setUint32(28, rate * 2, true)
  data.setUint16(32, 2, true)
  data.setUint16(34, 16, true)
  text(36, 'data')
  data.setUint32(40, samples.length * 2, true)
  samples.forEach((sample, index) =>
    data.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true),
  )
  return new Blob([data], { type: 'audio/wav' })
}

export interface Word {
  word: string
  start: number
  end: number
}

/** Transcript with a time mark every ~10 s, so the model can line words up with frames. */
export function timedTranscript(words: Word[], every = 10): string {
  let mark = -Infinity
  return words
    .map((word) => {
      if (word.start - mark < every) return word.word
      mark = word.start
      return `\n[${clock(word.start)}] ${word.word}`
    })
    .join(' ')
    .trim()
}

/**
 * A stretch of continuous speech of about `length` seconds (for voice cloning): starts at a word,
 * ends at a word, avoids long pauses.
 */
export function speechWindow(
  words: Word[],
  length = 10,
): { from: number; to: number; text: string } | null {
  for (let first = 0; first < words.length; first++) {
    const picked: Word[] = []
    for (let index = first; index < words.length; index++) {
      const word = words[index]!
      const previous = picked.at(-1)
      if (previous && word.start - previous.end > 0.8) break
      picked.push(word)
      if (word.end - words[first]!.start >= length) break
    }
    const span = picked.length ? picked.at(-1)!.end - picked[0]!.start : 0
    if (span >= Math.min(6, length)) {
      return {
        from: Math.max(0, picked[0]!.start - 0.1),
        to: picked.at(-1)!.end + 0.15,
        text: picked.map((word) => word.word).join(' '),
      }
    }
  }
  return null
}

/** Pixel rectangle for a vision model's `[y0, x0, y1, x1]` box on a 0–1000 scale, padded. */
export function boxToRect(
  box: number[],
  width: number,
  height: number,
  padding = 0.04,
): { x: number; y: number; width: number; height: number } | null {
  if (box.length !== 4) return null
  const [y0, x0, y1, x1] = box.map((value) => Math.min(1000, Math.max(0, value)) / 1000) as [
    number,
    number,
    number,
    number,
  ]
  if (y1 - y0 < 0.03 || x1 - x0 < 0.03) return null
  const left = Math.max(0, x0 - padding) * width
  const top = Math.max(0, y0 - padding) * height
  const right = Math.min(1, x1 + padding) * width
  const bottom = Math.min(1, y1 + padding) * height
  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  }
}

export async function crop(
  image: Blob,
  rect: { x: number; y: number; width: number; height: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(image)
  const canvas = document.createElement('canvas')
  canvas.width = rect.width
  canvas.height = rect.height
  canvas
    .getContext('2d')!
    .drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height)
  bitmap.close()
  return toBlob(canvas, 'image/png')
}