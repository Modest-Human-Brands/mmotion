export function normalizeHex(value: string | undefined, fallback = '#111827'): string {
  const hex = (value ?? '').trim().replace('#', '')
  if (/^[\da-f]{3}$/i.test(hex)) {
    return `#${hex
      .split('')
      .map((char) => char + char)
      .join('')}`.toLowerCase()
  }
  if (/^[\da-f]{6}$/i.test(hex)) return `#${hex}`.toLowerCase()
  return fallback
}

export function hexToHsl(hex: string): [number, number, number] {
  const num = Number.parseInt(normalizeHex(hex).slice(1), 16)
  const r = (num >> 16) / 255
  const g = ((num >> 8) & 0xff) / 255
  const b = (num & 0xff) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

export function hslToHex(h: number, s: number, l: number): string {
  const lightness = l / 100
  const a = (s * Math.min(lightness, 1 - lightness)) / 100
  const channel = (n: number) => {
    const k = (n + h / 30) % 12
    const color = lightness - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

export function onColor(background: string): string {
  const num = Number.parseInt(normalizeHex(background).slice(1), 16)
  const luminance = (0.299 * (num >> 16) + 0.587 * ((num >> 8) & 0xff) + 0.114 * (num & 0xff)) / 255
  return luminance > 0.62 ? '#0F172A' : '#FFFFFF'
}