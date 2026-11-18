import type { BrandTokens } from '@/core/composition/schema'
import type { Palette, Template } from '@/core/templates'

const family = (name: string) =>
  `'${name.replaceAll("'", '')}', 'Exo 2 Variable', system-ui, sans-serif`

/** Type and shape variables, set once on the stage. Sizes use the stage's container units. */
export function stageVars(template: Template, brand: BrandTokens): Record<string, string> {
  return {
    '--font-display': family(brand.fontDisplay),
    '--font-body': family(brand.fontBody),
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