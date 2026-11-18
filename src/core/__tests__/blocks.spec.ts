import { describe, expect, it } from 'vite-plus/test'

import {
  block,
  blocksToScript,
  mergeBlocks,
  parseScript,
  renumberSteps,
  sentences,
  splitBlock,
} from '../blocks'

const strip = (blocks: ReturnType<typeof parseScript>) => blocks.map(({ id: _id, ...rest }) => rest)

describe('story blocks', () => {
  it('reads the outline format and writes it back', () => {
    const outline = `CHAPTER 1: Everyday moments (light)
SCENE 1 · A noisy party
VISUAL: ILLUSTRATION: Mother kneels beside Son
NARRATION: Parties can be loud.
Step by step, it gets easier.

SCENE 2 · Why
NARRATION: Senses take the world in.`
    const blocks = parseScript(outline)
    expect(strip(blocks)).toEqual([
      {
        chapter: 'Everyday moments',
        headline: 'A noisy party',
        step: '',
        visual: 'ILLUSTRATION: Mother kneels beside Son',
        narration: 'Parties can be loud. Step by step, it gets easier.',
      },
      {
        chapter: '',
        headline: 'Why',
        step: '',
        visual: '',
        narration: 'Senses take the world in.',
      },
    ])
    expect(strip(parseScript(blocksToScript(blocks)))).toEqual(strip(blocks))
  })

  it('turns numbered lists into steps and headings into chapters', () => {
    const blocks = parseScript(`How to brew tea

# Steps
1. Boil water: Bring fresh water to the boil.
2. Steep: Leave the leaves for three minutes.
3. Pour and enjoy.`)
    expect(blocks.map((item) => [item.chapter, item.headline, item.step])).toEqual([
      ['', 'How to brew tea', ''],
      ['Steps', 'Boil water', '01/03'],
      ['', 'Steep', '02/03'],
      ['', '', '03/03'],
    ])
    expect(blocks[1]!.narration).toBe('Bring fresh water to the boil.')
  })

  it('puts a run of short bullets on one checklist block and keeps later paragraphs apart', () => {
    const blocks = parseScript(`# What you need
- Fresh beans: 15 grams.
- A dripper and a filter

# Steps
1. Rinse: Pour hot water through the filter.
2. Brew: Pour slowly.

Tip: do not pour too fast.
Enjoy your cup.`)
    expect(blocks.map((item) => [item.chapter, item.headline, item.step])).toEqual([
      ['What you need', 'What you need', ''],
      ['Steps', 'Rinse', '01/02'],
      ['', 'Brew', '02/02'],
      ['', 'Tip', ''],
    ])
    expect(blocks[0]!.visual).toBe('Checklist: Fresh beans; A dripper and a filter')
    expect(blocks[0]!.narration).toBe('Fresh beans: 15 grams. A dripper and a filter.')
    expect(blocks[2]!.narration).toBe('Pour slowly.')
    expect(blocks[3]!.narration).toBe('do not pour too fast. Enjoy your cup.')
  })

  it('cuts one long voiceover into two sentences per block', () => {
    const blocks = parseScript('One. Two! Three? Four. Five.')
    expect(blocks.map((item) => item.narration)).toEqual(['One. Two!', 'Three? Four.', 'Five.'])
  })

  it('keeps paragraphs as blocks', () => {
    expect(parseScript('First idea here.\n\nSecond idea here.')).toHaveLength(2)
  })

  it('splits sentences in Bengali and Hindi', () => {
    expect(sentences('চা বানান। জল ফুটান। ')).toEqual(['চা বানান।', 'জল ফুটান।'])
    expect(sentences('पानी उबालें। चाय डालें।')).toHaveLength(2)
  })

  it('splits a block near the middle and merges neighbours', () => {
    const item = block({ headline: 'H', narration: 'A b c d. E f. G h i j.' })
    const [first, second] = splitBlock(item)!
    expect(first.narration).toBe('A b c d.')
    expect(second.narration).toBe('E f. G h i j.')
    expect(second.headline).toBe('')
    expect(splitBlock(block({ narration: 'Only one.' }))).toBeNull()
    expect(mergeBlocks(first, second)).toMatchObject({ headline: 'H', narration: item.narration })
  })

  it('renumbers steps after a reorder', () => {
    const blocks = renumberSteps([
      block({ step: '03/03' }),
      block(),
      block({ step: '01/03' }),
      block({ step: '02/03' }),
    ])
    expect(blocks.map((item) => item.step)).toEqual(['01/03', '', '02/03', '03/03'])
  })
})