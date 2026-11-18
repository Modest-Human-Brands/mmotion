import { getBlob, hashKey, putBlob } from '@/core/audio/cache'
import type { Cast, SceneElement } from '@/core/composition/schema'
import { generateImage } from '@/core/llm/client'
import type { Template } from '@/core/templates'

const SIZE = '1024x1024'

/**
 * The full prompt for an illustration: the cast members in the picture, described the same way
 * every time (this is what keeps characters consistent), the template's style line, then the
 * scene action.
 */
export function illustrationPrompt(template: Template, cast: Cast, element: SceneElement): string {
  const named = new Set(element.cast.map((name) => name.toLowerCase()))
  const members = cast.members.filter((member) => named.has(member.name.toLowerCase()))
  const characters = members.length
    ? `Characters: ${members.map((member) => `${member.name.toUpperCase()}: ${member.description}`).join(' ')} `
    : ''
  return `${characters}Style: ${template.illustrationStyle} Scene: ${element.prompt.trim()} Full body, centered.`
}

/** Same prompt + seed + model → same picture; `variant` asks for another take. */
export const illustrationSeed = (cast: Cast, element: SceneElement) =>
  cast.seed + element.variant * 7919

export async function illustrationKey(prompt: string, seed: number, model: string) {
  return hashKey('image', model, String(seed), prompt)
}

export async function cachedIllustration(key: string): Promise<Blob | undefined> {
  return getBlob(key)
}

export async function renderIllustration(
  baseUrl: string,
  model: string,
  key: string,
  prompt: string,
  seed: number,
  signal?: AbortSignal,
): Promise<Blob> {
  const blob = await generateImage(baseUrl, model, prompt, { size: SIZE, seed, signal })
  await putBlob(key, blob)
  return blob
}