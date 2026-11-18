import { describe, expect, it } from 'vite-plus/test'

import { cleanText, directionBatch, repairKind, truncated } from '../index'

describe('cleanText', () => {
  it('drops visual labels copied from a script outline, and wrapping quotes', () => {
    expect(cleanText('STATEMENT: "Individual choices matter."')).toBe('Individual choices matter.')
    expect(cleanText('Big word: Overload')).toBe('Overload')
    expect(cleanText('Logo: Soul Solutions')).toBe('Soul Solutions')
  })

  it('leaves ordinary text alone', () => {
    expect(cleanText('Mother kneels beside Child')).toBe('Mother kneels beside Child')
    expect(cleanText('Note: be gentle')).toBe('Note: be gentle')
  })
})
describe('direction batches', () => {
  it('directs fewer scenes per call in scripts that need more tokens', () => {
    expect(directionBatch('en')).toBe(6)
    expect(directionBatch('bn')).toBe(3)
    expect(directionBatch('hi')).toBe(3)
  })

  it('recognises answers cut off at the output limit', () => {
    expect(
      truncated('Engine output is not a complete JSON value matching the requested schema.'),
    ).toBe(true)
    expect(truncated('The model returned malformed JSON.')).toBe(true)
    expect(truncated('model not found')).toBe(false)
  })
})
describe('repairKind', () => {
  const direction = (kind: string, patch: Record<string, unknown> = {}) =>
    ({
      n: 1,
      kind,
      prompt: '',
      cast: [],
      items: [],
      center: { label: '', icon: '', detail: '' },
      text: '',
      subtext: '',
      beats: [],
      ...patch,
    }) as Parameters<typeof repairKind>[0]

  it('turns a statement with a picture description into a picture', () => {
    expect(repairKind(direction('none', { prompt: 'Steam rising from a cup' }))).toBe(
      'illustration',
    )
    expect(repairKind(direction('none'))).toBe('none')
    expect(repairKind(direction('checklist', { text: 'Calm' }))).toBe('bigWord')
  })
})