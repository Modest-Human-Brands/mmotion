export type MediaKind = 'image' | 'video' | 'rive'

const KIND_FRAGMENT = /#kind=(image|video|rive)$/

/** Tag a blob/object URL with its media kind so it survives without a file extension. */
export function tagMediaUrl(url: string, kind: MediaKind): string {
  return `${url.replace(KIND_FRAGMENT, '')}#kind=${kind}`
}

export function mediaKind(url: string): MediaKind {
  const tagged = KIND_FRAGMENT.exec(url)
  if (tagged) return tagged[1] as MediaKind
  const path = url.split(/[?#]/)[0]!.toLowerCase()
  if (path.endsWith('.riv')) return 'rive'
  if (/\.(mp4|webm|mov)$/.test(path)) return 'video'
  return 'image'
}

export function kindOfFile(file: File): MediaKind | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.name.toLowerCase().endsWith('.riv')) return 'rive'
  return null
}

/** Object URLs only live for the current session, so they must never be persisted. */
export const isSessionUrl = (value: unknown): boolean =>
  typeof value === 'string' && value.startsWith('blob:')