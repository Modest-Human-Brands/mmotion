import type { BrandTokens } from '@/core/composition/schema'
import type { Palette, Template } from '@/core/templates'

/** Fonts that cover each non-Latin script, used after the brand font for the missing glyphs. */
export const SCRIPT_FONTS: Record<string, { display: string; body: string }> = {
  bn: { display: 'Noto Serif Bengali', body: 'Noto Sans Bengali' },
  hi: { display: 'Noto Serif Devanagari', body: 'Noto Sans Devanagari' },
}

const family = (name: string, script?: string) =>
  `'${name.replaceAll("'", '')}', ${script ? `'${script}', ` : ''}'Exo 2 Variable', system-ui, sans-serif`

/** Every font family a stage needs (brand fonts plus script fallbacks). */
export function stageFonts(brand: BrandTokens, language = 'en'): string[] {
  const script = SCRIPT_FONTS[language]
  return [brand.fontDisplay, brand.fontBody, ...(script ? [script.display, script.body] : [])]
}

/** Type and shape variables, set once on the stage. Sizes use the stage's container units. */
export function stageVars(
  template: Template,
  brand: BrandTokens,
  language = 'en',
): Record<string, string> {
  const script = SCRIPT_FONTS[language]
  return {
    '--font-display': family(brand.fontDisplay, script?.display),
    '--font-body': family(brand.fontBody, script?.body),
    '--heading-size': `${template.type.headingScale * 100}cqmin`,
    '--heading-weight': String(template.type.headingWeight),
    '--heading-case': template.type.uppercase ? 'uppercase' : 'none',
    '--tracking': template.type.tracking,
    '--radius': `${template.radius * 100}cqmin`,
  }
}

/** Colour variables, set per scene because each chapter can have its own palette. */
export function paletteVars(palette: Palette): Record<string, string> {
  return {
    '--c-bg': palette.background,
    '--c-surface': palette.surface,
    '--c-text': palette.text,
    '--c-muted': palette.muted,
    '--c-primary': palette.primary,
    '--c-accent': palette.accent,
    '--c-on-accent': palette.onAccent,
  }
}