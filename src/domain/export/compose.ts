import { getFontEmbedCSS, toSvg } from 'html-to-image'

export interface ComposeContext {
  width: number
  height: number
  /** Size of the design the overlay was laid out for (the template's output resolution). */
  designWidth: number
  designHeight: number
  scene: HTMLCanvasElement
  overlay: HTMLElement | null
  /** Fonts embedded once per export, so frames don't refetch them. */
  fontEmbedCSS: string
}

export async function prepareOverlay(overlay: HTMLElement | null): Promise<string> {
  if (!overlay) return ''
  await document.fonts.ready
  try {
    return await getFontEmbedCSS(overlay)
  } catch {
    return ''
  }
}

export async function composeFrame(canvas: HTMLCanvasElement, context: ComposeContext) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not initialise a canvas.')

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(context.scene, 0, 0, canvas.width, canvas.height)

  if (!context.overlay) return
  // `toSvg` + our own image load avoids html-to-image's `toCanvas`, which waits on two animation
  // frames per call: slow, and it never resolves while the tab is in the background.
  const svg = await toSvg(context.overlay, {
    width: context.designWidth,
    height: context.designHeight,
    cacheBust: false,
    fontEmbedCSS: context.fontEmbedCSS,
    style: { transform: 'none', transformOrigin: 'top left' },
  })
  const layer = await loadImage(svg)
  ctx.drawImage(layer, 0, 0, canvas.width, canvas.height)
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not render the title overlay.'))
    image.src = url
  })
}