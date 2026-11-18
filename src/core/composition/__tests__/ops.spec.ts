import { describe, expect, it } from 'vite-plus/test'

import { applyOps, parseRawOp, type EditOp } from '../ops'
import { emptyElement, type Composition, type Scene } from '../schema'
import { activeSpans, beatTimes, sceneSpans, totalSeconds, VOICE_LEAD } from '../timing'

const scene = (partial: Partial<Scene> & Pick<Scene, 'id'>): Scene => ({
  chapterId: 'c1',
  chrome: { headline: '', step: '', caption: '' },
  element: emptyElement(),
  beats: [],
  voiceover: '',
  duration: 3,
  transition: 'fade',
  ...partial,
})

const composition = (): Composition => ({
  version: 2,
  title: 'Senses',
  format: 'portrait',
  fps: 30,
  templateId: 'soft-explainer',
  brand: {
    name: 'Acme',
    logo: '',
    primary: '#1f4d3a',
    accent: '#e0784f',
    background: '#f8f7f4',
    text: '#1f2328',
    fontDisplay: 'Lora',
    fontBody: 'Inter',
  },
  cast: { members: [{ name: 'Mother', description: 'yellow kurta' }], seed: 7 },
  chapters: [
    { id: 'c1', title: 'Everyday', tone: 'light' },
    { id: 'c2', title: 'Brand', tone: 'dark' },
  ],
  scenes: [
    scene({
      id: 'a',
      chrome: { headline: 'A party', step: '', caption: 'Music.' },
      element: { ...emptyElement('illustration'), prompt: 'Mother at a party', cast: ['Mother'] },
      voiceover: 'Imagine a birthday party.',
      transition: 'cut',
    }),
    scene({
      id: 'b',
      element: {
        ...emptyElement('radialDiagram'),
        items: [
          { label: 'Sound', icon: 'ear', detail: '' },
          { label: 'Sight', icon: 'eye', detail: '' },
        ],
      },
      duration: 2,
    }),
    scene({ id: 'z', chapterId: 'c2', element: emptyElement('logoReveal') }),
  ],
})

describe('parseRawOp', () => {
  it('decodes the JSON data field per op', () => {
    expect(
      parseRawOp({
        op: 'updateScene',
        sceneId: 'a',
        afterSceneId: '',
        data: '{"element":{"prompt":"Mother smiles"}}',
      }),
    ).toEqual({ op: 'updateScene', sceneId: 'a', patch: { element: { prompt: 'Mother smiles' } } })
    expect(
      parseRawOp({ op: 'updateChapter', sceneId: 'c1', afterSceneId: '', data: '{"tone":"dark"}' }),
    ).toEqual({ op: 'updateChapter', chapterId: 'c1', patch: { tone: 'dark' } })
  })

  it('explains unusable ops', () => {
    expect(parseRawOp({ op: 'addScene', sceneId: '', afterSceneId: '', data: '{' })).toMatch(
      /not valid JSON/,
    )
    expect(
      parseRawOp({
        op: 'updateScene',
        sceneId: 'a',
        afterSceneId: '',
        data: '{"element":{"kind":"hologram"}}',
      }),
    ).toMatch(/element\.kind/)
    expect(parseRawOp({ op: 'explode', sceneId: '', afterSceneId: '', data: '' })).toMatch(
      /unknown op/,
    )
  })
})

describe('applyOps', () => {
  it('merges element patches and leaves other scenes alone', () => {
    const { composition: next, errors } = applyOps(composition(), [
      { op: 'updateScene', sceneId: 'a', patch: { element: { prompt: 'Mother smiles' } } },
    ])
    expect(errors).toEqual([])
    expect(next.scenes[0]!.element).toMatchObject({
      kind: 'illustration',
      prompt: 'Mother smiles',
      cast: ['Mother'],
    })
    expect(next.scenes.slice(1)).toEqual(composition().scenes.slice(1))
  })

  it('adds scenes into the neighbour’s chapter, moves and removes them', () => {
    const ops: EditOp[] = [
      {
        op: 'addScene',
        afterSceneId: 'b',
        patch: { chrome: { headline: 'Step one' }, element: { kind: 'checklist' } },
      },
      { op: 'moveScene', sceneId: 'b', afterSceneId: null },
      { op: 'removeScene', sceneId: 'a' },
    ]
    const { composition: next, errors } = applyOps(composition(), ops)
    expect(errors).toEqual([])
    expect(next.scenes.map((s) => s.element.kind)).toEqual([
      'radialDiagram',
      'checklist',
      'logoReveal',
    ])
    expect(next.scenes[1]!.chapterId).toBe('c1')
  })

  it('bumps the variant to redraw an illustration', () => {
    const { composition: next, errors } = applyOps(composition(), [
      { op: 'regenerateIllustration', sceneId: 'a' },
      { op: 'regenerateIllustration', sceneId: 'b' },
    ])
    expect(next.scenes[0]!.element.variant).toBe(1)
    expect(errors).toEqual(['regenerateIllustration: that scene has no illustration'])
  })

  it('merges cast members by name', () => {
    const { composition: next } = applyOps(composition(), [
      {
        op: 'updateCast',
        members: [
          { name: 'mother', description: 'green saree' },
          { name: 'Son', description: 'orange t-shirt' },
        ],
      },
    ])
    expect(next.cast.members).toEqual([
      { name: 'Mother', description: 'green saree' },
      { name: 'Son', description: 'orange t-shirt' },
    ])
  })

  it('keeps going past bad ops and never breaks the document', () => {
    const { composition: next, errors } = applyOps(
      composition(),
      [
        { op: 'removeScene', sceneId: 'nope' },
        { op: 'setBrand', patch: { accent: 'red' } },
        { op: 'setTemplate', templateId: 'unknown' },
        { op: 'updateScene', sceneId: 'b', patch: { chapterId: 'missing' } },
        { op: 'updateScene', sceneId: 'b', patch: { transition: 'wipe' } },
      ],
      (id) => id === 'soft-explainer',
    )
    expect(errors).toHaveLength(4)
    expect(next.brand.accent).toBe('#e0784f')
    expect(next.scenes[1]!.transition).toBe('wipe')
    expect(next.scenes[1]!.chapterId).toBe('c1')
  })
})

describe('timing', () => {
  it('overlaps a transition with the previous scene', () => {
    const spans = sceneSpans(composition())
    expect(spans.map((span) => [span.start, span.end])).toEqual([
      [0, 3],
      [2.5, 4.5],
      [4, 7],
    ])
    expect(totalSeconds(composition())).toBe(7)
    expect(activeSpans(spans, 2.7).map((span) => span.scene.id)).toEqual(['a', 'b'])
  })

  it('fires beats when their phrase is spoken', () => {
    const narrated = scene({
      id: 'x',
      duration: 6,
      voiceover: 'Our brain receives sound, sight and touch.',
      beats: [
        { at: 'sound', action: 'highlight', target: 0, text: '' },
        { at: 'not spoken', action: 'highlight', target: 1, text: '' },
        { at: 'and touch', action: 'highlight', target: 2, text: '' },
      ],
    })
    const words = [
      { word: 'Our', start: 0, end: 0.2 },
      { word: 'brain', start: 0.2, end: 0.5 },
      { word: 'receives', start: 0.5, end: 1 },
      { word: 'sound,', start: 1, end: 1.4 },
      { word: 'sight', start: 1.5, end: 1.9 },
      { word: 'and', start: 2, end: 2.1 },
      { word: 'touch.', start: 2.1, end: 2.6 },
    ]
    const times = beatTimes(narrated, words)
    expect(times[0]).toBeCloseTo(VOICE_LEAD + 1)
    expect(times[2]).toBeCloseTo(VOICE_LEAD + 2)
    // A missed phrase lands between its neighbours.
    expect(times[1]).toBeGreaterThan(times[0]!)
    expect(times[1]).toBeLessThan(times[2]!)
  })

  it('spreads beats evenly without word timings', () => {
    const times = beatTimes(
      scene({
        id: 'y',
        duration: 5,
        beats: [
          { at: 'a', action: 'reveal', target: 0, text: '' },
          { at: 'b', action: 'reveal', target: 1, text: '' },
        ],
      }),
      undefined,
    )
    expect(times[0]).toBeGreaterThan(0.6)
    expect(times[1]).toBeGreaterThan(times[0]!)
    expect(times[1]).toBeLessThan(5)
  })
})