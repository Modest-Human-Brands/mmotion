import type {
  BrandTokens,
  Chapter,
  ElementKind,
  FormatId,
  TransitionId,
} from '@/core/composition/schema'
import type { OrganizationProfile } from '@/domain/organization'
import { hexToHsl, hslToHex, normalizeHex } from '@/domain/proceduralGradient'

export type EnterMotion = 'rise' | 'pop' | 'wipe' | 'blur'
export type BackgroundKind = 'shapes' | 'grid' | 'gradient' | 'blocks'

/**
 * A template is a design system plus a storytelling kit: how scenes are dressed (chrome, type,
 * colour per chapter, background, motion), how illustrations look, and which story arc and
 * visual elements suit it. Pure data; components read it through CSS variables.
 */
export interface Template {
  id: string
  name: string
  /** Read by the language models when they write or edit in this template. */
  description: string
  format: FormatId
  /** Headline and visual placement: `left` = editorial (eyebrow, heading top-left, caption card). */
  align: 'left' | 'center'
  /** Heading font the template is designed around; the brand font is used for body text. */
  displayFont?: string
  /** `pastel`: a soft colour per chapter derived from the brand accent; `brand`: brand colours throughout. */
  palette: 'pastel' | 'brand'
  theme: 'light' | 'dark'
  background: BackgroundKind
  type: {
    /** Heading size as a fraction of the frame's shorter side. */
    headingScale: number
    headingWeight: number
    uppercase: boolean
    tracking: string
  }
  motion: { enter: EnterMotion; ease: string; stagger: number; duration: number }
  transitions: TransitionId[]
  radius: number
  /** Appended to every illustration prompt so all pictures share one look. */
  illustrationStyle: string
  /** Story structure the story agent follows. */
  arc: string
  /** Visual elements that suit the template, in rough order of preference. */
  elements: ElementKind[]
}

const ALL_DIAGRAMS: ElementKind[] = [
  'radialDiagram',
  'chips',
  'sliders',
  'checklist',
  'speechBubble',
  'splitCards',
  'bigWord',
  'stat',
  'quote',
]

export const TEMPLATES: Template[] = [
  {
    id: 'soft-explainer',
    name: 'Soft Explainer',
    description:
      'Warm, calm explainer for parents, health and education. Editorial layout: small uppercase chapter label, elegant serif headline top-left, one visual in the middle (a gentle flat illustration of the recurring characters or a simple diagram), a rounded caption card underneath. Each chapter has its own soft pastel colour; the closing chapter is dark in the brand colour with the logo. Unhurried pacing, one idea per scene, captions change as the narration moves on.',
    format: 'portrait',
    align: 'left',
    displayFont: 'Lora',
    palette: 'pastel',
    theme: 'light',
    background: 'shapes',
    type: { headingScale: 0.075, headingWeight: 500, uppercase: false, tracking: '-0.01em' },
    motion: { enter: 'rise', ease: 'power2.out', stagger: 0.14, duration: 0.8 },
    transitions: ['fade', 'slide'],
    radius: 0.025,
    illustrationStyle:
      'Flat children-book illustration, soft pastel palette, clean thin outlines, gentle shading, soft ground shadow, plain white background, no text, no frame.',
    arc: 'Hook with a relatable everyday moment → name the problem → explain how it works (diagrams) → reassure → numbered practical steps (STEP 01/05 …) → warm closing thought → dark brand chapter with the promise and logo.',
    elements: ['illustration', ...ALL_DIAGRAMS, 'logoReveal'],
  },
  {
    id: 'minimal-tech',
    name: 'Minimal Tech',
    description:
      'Calm product-launch look: dark canvas, fine grid, crisp sans headings rising into place, generous whitespace, accent used sparingly. Prefers diagrams, stats and checklists over illustrations. Short sentences, one idea per scene.',
    format: 'landscape',
    align: 'center',
    palette: 'brand',
    theme: 'dark',
    background: 'grid',
    type: { headingScale: 0.085, headingWeight: 700, uppercase: false, tracking: '-0.02em' },
    motion: { enter: 'rise', ease: 'power3.out', stagger: 0.12, duration: 0.7 },
    transitions: ['fade', 'slide'],
    radius: 0.02,
    illustrationStyle:
      'Minimal isometric 3D render, matte materials, soft studio light, dark neutral background, no text.',
    arc: 'Hook → problem → product → three key features (diagrams, stats) → proof → call to action with logo.',
    elements: [
      'bigWord',
      'stat',
      'checklist',
      'sliders',
      'radialDiagram',
      'chips',
      'splitCards',
      'illustration',
      'logoReveal',
    ],
  },
  {
    id: 'bold-editorial',
    name: 'Bold Editorial',
    description:
      'Loud magazine energy: huge uppercase headings, hard cuts and wipes, solid colour blocks in the accent colour, fast pacing with punchy three-to-five word statements and big numbers.',
    format: 'portrait',
    align: 'left',
    palette: 'brand',
    theme: 'light',
    background: 'blocks',
    type: { headingScale: 0.11, headingWeight: 800, uppercase: true, tracking: '-0.01em' },
    motion: { enter: 'wipe', ease: 'expo.out', stagger: 0.08, duration: 0.55 },
    transitions: ['cut', 'wipe'],
    radius: 0,
    illustrationStyle:
      'Bold graphic poster illustration, high contrast, limited flat colours, thick shapes, white background, no text.',
    arc: 'Provocative statement → three to five punchy points (big words, stats, chips) → one quote → loud call to action with logo.',
    elements: [
      'bigWord',
      'stat',
      'chips',
      'quote',
      'checklist',
      'illustration',
      'splitCards',
      'logoReveal',
    ],
  },
  {
    id: 'soft-gradient',
    name: 'Soft Gradient',
    description:
      'Friendly and modern: drifting brand-colour gradients, rounded cards, headings that softly pop in, gentle crossfades and zooms. Conversational, benefit-led copy with friendly illustrations and simple diagrams.',
    format: 'landscape',
    align: 'center',
    palette: 'brand',
    theme: 'dark',
    background: 'gradient',
    type: { headingScale: 0.08, headingWeight: 600, uppercase: false, tracking: '-0.01em' },
    motion: { enter: 'pop', ease: 'back.out(1.6)', stagger: 0.14, duration: 0.8 },
    transitions: ['fade', 'zoom'],
    radius: 0.035,
    illustrationStyle:
      'Friendly rounded vector illustration, soft gradients, playful proportions, plain white background, no text.',
    arc: 'Friendly hook → the everyday pain → how it gets better (illustrations, splitCards) → benefits (checklist, stat) → invitation with logo.',
    elements: [
      'illustration',
      'splitCards',
      'checklist',
      'stat',
      'chips',
      'radialDiagram',
      'speechBubble',
      'logoReveal',
    ],
  },
]

export const getTemplate = (id: string): Template =>
  TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0]!
export const isTemplate = (id: string) => TEMPLATES.some((template) => template.id === id)

/** Colours a scene uses. */
export interface Palette {
  background: string
  surface: string
  text: string
  muted: string
  primary: string
  accent: string
  onAccent: string
}

const luminance = (hex: string) => {
  const n = Number.parseInt(normalizeHex(hex).slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)) / 255
}

const onColor = (hex: string) => (luminance(hex) > 0.6 ? '#1f2328' : '#ffffff')

/** Hue steps between chapters, so neighbouring chapters never share a colour. */
const PASTEL_STEPS = [0, 190, 250, 50, 140, 310]

function darkPalette(brand: BrandTokens): Palette {
  const [h, s] = hexToHsl(brand.primary)
  const background = hslToHex(h, Math.min(Math.max(s, 35), 60), 18)
  return {
    background,
    surface: hslToHex(h, Math.min(s, 40), 24),
    text: '#ffffff',
    muted: '#ffffffb3',
    primary: brand.primary,
    accent: brand.accent,
    onAccent: onColor(brand.accent),
  }
}

/** The palette for a chapter: pastel chapters rotate around the brand accent's hue. */
export function chapterPalette(
  template: Template,
  brand: BrandTokens,
  chapter: Chapter,
  chapterIndex: number,
): Palette {
  if (chapter.tone === 'dark') return darkPalette(brand)
  if (template.palette === 'pastel') {
    const [h] = hexToHsl(brand.accent)
    const hue = (h + PASTEL_STEPS[chapterIndex % PASTEL_STEPS.length]!) % 360
    return {
      background: hslToHex(hue, 70, 94),
      surface: '#ffffffd9',
      text: '#2a2a2e',
      muted: '#2a2a2ea6',
      primary: brand.primary,
      accent: hslToHex(hue, 45, 52),
      onAccent: '#ffffff',
    }
  }
  const dark = luminance(brand.background) < 0.5
  return {
    background: brand.background,
    surface: dark ? '#ffffff14' : '#0f172a0d',
    text: brand.text,
    muted: dark ? '#ffffffa6' : '#0f172aa6',
    primary: brand.primary,
    accent: brand.accent,
    onAccent: onColor(brand.accent),
  }
}

/** First brand tokens for a new video: the organization profile, framed by the template. */
export function brandFromOrganization(org: OrganizationProfile, template: Template): BrandTokens {
  const primary = normalizeHex(org.primary, '#1f4d3a')
  const accent = normalizeHex(org.accent, '#e0784f')
  const [h, s] = hexToHsl(primary)
  const dark = template.theme === 'dark'
  return {
    name: org.name.trim(),
    logo: org.logo?.dataUrl ?? '',
    primary,
    accent,
    background: dark ? hslToHex(h, Math.min(s, 40), 8) : hslToHex(h, Math.min(s, 20), 97),
    text: dark ? '#ffffff' : '#1f2328',
    fontDisplay: template.displayFont ?? (org.font || 'Exo 2'),
    fontBody: org.font || 'Exo 2',
  }
}