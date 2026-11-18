import { describe, expect, it } from 'vite-plus/test'

import { boxToRect, speechWindow, timedTranscript } from '../video'

const words = (text: string, start = 0, gap = 0.1) => {
  let at = start
  return text.split(' ').map((word) => {
    const item = { word, start: at, end: at + 0.4 }
    at += 0.4 + gap
    return item
  })
}

describe('boxToRect', () => {
  it('reads [y0, x0, y1, x1] on a 0-1000 scale and pads it', () => {
    expect(boxToRect([200, 100, 800, 500], 1000, 2000, 0)).toEqual({
      x: 100,
      y: 400,
      width: 400,
      height: 1200,
    })
    const padded = boxToRect([0, 0, 1000, 1000], 100, 100)!
    expect(padded).toEqual({ x: 0, y: 0, width: 100, height: 100 })
  })

  it('rejects malformed or tiny boxes', () => {
    expect(boxToRect([1, 2, 3], 100, 100)).toBeNull()
    expect(boxToRect([500, 500, 510, 510], 100, 100)).toBeNull()
  })
})

describe('speechWindow', () => {
  it('finds about ten seconds of continuous speech, starting and ending on words', () => {
    const spoken = words(
      'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo',
    )
    const stretch = speechWindow(spoken, 10)!
    expect(stretch.text.startsWith('one two')).toBe(true)
    expect(stretch.to - stretch.from).toBeGreaterThan(9.5)
    expect(stretch.to - stretch.from).toBeLessThan(11)
  })

  it('skips past long pauses', () => {
    const spoken = [...words('hi there', 0), ...words('a b c d e f g h i j k l m n o', 5)]
    expect(speechWindow(spoken, 6)!.text.startsWith('a b')).toBe(true)
    expect(speechWindow(words('too short'), 10)).toBeNull()
  })
})

describe('timedTranscript', () => {
  it('marks the time every ten seconds', () => {
    const text = timedTranscript([
      { word: 'Imagine', start: 0, end: 0.4 },
      { word: 'a', start: 0.5, end: 0.6 },
      { word: 'party.', start: 12.2, end: 12.6 },
    ])
    expect(text).toBe('[0:00] Imagine a \n[0:12] party.')
  })
})