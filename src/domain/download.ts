import { useTimeoutFn } from '@vueuse/core'

export function safeFileName(name: string, fallback = 'document'): string {
  const cleaned = name
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(char) ? ' ' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned === '' ? fallback : cleaned
}

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  useTimeoutFn(() => URL.revokeObjectURL(url), 10_000)
}