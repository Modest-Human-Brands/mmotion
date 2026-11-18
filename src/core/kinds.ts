import type { Beat, ElementKind, FormatId, SceneElement } from '@/core/composition/schema'

/** One scene of a kind's sample story, shown on the home screen before any script exists. */
export interface SampleScene {
  chapter: number
  headline: string
  step?: string
  caption?: string
  element: Partial<SceneElement> & { kind: ElementKind }
  beats?: Beat[]
  duration?: number
}

/**
 * A kind of video: the story's shape (arc, pacing, length, elements). Independent of the look
 * (design system) and the art style (how pictures are drawn).
 */
export interface Kind {
  id: string
  name: string
  /** One line for the home screen. */
  blurb: string
  /** Read by the writer: what this kind of video is for and how it moves. */
  description: string
  /** Story structure the writer follows. */
  arc: string
  /** Seconds per scene the writer aims for. */
  sceneSeconds: [number, number]
  /** Length presets in seconds; the first is the default. */
  lengths: number[]
  format: FormatId
  /** Look and art style a new video of this kind starts with. */
  look: string
  style: string
  /** Visual elements that suit this kind, in rough order of preference. */
  elements: ElementKind[]
  /** Sample story with neutral content (no real brand or person). */
  sample: {
    title: string
    chapters: { title: string; tone: 'light' | 'dark' }[]
    scenes: SampleScene[]
  }
}

const item = (label: string, icon = '', detail = '') => ({ label, icon, detail })
const at = (action: Beat['action'], target: number, text = ''): Beat => ({
  at: '',
  action,
  target,
  text,
})

export const KINDS: Kind[] = [
  {
    id: 'explainer',
    name: 'Explainer',
    blurb: 'Explain how something works, calmly, one idea at a time',
    description:
      'An explainer that helps a viewer understand a problem and what to do about it: relatable moments with the recurring characters, diagrams for how it works, practical steps, a warm close.',
    arc: 'Hook with a relatable everyday moment → name the problem → explain how it works (diagrams) → reassure → numbered practical steps (STEP 01/05 …) → warm closing thought → dark brand chapter with the promise and logo.',
    sceneSeconds: [4, 9],
    lengths: [60, 30, 120],
    format: 'portrait',
    look: 'soft-explainer',
    style: 'storybook',
    elements: [
      'illustration',
      'radialDiagram',
      'sliders',
      'checklist',
      'speechBubble',
      'splitCards',
      'chips',
      'stat',
      'quote',
      'bigWord',
      'logoReveal',
    ],
    sample: {
      title: 'How sleep works',
      chapters: [
        { title: 'Every night', tone: 'light' },
        { title: 'What happens', tone: 'light' },
        { title: 'Small steps', tone: 'light' },
        { title: 'Your brand', tone: 'dark' },
      ],
      scenes: [
        {
          chapter: 0,
          headline: 'Tired again this morning?',
          caption: 'You are not alone.',
          element: {
            kind: 'illustration',
            prompt: 'A person yawning at a kitchen table at sunrise',
          },
        },
        {
          chapter: 1,
          headline: 'Sleep runs in cycles.',
          caption: 'Each one lasts about 90 minutes.',
          element: {
            kind: 'radialDiagram',
            center: item('Sleep', 'moon'),
            items: [
              item('Light', 'cloud'),
              item('Deep', 'bed'),
              item('Dream', 'sparkles'),
              item('Wake', 'sun'),
            ],
          },
          beats: [at('highlight', 0), at('highlight', 1), at('highlight', 2)],
          duration: 4,
        },
        {
          chapter: 2,
          headline: 'Keep a steady rhythm.',
          step: '01/03',
          caption: 'Same time, every day.',
          element: {
            kind: 'checklist',
            items: [item('Same bedtime'), item('Dim the lights'), item('No screens late')],
          },
          beats: [at('check', 0), at('check', 1), at('check', 2)],
        },
        {
          chapter: 3,
          headline: '',
          element: { kind: 'logoReveal', text: 'Rest well. Live well.' },
        },
      ],
    },
  },
  {
    id: 'tutorial',
    name: 'Tutorial / how-to',
    blurb: 'Teach a task step by step',
    description:
      'A how-to that teaches one task: show the result first, list what is needed, then one numbered step per scene in order, with a tip or common mistake, a recap and a call to action.',
    arc: 'Show the finished result and why it is worth it → what you need (checklist) → numbered steps, one per scene (STEP 01/0N …), each with one clear action → one tip or common mistake → quick recap → call to action with logo.',
    sceneSeconds: [4, 8],
    lengths: [60, 30, 120],
    format: 'portrait',
    look: 'soft-gradient',
    style: 'flat-vector',
    elements: [
      'illustration',
      'checklist',
      'splitCards',
      'speechBubble',
      'bigWord',
      'stat',
      'chips',
      'logoReveal',
    ],
    sample: {
      title: 'Brewing pour-over coffee',
      chapters: [
        { title: 'The goal', tone: 'light' },
        { title: 'Step by step', tone: 'light' },
        { title: 'Your brand', tone: 'dark' },
      ],
      scenes: [
        {
          chapter: 0,
          headline: 'A better cup in four minutes.',
          caption: 'No machine needed.',
          element: {
            kind: 'illustration',
            prompt: 'A cup of coffee on a wooden table next to a pour-over dripper',
          },
        },
        {
          chapter: 0,
          headline: 'You will need',
          element: {
            kind: 'checklist',
            items: [item('Fresh beans'), item('A dripper and filter'), item('Water at 94 °C')],
          },
          beats: [at('reveal', 0), at('reveal', 1), at('reveal', 2)],
        },
        {
          chapter: 1,
          headline: 'Rinse the filter.',
          step: '01/03',
          caption: 'It removes the paper taste.',
          element: { kind: 'speechBubble', text: 'Pour a little hot water first.' },
        },
        {
          chapter: 1,
          headline: 'Bloom for 30 seconds.',
          step: '02/03',
          element: { kind: 'stat', text: '30 s', subtext: 'let the coffee breathe' },
        },
        { chapter: 2, headline: '', element: { kind: 'logoReveal', text: 'Brew it your way.' } },
      ],
    },
  },
  {
    id: 'product-launch',
    name: 'Product launch',
    blurb: 'Reveal a product and its best features',
    description:
      'A launch film that builds anticipation, reveals the product, shows three key features with proof and ends with where to get it.',
    arc: 'Tease (a bold line or the problem) → reveal the product (showcase if there is an exact product image) → three key features, one per scene (diagrams, stats) → proof (a number or a quote) → availability and call to action with logo.',
    sceneSeconds: [3, 6],
    lengths: [30, 60],
    format: 'landscape',
    look: 'minimal-tech',
    style: 'product-photo',
    elements: [
      'bigWord',
      'showcase',
      'illustration',
      'stat',
      'checklist',
      'sliders',
      'splitCards',
      'chips',
      'quote',
      'logoReveal',
    ],
    sample: {
      title: 'Meet Acme Bottle',
      chapters: [
        { title: 'Introducing', tone: 'light' },
        { title: 'Why it matters', tone: 'light' },
        { title: 'Your brand', tone: 'dark' },
      ],
      scenes: [
        {
          chapter: 0,
          headline: 'Cold for 24 hours.',
          element: { kind: 'bigWord', text: '24 h', subtext: 'ice cold, all day' },
        },
        {
          chapter: 0,
          headline: 'Meet Acme Bottle.',
          caption: 'Light, tough, made to last.',
          element: {
            kind: 'illustration',
            prompt: 'A sleek insulated water bottle standing on a rock by a lake',
          },
        },
        {
          chapter: 1,
          headline: 'Built for every day',
          element: {
            kind: 'splitCards',
            items: [
              item('Leak-proof', 'shield-check', 'Lock lid'),
              item('Light', 'feather', '320 g'),
              item('Recycled', 'leaf', '90% steel'),
            ],
          },
          beats: [at('reveal', 0), at('reveal', 1), at('reveal', 2)],
        },
        { chapter: 2, headline: '', element: { kind: 'logoReveal', text: 'Available now.' } },
      ],
    },
  },
  {
    id: 'social-ad',
    name: 'Social ad',
    blurb: 'A short, punchy ad that hooks in two seconds',
    description:
      'A short vertical ad for social feeds: the first scene must stop the scroll within two seconds, then one problem, one clear benefit, quick proof and a direct call to action. Few words on screen, fast cuts.',
    arc: 'Hook in the first two seconds (a bold question, a surprising number or a big word) → the pain in one line → the benefit (what changes) → quick proof (stat or quote) → direct call to action with logo.',
    sceneSeconds: [1.5, 4],
    lengths: [15, 30],
    format: 'portrait',
    look: 'bold-editorial',
    style: 'flat-vector',
    elements: [
      'bigWord',
      'stat',
      'illustration',
      'chips',
      'quote',
      'checklist',
      'showcase',
      'logoReveal',
    ],
    sample: {
      title: 'Lunch sorted',
      chapters: [
        { title: 'Hungry?', tone: 'light' },
        { title: 'Your brand', tone: 'dark' },
      ],
      scenes: [
        {
          chapter: 0,
          headline: 'Still eating at your desk?',
          element: { kind: 'bigWord', text: 'Again?', subtext: '' },
          duration: 2,
        },
        {
          chapter: 0,
          headline: 'Fresh lunch in 10 minutes.',
          element: { kind: 'stat', text: '10 min', subtext: 'from tap to table' },
          duration: 2.5,
        },
        {
          chapter: 0,
          headline: 'Loved by busy people',
          element: {
            kind: 'chips',
            text: 'Fresh. Fast. Fair.',
            items: [item('Healthy'), item('Local'), item('No fees')],
          },
          beats: [at('reveal', 0), at('reveal', 1), at('reveal', 2)],
          duration: 2.5,
        },
        {
          chapter: 1,
          headline: '',
          element: { kind: 'logoReveal', text: 'Order now.' },
          duration: 2.5,
        },
      ],
    },
  },
  {
    id: 'data-story',
    name: 'Data story',
    blurb: 'Turn numbers into a clear story',
    description:
      'A data story that leads with the headline insight, gives context, walks through three or four numbers and says what they mean. Numbers come only from the script.',
    arc: 'Headline insight as a big number → context (why it matters) → three or four numbers, one per scene (stats, sliders, comparisons) → what it means for the viewer → source and call to action with logo.',
    sceneSeconds: [4, 8],
    lengths: [60, 30, 120],
    format: 'landscape',
    look: 'corporate-clean',
    style: 'isometric',
    elements: [
      'stat',
      'sliders',
      'splitCards',
      'radialDiagram',
      'bigWord',
      'checklist',
      'chips',
      'illustration',
      'quote',
      'logoReveal',
    ],
    sample: {
      title: 'Cities on bikes',
      chapters: [
        { title: 'The trend', tone: 'light' },
        { title: 'What it means', tone: 'light' },
        { title: 'Your brand', tone: 'dark' },
      ],
      scenes: [
        {
          chapter: 0,
          headline: 'Bike trips doubled.',
          element: { kind: 'stat', text: '2×', subtext: 'in five years' },
        },
        {
          chapter: 0,
          headline: 'Where people ride',
          element: {
            kind: 'sliders',
            items: [
              item('Commute', 'briefcase'),
              item('Errands', 'shopping-bag'),
              item('Leisure', 'sun'),
            ],
          },
          beats: [at('raise', 3)],
        },
        {
          chapter: 1,
          headline: 'Less traffic, cleaner air.',
          element: {
            kind: 'splitCards',
            items: [
              item('Before', 'car', 'Jams every morning'),
              item('After', 'bike', 'Quieter streets'),
            ],
          },
          beats: [at('reveal', 0), at('reveal', 1)],
        },
        {
          chapter: 2,
          headline: '',
          element: { kind: 'logoReveal', text: 'Data for better cities.' },
        },
      ],
    },
  },
  {
    id: 'testimonial',
    name: 'Testimonial',
    blurb: 'A customer tells their story',
    description:
      'A testimonial built around one person: who they are, what was hard before, what changed, their own words as a quote and the result. Warm and honest, never exaggerated.',
    arc: 'Meet the person (illustration) → what was hard before → what they tried and what changed → their words as a quote → the result (stat) → call to action with logo.',
    sceneSeconds: [4, 9],
    lengths: [60, 30],
    format: 'portrait',
    look: 'cinematic',
    style: 'lifestyle-photo',
    elements: [
      'illustration',
      'quote',
      'stat',
      'splitCards',
      'speechBubble',
      'checklist',
      'bigWord',
      'logoReveal',
    ],
    sample: {
      title: "Sam's bakery",
      chapters: [
        { title: 'Meet Sam', tone: 'light' },
        { title: 'What changed', tone: 'light' },
        { title: 'Your brand', tone: 'dark' },
      ],
      scenes: [
        {
          chapter: 0,
          headline: 'Sam bakes before sunrise.',
          caption: 'Twenty years, one oven.',
          element: {
            kind: 'illustration',
            prompt: 'A baker taking fresh bread out of an oven in a small bakery',
          },
        },
        {
          chapter: 1,
          headline: 'In Sam’s words',
          element: {
            kind: 'quote',
            text: 'Now I spend my mornings baking, not on paperwork.',
            subtext: 'Sam, baker',
          },
        },
        {
          chapter: 1,
          headline: 'Back to what matters.',
          element: { kind: 'stat', text: '6 h', subtext: 'saved every week' },
        },
        { chapter: 2, headline: '', element: { kind: 'logoReveal', text: 'Made for makers.' } },
      ],
    },
  },
  {
    id: 'announcement',
    name: 'Event / announcement',
    blurb: 'Announce news, an event or a date',
    description:
      'An announcement: the news in one big line, what it is, when and where, why it is worth it, and the date or link to act on. Short and energetic.',
    arc: 'The news as a big word → what it is → when and where (chips or checklist) → why come or why it matters → call to action with the date and logo.',
    sceneSeconds: [2.5, 6],
    lengths: [15, 30],
    format: 'square',
    look: 'playful',
    style: 'risograph',
    elements: [
      'bigWord',
      'chips',
      'checklist',
      'illustration',
      'stat',
      'speechBubble',
      'logoReveal',
    ],
    sample: {
      title: 'Open studio day',
      chapters: [
        { title: 'Save the date', tone: 'light' },
        { title: 'Your brand', tone: 'dark' },
      ],
      scenes: [
        {
          chapter: 0,
          headline: 'Open studio day',
          element: { kind: 'bigWord', text: 'You’re invited', subtext: 'Saturday 12 June' },
          duration: 3,
        },
        {
          chapter: 0,
          headline: 'What’s on',
          element: {
            kind: 'chips',
            text: 'All day, free entry',
            items: [item('Workshops'), item('Live music'), item('Food')],
          },
          beats: [at('reveal', 0), at('reveal', 1), at('reveal', 2)],
          duration: 3.5,
        },
        {
          chapter: 1,
          headline: '',
          element: { kind: 'logoReveal', text: 'See you there.' },
          duration: 3,
        },
      ],
    },
  },
  {
    id: 'kinetic-quote',
    name: 'Kinetic quote',
    blurb: 'Words in motion: a quote, a message, a manifesto',
    description:
      'Kinetic typography: the words are the visual. Short lines land one at a time in rhythm with the narration; pictures are rare and atmospheric.',
    arc: 'Opening line as big words → the message built line by line (big words, quotes, chips) → one atmospheric picture at most → closing line → logo.',
    sceneSeconds: [2, 5],
    lengths: [15, 30, 60],
    format: 'portrait',
    look: 'cinematic',
    style: 'ink-wash',
    elements: ['bigWord', 'quote', 'chips', 'speechBubble', 'illustration', 'logoReveal'],
    sample: {
      title: 'Start small',
      chapters: [
        { title: 'A thought', tone: 'light' },
        { title: 'Your brand', tone: 'dark' },
      ],
      scenes: [
        {
          chapter: 0,
          headline: '',
          element: { kind: 'bigWord', text: 'Start small.', subtext: '' },
          duration: 2.5,
        },
        {
          chapter: 0,
          headline: '',
          element: { kind: 'bigWord', text: 'Then keep going.', subtext: '' },
          duration: 2.5,
        },
        {
          chapter: 0,
          headline: '',
          element: { kind: 'quote', text: 'Every big thing was once a first step.', subtext: '' },
          duration: 3.5,
        },
        {
          chapter: 1,
          headline: '',
          element: { kind: 'logoReveal', text: 'Begin today.' },
          duration: 3,
        },
      ],
    },
  },
]

export const getKind = (id: string): Kind => KINDS.find((kind) => kind.id === id) ?? KINDS[0]!
export const isKind = (id: string) => KINDS.some((kind) => kind.id === id)

/** "1 min", "30 s", "2 min". */
export const lengthLabel = (seconds: number) =>
  seconds >= 60 ? `${seconds / 60} min` : `${seconds} s`