import { ref } from 'vue'

import { DEFAULT_FONT } from '@/domain/organization'
import { FONT_CATALOGUE, loadGoogleFont, searchFonts } from '@/domain/fonts'
import type { FontSummary } from '@/domain/types'

export function useFonts() {
  const fonts = ref<FontSummary[]>(searchFonts(''))
  const loading = ref(false)
  const offline = ref(false)

  function search(query = '') {
    fonts.value = searchFonts(query)
  }

  async function isKnown(family: string): Promise<boolean | null> {
    if (family === DEFAULT_FONT) return true
    if (!FONT_CATALOGUE.some((name) => name.toLowerCase() === family.toLowerCase())) return false
    const ok = await loadGoogleFont(family)
    offline.value = !ok
    return ok ? true : null
  }

  return { fonts, loading, offline, search, isKnown }
}