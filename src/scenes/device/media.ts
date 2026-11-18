export type MediaKind = 'image' | 'video' | 'rive'

const KIND_FRAGMENT = /#kind=(image|video|rive)$/

export function mediaKind(url: string): MediaKind {
  const tagged = KIND_FRAGMENT.exec(url)
  if (tagged) return tagged[1] as MediaKind
  const path = url.split(/[?#]/)[0]!.toLowerCase()
  if (path.endsWith('.riv')) return 'rive'
  if (/\.(mp4|webm|mov)$/.test(path)) return 'video'
  return 'image'
}