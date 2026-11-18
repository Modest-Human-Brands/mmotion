import { describe, expect, it } from 'vite-plus/test'

import { sampleComposition } from '@/core/samples'

import { fitToVoiceover, voiceTail, type Narration } from '../voiceover'

const brand = {
  name: 'Acme',
  logo: '',
  primary: '#1f4d3a',
  accent: '#e0784f',
  background: '#f7f7f7',
  text: '#1f2328',
  fontDisplay: 'Lora',
  fontBody: 'Exo 2',
}

const line = (seconds: number) => ({ buffer: { duration: seconds } }) as unknown as Narration

describe('fitting scenes to the narration', () => {
  it('shrinks and grows scenes to the recorded line, never below reading time', () => {
    const video = sampleComposition('social-ad', 'bold-editorial', brand)
    video.scenes[0]!.duration = 8
    video.scenes[1]!.duration = 2
    const voices = new Map([
      [video.scenes[0]!.id, line(1.5)],
      [video.scenes[1]!.id, line(4)],
    ])
    const fitted = fitToVoiceover(video, voices, 1.5)
    // 1.5 s of speech + 0.35 lead + 0.3 tail, but the headline needs at least its reading time.
    expect(fitted.scenes[0]!.duration).toBeLessThan(8)
    expect(fitted.scenes[0]!.duration).toBeGreaterThanOrEqual(2.1)
    expect(Math.abs(fitted.scenes[1]!.duration - 4.65)).toBeLessThan(0.06)
    // Scenes without narration keep their length.
    expect(fitted.scenes[2]!.duration).toBe(video.scenes[2]!.duration)
  })

  it('gives fast kinds a shorter tail', () => {
    expect(voiceTail(1.5)).toBeCloseTo(0.3)
    expect(voiceTail(4)).toBe(0.7)
  })
})