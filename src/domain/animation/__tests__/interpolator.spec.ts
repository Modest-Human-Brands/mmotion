import { describe, expect, it } from 'vite-plus/test'

import { EASING_FUNCTIONS, EASING_NAMES } from '../easing'
import { evaluateTrack, type Track } from '../interpolator'

describe('easing', () => {
  it.each(EASING_NAMES)('%s maps 0 to 0 and 1 to 1', (name) => {
    expect(EASING_FUNCTIONS[name](0)).toBeCloseTo(0, 6)
    expect(EASING_FUNCTIONS[name](1)).toBeCloseTo(1, 6)
  })
})

describe('evaluateTrack', () => {
  const vec: Track<number[]> = [
    { frame: 0, value: [0, 0, 0] },
    { frame: 10, value: [10, 20, 30], easing: 'easeInQuad' },
    { frame: 20, value: [10, 20, 30] },
  ]

  it('returns the fallback for missing or empty tracks', () => {
    expect(evaluateTrack(undefined, 5, [1, 2, 3])).toEqual([1, 2, 3])
    expect(evaluateTrack([], 5, 7)).toBe(7)
  })

  it('clamps before the first and after the last keyframe', () => {
    expect(evaluateTrack(vec, -5, [9, 9, 9])).toEqual([0, 0, 0])
    expect(evaluateTrack(vec, 99, [9, 9, 9])).toEqual([10, 20, 30])
  })

  it('interpolates vectors linearly by default', () => {
    expect(evaluateTrack(vec, 5, [0, 0, 0])).toEqual([5, 10, 15])
  })

  it('uses the outgoing keyframe easing', () => {
    const eased: Track<number> = [
      { frame: 0, value: 0, easing: 'easeInQuad' },
      { frame: 10, value: 100 },
    ]
    expect(evaluateTrack(eased, 5, 0)).toBeCloseTo(25, 6)
  })

  it('supports scalar tracks and never exposes keyframe arrays', () => {
    const scalar: Track<number> = [
      { frame: 0, value: 1 },
      { frame: 4, value: 5 },
    ]
    expect(evaluateTrack(scalar, 2, 0)).toBe(3)
    const out = evaluateTrack(vec, 99, [0, 0, 0])
    out[0] = 999
    expect(vec[1]!.value[0]).toBe(10)
  })

  it('handles duplicate frames without NaN', () => {
    const stepped: Track<number> = [
      { frame: 5, value: 0 },
      { frame: 5, value: 10 },
      { frame: 9, value: 20 },
    ]
    expect(Number.isNaN(evaluateTrack(stepped, 5, 0))).toBe(false)
  })
})