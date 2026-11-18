import { getFontEmbedCSS, toSvg } from 'html-to-image'

/** Embed the fonts an element uses once, so per-frame rasterization never refetches them. */
export async function prepareFonts(element: HTMLElement): Promise<string> {
  await document.fonts.ready
  try {
    return await getFontEmbedCSS(element)
  } catch {
    return ''
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not render this frame.'))
    image.src = url
  })
}

/**
 * Rasterize `element` (laid out at `width` × `height` design pixels) onto `canvas`.
 * `toSvg` plus our own image load avoids html-to-image's `toCanvas`, which waits on two
 * animation frames per call: slow, and it never resolves while the tab is in the background.
 */
export async function drawElement(
  canvas: HTMLCanvasElement,
  element: HTMLElement,
  width: number,
  height: number,
  fontEmbedCSS: string,
) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not initialise a canvas.')
  const svg = await toSvg(element, {
    width,
    height,
    cacheBust: false,
    fontEmbedCSS,
    style: { transform: 'none', transformOrigin: 'top left' },
  })
  const frame = await loadImage(svg)
  context.drawImage(frame, 0, 0, canvas.width, canvas.height)
}