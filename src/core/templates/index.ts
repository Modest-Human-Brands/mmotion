import type { BrandTokens, Chapter, FormatId, TransitionId } from '@/core/composition/schema'
import type { OrganizationProfile } from '@/domain/organization'
import { hexToHsl, hslToHex, normalizeHex } from '@/domain/proceduralGradient'

export type EnterMotion = 'rise' | 'pop' | 'wipe' | 'blur'
export type BackgroundKind = 'shapes' | 'grid' | 'gradient' | 'blocks'

/**
 * A look is a design system: how scenes are dressed (chrome, type, colour per chapter, background,
 * motion). The story's shape comes from the kind (`core/kinds`) and how pictures are drawn from the
 * art style (`core/styles`). Pure data; components read it through CSS variables. Stored in the
 * composition as `templateId`.
 */
export interface Template {
  id: string
  name: string
  /** One line for the picker. */
  blurb: string
  /** Read by the language models when they write or edit in this look. */
  description: string
  format: FormatId
  /** Headline and visual placement: `left` = editorial (eyebrow, heading top-left, caption card). */
  align: 'left' | 'center'
  /** Heading font the look is designed around; the brand font is used for body text. */
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
  /** Art style that suits the look when the kind does not say otherwise. */
  style: string
}
export type Look = Template

export const TEMPLATES: Template[] = [
  {
    id: 'soft-explainer',
    name: 'Soft',
    blurb: 'Warm editorial, a pastel colour per chapter',
    description:
      'Warm and calm. Editorial layout: small uppercase chapter label, elegant serif headline top-left, one visual in the middle, a rounded caption card underneath. Each chapter has its own soft pastel colour; the closing chapter is dark in the brand colour with the logo. Unhurried motion.',
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
    style: 'storybook',
  },
  {
    id: 'minimal-tech',
    name: 'Minimal tech',
    blurb: 'Dark canvas, fine grid, crisp type',
    description:
      'Calm and precise: dark canvas, fine grid, crisp sans headings rising into place, generous whitespace, accent used sparingly. Short sentences, one idea per scene.',
    format: 'landscape',
    align: 'center',
    palette: 'brand',
    theme: 'dark',
    background: 'grid',
    type: { headingScale: 0.085, headingWeight: 700, uppercase: false, tracking: '-0.02em' },
    motion: { enter: 'rise', ease: 'power3.out', stagger: 0.12, duration: 0.7 },
    transitions: ['fade', 'slide'],
    radius: 0.02,
    style: 'isometric',
  },
  {
    id: 'bold-editorial',
    name: 'Bold editorial',
    blurb: 'Huge uppercase type, hard cuts',
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
    style: 'pop-art',
  },
  {
    id: 'soft-gradient',
    name: 'Gradient',
    blurb: 'Drifting brand gradients, rounded cards',
    description:
      'Friendly and modern: drifting brand-colour gradients, rounded cards, headings that softly pop in, gentle crossfades and zooms.',
    format: 'landscape',
    align: 'center',
    palette: 'brand',
    theme: 'dark',
    background: 'gradient',
    type: { headingScale: 0.08, headingWeight: 600, uppercase: false, tracking: '-0.01em' },
    motion: { enter: 'pop', ease: 'back.out(1.6)', stagger: 0.14, duration: 0.8 },
    transitions: ['fade', 'zoom'],
    radius: 0.035,
    style: 'flat-vector',
  },
  {
    id: 'corporate-clean',
    name: 'Corporate clean',
    blurb: 'Light, structured, trustworthy',
    description:
      'Clear and trustworthy: light background with a faint grid, confident sans headings, brand colour for emphasis, tidy alignment, measured slides. Suits data, reports and B2B.',
    format: 'landscape',
    align: 'left',
    displayFont: 'Inter',
    palette: 'brand',
    theme: 'light',
    background: 'grid',
    type: { headingScale: 0.075, headingWeight: 700, uppercase: false, tracking: '-0.015em' },
    motion: { enter: 'rise', ease: 'power2.out', stagger: 0.1, duration: 0.6 },
    transitions: ['slide', 'fade'],
    radius: 0.015,
    style: 'isometric',
  },
  {
    id: 'playful',
    name: 'Playful',
    blurb: 'Bouncy, round and colourful',
    description:
      'Cheerful and bouncy: rounded heavy headings that pop in with overshoot, floating soft shapes, a fresh pastel per chapter, zooms between scenes. Suits events, kids and friendly brands.',
    format: 'square',
    align: 'center',
    displayFont: 'Baloo 2',
    palette: 'pastel',
    theme: 'light',
    background: 'shapes',
    type: { headingScale: 0.09, headingWeight: 800, uppercase: false, tracking: '0em' },
    motion: { enter: 'pop', ease: 'back.out(2.2)', stagger: 0.1, duration: 0.6 },
    transitions: ['zoom', 'slide'],
    radius: 0.05,
    style: 'sticker',
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    blurb: 'Dark, slow and dramatic',
    description:
      'Film-like and emotional: deep dark gradients, elegant serif headings that resolve out of a blur, slow crossfades, lots of breathing room. Suits stories, testimonials and manifestos.',
    format: 'landscape',
    align: 'center',
    displayFont: 'Playfair Display',
    palette: 'brand',
    theme: 'dark',
    background: 'gradient',
    type: { headingScale: 0.08, headingWeight: 500, uppercase: false, tracking: '0em' },
    motion: { enter: 'blur', ease: 'power2.out', stagger: 0.2, duration: 1.1 },
    transitions: ['fade', 'zoom'],
    radius: 0.01,
    style: 'cinematic-photo',
  },
  {
    id: 'retro',
    name: 'Retro',
    blurb: 'Chunky type and colour blocks',
    description:
      'Retro poster energy: chunky display type in uppercase, solid colour blocks, hard wipes and cuts, warm brand colours. Suits games, music, food and nostalgic brands.',
    format: 'portrait',
    align: 'left',
    displayFont: 'Bungee',
    palette: 'brand',
    theme: 'light',
    background: 'blocks',
    type: { headingScale: 0.085, headingWeight: 400, uppercase: true, tracking: '0.01em' },
    motion: { enter: 'wipe', ease: 'expo.out', stagger: 0.1, duration: 0.5 },
    transitions: ['wipe', 'cut'],
    radius: 0,
    style: 'pixel-16',
  },
]
export const LOOKS = TEMPLATES

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

/** A dark colour: light text goes on it, and pictures on white cannot be blended into it. */
export const isDark = (hex: string) => luminance(hex) < 0.45

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