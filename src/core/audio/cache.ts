/** A tiny IndexedDB blob store; voiceover is expensive to regenerate and too large for localStorage. */

const DB_NAME = 'mmotion'
const STORE = 'audio'

let opening: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return opening
}

async function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const request = work(db.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => resolve(request.result as T)
    request.onerror = () => reject(request.error)
  })
}

export const getBlob = (key: string) =>
  run<Blob | undefined>('readonly', (store) => store.get(key)).catch(() => undefined)

export const putBlob = (key: string, blob: Blob) =>
  run<IDBValidKey>('readwrite', (store) => store.put(blob, key)).catch(() => undefined)

export async function hashKey(...parts: string[]): Promise<string> {
  const bytes = new TextEncoder().encode(parts.join('\u0000'))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}