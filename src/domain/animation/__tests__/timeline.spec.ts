import { describe, expect, it } from 'vite-plus/test'

import { useTimeline } from '../timeline'

describe('useTimeline', () => {
  it('clamps seek to whole frames inside 0..duration-1', () => {
    const t = useTimeline(100, 30)
    t.seek(42.6)
    expect(t.currentFrame.value).toBe(43)
    t.seek(500)
    expect(t.currentFrame.value).toBe(99)
    t.seek(-3)
    expect(t.currentFrame.value).toBe(0)
  })

  it('does not play while locked', () => {
    const t = useTimeline(100, 30)
    t.locked.value = true
    t.play()
    expect(t.isPlaying.value).toBe(false)
  })

  it('reconfigures fps and duration and re-clamps the frame', () => {
    const t = useTimeline(100, 30)
    t.seek(90)
    t.configure(24, 50)
    expect(t.fps.value).toBe(24)
    expect(t.currentFrame.value).toBe(49)
    expect(t.totalTimeSec.value).toBe('2.08')
  })
})