import type { FontSummary } from './types'

export const FONT_CATALOGUE: string[] = [
  'Exo 2',
  'Inter',
  'Roboto',
  'Poppins',
  'Lato',
  'Montserrat',
  'Open Sans',
  'Oxanium',
  'Rajdhani',
  'Teko',
  'Dosis',
  'Playfair Display',
  'Merriweather',
  'Raleway',
  'Nunito',
  'Work Sans',
  'DM Sans',
  'Manrope',
  'Space Grotesk',
  'Sora',
  'Outfit',
  'Bebas Neue',
  'Oswald',
  'Lora',
  'Cormorant Garamond',
  'Abril Fatface',
  'Archivo',
  'Rubik',
  'Barlow',
  'JetBrains Mono',
  'IBM Plex Sans',
  'Libre Baskerville',
  'Josefin Sans',
]

const toFontSummary = (family: string): FontSummary => ({
  family,
  name: family.replaceAll(/\s+/g, ''),
})

export function searchFonts(query: string, limit = 20): FontSummary[] {
  const needle = query.trim().toLowerCase()
  const list = needle
    ? FONT_CATALOGUE.filter((family) => family.toLowerCase().includes(needle))
    : FONT_CATALOGUE.slice(0, 10)
  return list.slice(0, limit).map((family) => toFontSummary(family))
}

const loaded = new Map<string, Promise<boolean>>()

async function toDataUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Font request failed (${response.status})`)
  const blob = await response.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function loadGoogleFont(family: string): Promise<boolean> {
  const name = family.trim()
  if (name === '') return Promise.resolve(false)

  let pending = loaded.get(name)
  if (!pending) {
    pending = (async () => {
      try {
        const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replaceAll('%20', '+')}:wght@400;700&display=swap`
        const response = await fetch(href)
        if (!response.ok) return false
        let css = await response.text()

        const urls = [
          ...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((match) => match[1]!)),
        ]
        const entries = await Promise.all(
          urls.map(async (url) => [url, await toDataUrl(url)] as const),
        )
        for (const [url, data] of entries) css = css.replaceAll(url, data)

        const style = document.createElement('style')
        style.dataset.mmotionFont = name
        style.textContent = css
        document.head.append(style)
        await document.fonts.load(`400 16px "${name}"`)
        return true
      } catch {
        return false
      }
    })()
    loaded.set(name, pending)
    void pending.then((ok) => {
      if (!ok) loaded.delete(name)
    })
  }
  return pending
}