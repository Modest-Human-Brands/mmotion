import { describe, expect, it } from 'vite-plus/test'

import { hexToHsl, hslToHex, normalizeHex, onColor } from '../proceduralGradient'

describe('proceduralGradient', () => {
  it('normalises short, long and invalid hex colours', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('5945EA')).toBe('#5945ea')
    expect(normalizeHex('nope', '#000000')).toBe('#000000')
  })

  it('round-trips hex through HSL', () => {
    const [h, s, l] = hexToHsl('#5945ea')
    expect(hslToHex(h, s, l)).toMatch(/^#[\da-f]{6}$/)
    expect(hexToHsl('#ffffff')).toEqual([0, 0, 100])
  })

  it('picks a readable foreground', () => {
    expect(onColor('#ffffff')).toBe('#0F172A')
    expect(onColor('#111827')).toBe('#FFFFFF')
  })
})