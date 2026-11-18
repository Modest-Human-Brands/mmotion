import { describe, expect, it } from 'vite-plus/test'

import { applyOps, parseRawOp, type EditOp } from '../ops'
import {
  DEFAULT_VOICE,
  castMember,
  compositionSchema,
  emptyElement,
  spokenWords,
  type Composition,
  type Scene,
} from '../schema'
import { activeSpans, beatTimes, sameWord, sceneSpans, totalSeconds, VOICE_LEAD } from '../timing'

const scene = (partial: Partial<Scene> & Pick<Scene, 'id'>): Scene => ({
  chapterId: 'c1',
  chrome: { headline: '', step: '', caption: '' },
  brief: '',
  element: emptyElement(),
  beats: [],
  voiceover: '',
  voiceTake: 0,
  duration: 3,
  transition: 'fade',
  styleId: '',
  ...partial,
})

const composition = (): Composition => ({
  version: 2,
  title: 'Senses',
  format: 'portrait',
  fps: 30,
  templateId: 'soft-explainer',
  kindId: 'explainer',
  styleId: '',
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
  cast: { members: [castMember('Mother', 'yellow kurta')], seed: 7 },
  voice: DEFAULT_VOICE,
  language: 'en',
  commercial: false,
  chapters: [
    { id: 'c1', title: 'Everyday', tone: 'light', styleId: '' },
    { id: 'c2', title: 'Brand', tone: 'dark', styleId: '' },
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
      castMember('Mother', 'green saree'),
      castMember('Son', 'orange t-shirt'),
    ])
  })

  it('keeps sheets and references when a description changes, and never edits locked members', () => {
    const base = composition()
    base.cast.members = [
      castMember('Mother', 'yellow kurta', { sheet: 'a1', refs: ['r1'] }),
      castMember('Logo', 'green leaf', { kind: 'object', exact: true, locked: true }),
    ]
    const { composition: next, errors } = applyOps(base, [
      { op: 'updateCast', members: [{ name: 'Mother', description: 'green saree' }] },
      { op: 'updateCast', members: [{ name: 'Logo', description: 'blue leaf' }] },
    ])
    expect(next.cast.members[0]).toMatchObject({
      description: 'green saree',
      sheet: 'a1',
      refs: ['r1'],
    })
    expect(next.cast.members[1]!.description).toBe('green leaf')
    expect(errors).toEqual(['updateCast: Logo is locked; unlock them in Cast first'])
  })

  it('reads old projects without the new cast and voice fields', () => {
    const old = JSON.parse(JSON.stringify(composition())) as Record<string, unknown>
    delete old.voice
    ;(old.cast as { members: unknown[] }).members = [{ name: 'Mother', description: 'kurta' }]
    for (const scene of old.scenes as Record<string, unknown>[]) delete scene.brief
    const parsed = compositionSchema.parse(old)
    expect(parsed.voice).toEqual(DEFAULT_VOICE)
    expect(parsed.cast.members[0]).toEqual(castMember('Mother', 'kurta'))
    expect(parsed.scenes[0]!.brief).toBe('')
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

  it('matches Bengali and Hindi words, vowel signs included', () => {
    const bengali = scene({
      id: 'bn',
      duration: 5,
      voiceover: 'শান্ত থাকুন এবং আস্তে কথা বলুন।',
      beats: [{ at: 'আস্তে কথা', action: 'caption', target: 0, text: '' }],
    })
    const times = beatTimes(bengali, [
      { word: 'শান্ত', start: 0, end: 0.4 },
      { word: 'থাকুন', start: 0.5, end: 0.9 },
      { word: 'এবং', start: 1, end: 1.2 },
      { word: 'আস্তে', start: 1.3, end: 1.7 },
      { word: 'কথা', start: 1.8, end: 2.1 },
    ])
    expect(times[0]).toBeCloseTo(VOICE_LEAD + 1.3)
  })

  it('tolerates small spelling differences from the transcriber', () => {
    expect(sameWord('তাজাজাল', 'তাজা')).toBe(false)
    expect(sameWord('অপিক্ষা', 'অপেক্ষা')).toBe(true)
    expect(sameWord('quieter', 'quiet')).toBe(true)
    expect(sameWord('cat', 'hat')).toBe(false)
  })

  it('ignores delivery tags when estimating length', () => {
    expect(spokenWords('[whisper] Speak gently. [pause]')).toBe('Speak gently.')
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
describe('art styles', () => {
  it('sets the style of the video, a chapter or a scene, and rejects unknown ones', () => {
    const base = composition()
    const known = (id: string) => ['watercolour', 'anime'].includes(id)
    const chapterId = base.chapters[0]!.id
    const sceneId = base.scenes[0]!.id
    const { composition: next, errors } = applyOps(
      base,
      [
        { op: 'setStyle', styleId: 'watercolour', targetId: null },
        { op: 'setStyle', styleId: 'anime', targetId: chapterId },
        { op: 'setStyle', styleId: 'anime', targetId: sceneId },
        { op: 'setStyle', styleId: 'crayon', targetId: null },
      ],
      () => true,
      known,
    )
    expect(next.styleId).toBe('watercolour')
    expect(next.chapters[0]!.styleId).toBe('anime')
    expect(next.scenes[0]!.styleId).toBe('anime')
    expect(errors.join()).toMatch(/unknown style "crayon"/)
  })

  it('keeps a chapter style when a patch leaves it out', () => {
    const op = parseRawOp({
      op: 'updateChapter',
      sceneId: 'c1',
      afterSceneId: '',
      data: '{"title":"New"}',
    })
    expect(op).toEqual({ op: 'updateChapter', chapterId: 'c1', patch: { title: 'New' } })
  })
})