import { getBlob, putBlob } from '@/core/audio/cache'

/**
 * User and generated assets (reference crops, uploads, sheets, voice samples), stored in IndexedDB
 * under the hash of their bytes so the composition only carries short ids.
 */

const urls = new Map<string, string>()

async function digest(blob: Blob): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(bytes)]
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Save `blob`; returns its id. Saving the same bytes twice returns the same id. */
export async function putAsset(blob: Blob): Promise<string> {
  const id = `a${await digest(blob)}`
  await putBlob(`asset:${id}`, blob)
  urls.set(id, urls.get(id) ?? URL.createObjectURL(blob))
  return id
}

export async function getAsset(id: string): Promise<Blob | undefined> {
  return id ? getBlob(`asset:${id}`) : undefined
}

/** An object URL for the asset, or null when it is missing. */
export async function assetUrl(id: string): Promise<string | null> {
  if (!id) return null
  const known = urls.get(id)
  if (known) return known
  const blob = await getAsset(id)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urls.set(id, url)
  return url
}

/** The URL when it is already loaded (for synchronous rendering). */
export const loadedAssetUrl = (id: string) => urls.get(id) ?? null

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}