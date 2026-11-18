import { newId } from '@/core/composition/schema'

/**
 * A scene block in the story builder: what one scene says and shows, before the writer turns the
 * blocks into a story. Every field may be empty; the writer fills what is missing.
 */
export interface Block {
  id: string
  /** Chapter title starting at this block; "" = continues the previous chapter. */
  chapter: string
  headline: string
  /** Step badge like "02/05"; "" for none. */
  step: string
  /** What the visual should show. */
  visual: string
  /** What is spoken. */
  narration: string
}

export const block = (patch: Partial<Block> = {}): Block => ({
  id: newId('b'),
  chapter: '',
  headline: '',
  step: '',
  visual: '',
  narration: '',
  ...patch,
})

/** Sentences, keeping their end marks; handles the Bengali and Devanagari danda. */
export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?।॥])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length

/** Seconds a block's narration takes at an average speaking pace. */
export const blockSeconds = (item: Block) => words(item.narration) / 2.4

const pad = (n: number) => String(n).padStart(2, '0')

// ------------------------------------------------------------------- parsing

// Keys are upper case, so narration that starts with "Step by step…" is not read as a key.
const OUTLINE = /^\s*SCENE\b/m
const KEY = /^\s*(CHAPTER|SCENE|VISUAL|NARRATION|STEP|HEADLINE)\b\s*[\d.]*\s*[:·\-–—]?\s*(.*)$/

/** The outline format the video reader writes (and `blocksToScript` produces). */
function parseOutline(text: string): Block[] {
  const blocks: Block[] = []
  let chapter = ''
  let current: Block | null = null
  let field: 'narration' | 'visual' | null = null
  for (const line of text.split(/\r?\n/)) {
    const match = KEY.exec(line)
    if (match) {
      const key = match[1]!.toUpperCase()
      const value = match[2]!.trim()
      if (key === 'CHAPTER') {
        chapter = value.replace(/\s*\((light|dark)\)\s*$/i, '').trim()
        field = null
      } else if (key === 'SCENE') {
        current = block({ chapter, headline: value })
        chapter = ''
        blocks.push(current)
        field = null
      } else if (current) {
        if (key === 'VISUAL') {
          current.visual = value
          field = 'visual'
        } else if (key === 'NARRATION') {
          current.narration = value
          field = 'narration'
        } else if (key === 'STEP') current.step = value
        else if (key === 'HEADLINE') current.headline = value
      }
    } else if (current && field && line.trim()) {
      current[field] = `${current[field]} ${line.trim()}`.trim()
    }
  }
  return blocks
}

const LIST_ITEM = /^\s*(?:(?:step\s*)?(\d+)[.):]|[-*•])\s+(.*)$/i
const HEADING = /^\s*#{1,3}\s+(.*)$/

/** "Title: the rest" → headline + narration when the title is short. */
function titled(text: string): Pick<Block, 'headline' | 'narration'> {
  const match = /^([^:.!?]{2,48}):\s+(.+)$/.exec(text)
  if (match && words(match[1]!) <= 6)
    return { headline: match[1]!.trim(), narration: match[2]!.trim() }
  // A short line without an end mark is a title, not something spoken.
  if (words(text) <= 7 && !/[.!?।॥]\s*$/u.test(text))
    return { headline: text.trim(), narration: '' }
  return { headline: '', narration: text.trim() }
}

const sentence = (text: string) => (/[.!?।॥]$/u.test(text.trim()) ? text.trim() : `${text.trim()}.`)

/** Short bullet points that belong on one checklist scene. */
const SHORT_ITEM = 14

/**
 * Anything pasted → blocks, without a model: the outline format; numbered lists (one block per
 * item, with step badges); a run of short bullet points (one checklist block under its heading);
 * markdown headings start chapters; otherwise paragraphs, and a single long paragraph is cut every
 * two sentences.
 */
export function parseScript(text: string): Block[] {
  if (!text.trim()) return []
  if (OUTLINE.test(text)) {
    const outline = parseOutline(text)
    if (outline.length) return outline
  }

  const lines = text.split(/\r?\n/)
  const items = lines.filter((line) => LIST_ITEM.test(line))
  if (items.length >= 2) {
    const blocks: Block[] = []
    let chapter = ''
    let numbered = 0
    const total = items.filter((line) => /^\s*(?:step\s*)?\d/i.test(line)).length
    /** Bullet points waiting to become one block (or one block each when long). */
    let bullets: string[] = []
    let bulletChapter = ''
    /** The last block may take continuation lines until a blank line. */
    let open = false
    const flush = () => {
      if (bullets.length === 0) return
      if (bullets.length >= 2 && bullets.every((item) => words(item) <= SHORT_ITEM)) {
        const parts = bullets.map(titled)
        blocks.push(
          block({
            chapter: bulletChapter,
            headline: bulletChapter,
            visual: `Checklist: ${parts.map((part) => part.headline || part.narration).join('; ')}`,
            narration: bullets.map(sentence).join(' '),
          }),
        )
      } else
        for (const [index, item] of bullets.entries())
          blocks.push(block({ chapter: index === 0 ? bulletChapter : '', ...titled(item) }))
      bullets = []
      bulletChapter = ''
    }
    for (const line of lines) {
      const heading = HEADING.exec(line)
      const item = LIST_ITEM.exec(line)
      if (heading) {
        flush()
        chapter = heading[1]!.trim()
        open = false
      } else if (item && !item[1]) {
        if (bullets.length === 0) {
          bulletChapter = chapter
          chapter = ''
        }
        bullets.push(item[2]!.trim())
        open = false
      } else if (item) {
        flush()
        const step = `${pad(++numbered)}/${pad(total)}`
        blocks.push(block({ chapter, step, ...titled(item[2]!) }))
        chapter = ''
        open = true
      } else if (!line.trim()) {
        flush()
        open = false
      } else if (open && blocks.length) {
        const last = blocks.at(-1)!
        last.narration = `${last.narration} ${line.trim()}`.trim()
      } else {
        // An introduction before the list, or a paragraph after it.
        flush()
        blocks.push(block({ chapter, ...titled(line.trim()) }))
        chapter = ''
        open = true
      }
    }
    flush()
    return blocks
  }

  const blocks: Block[] = []
  let chapter = ''
  for (const paragraph of text.split(/\r?\n\s*\r?\n/)) {
    const heading = HEADING.exec(paragraph.split(/\r?\n/)[0] ?? '')
    let body = paragraph
    if (heading) {
      chapter = heading[1]!.trim()
      body = paragraph.split(/\r?\n/).slice(1).join(' ')
    }
    if (!body.trim()) continue
    blocks.push(block({ chapter, ...titled(body.replace(/\s+/g, ' ').trim()) }))
    chapter = ''
  }
  // One long paragraph is a voiceover: two sentences per scene.
  if (blocks.length === 1 && sentences(blocks[0]!.narration).length > 3) {
    const all = sentences(blocks[0]!.narration)
    const first = blocks[0]!
    const cut: Block[] = []
    for (let index = 0; index < all.length; index += 2)
      cut.push(
        block({
          chapter: index === 0 ? first.chapter : '',
          headline: index === 0 ? first.headline : '',
          narration: all.slice(index, index + 2).join(' '),
        }),
      )
    return cut
  }
  return blocks
}

/** Blocks → the outline format the writer reads (chapters, scenes, visual hints, narration). */
export function blocksToScript(blocks: Block[]): string {
  return blocks
    .map((item, index) => {
      const lines: string[] = []
      if (item.chapter.trim()) lines.push(`CHAPTER: ${item.chapter.trim()}`)
      lines.push(`SCENE ${index + 1}${item.headline.trim() ? ` · ${item.headline.trim()}` : ''}`)
      if (item.step.trim()) lines.push(`STEP: ${item.step.trim()}`)
      if (item.visual.trim()) lines.push(`VISUAL: ${item.visual.trim()}`)
      if (item.narration.trim()) lines.push(`NARRATION: ${item.narration.trim()}`)
      return lines.join('\n')
    })
    .join('\n\n')
}

// ------------------------------------------------------------------- editing

/** Split a block's narration at the sentence boundary nearest its middle. */
export function splitBlock(item: Block): [Block, Block] | null {
  const parts = sentences(item.narration)
  if (parts.length < 2) return null
  const total = words(item.narration)
  let best = 1
  let seen = 0
  let gap = Infinity
  for (let index = 0; index < parts.length - 1; index++) {
    seen += words(parts[index]!)
    const distance = Math.abs(total / 2 - seen)
    if (distance < gap) {
      gap = distance
      best = index + 1
    }
  }
  return [
    { ...item, narration: parts.slice(0, best).join(' ') },
    block({ visual: '', narration: parts.slice(best).join(' ') }),
  ]
}

/** One block from two neighbours. */
export function mergeBlocks(first: Block, second: Block): Block {
  const join = (a: string, b: string, glue: string) =>
    [a.trim(), b.trim()].filter(Boolean).join(glue)
  return {
    ...first,
    chapter: first.chapter || second.chapter,
    headline: first.headline || second.headline,
    step: first.step || second.step,
    visual: join(first.visual, second.visual, '; '),
    narration: join(first.narration, second.narration, ' '),
  }
}

/** Renumber step badges in order ("01/04" …), keeping blocks without a badge as they are. */
export function renumberSteps(blocks: Block[]): Block[] {
  const total = blocks.filter((item) => item.step.trim()).length
  let n = 0
  return blocks.map((item) =>
    item.step.trim() ? { ...item, step: `${pad(++n)}/${pad(total)}` } : item,
  )
}