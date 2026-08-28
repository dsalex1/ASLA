import { ref as firebaseRef, getDownloadURL, getStorage } from 'firebase/storage'

const CACHE_NAME = 'offline-v1'

/**
 * Keyed by content, not by path: the same song pinned in five setlists is stored once,
 * and collecting garbage is set arithmetic over the keys. Songs uploaded before hashes
 * existed fall back to the path, and are simply re-downloaded whenever they are refreshed.
 */
export const cacheKey = (ref: string, hash?: string) => `/offline/${hash ?? `ref:${encodeURIComponent(ref)}`}`

/** Cache Storage is absent on insecure origins and in the test environment. */
const openCache = async () => {
  if (typeof caches === 'undefined') return undefined
  return await caches.open(CACHE_NAME).catch(() => undefined)
}

const cached = async (ref: string, hash?: string) => await (await openCache())?.match(cacheKey(ref, hash))

const downloadUrl = (ref: string) => getDownloadURL(firebaseRef(getStorage(), ref))

/** A URL for <img>: the offline copy when there is one, else the live download URL. */
export async function resolveRef(ref: string, hash?: string) {
  const hit = await cached(ref, hash)
  return hit ? URL.createObjectURL(await hit.blob()) : await downloadUrl(ref)
}

/** The bytes themselves, for pdf-lib and decodeAudioData — no object URL to leak. */
export async function resolveBytes(ref: string, hash?: string) {
  const hit = await cached(ref, hash)
  return await (hit ?? (await fetch(await downloadUrl(ref)))).arrayBuffer()
}

export const isCached = async (ref: string, hash?: string) => !!(await cached(ref, hash))

/** Downloads and stores one ref, or does nothing if that exact content is already held. */
export async function cacheRef(ref: string, hash?: string) {
  const cache = await openCache()
  if (!cache) throw new Error('This browser has no offline storage available')
  const key = cacheKey(ref, hash)
  if (await cache.match(key)) return
  const response = await fetch(await downloadUrl(ref))
  if (!response.ok) throw new Error(`Downloading ${ref} failed with ${response.status}`)
  await cache.put(key, response)
}

/**
 * Replaces a copy already held offline with bytes in hand, so saving an annotation does
 * not leave pinned devices holding the un-annotated page until the next refresh.
 * Does nothing for content that was not being kept offline in the first place.
 */
export async function recache(ref: string, oldHash: string | undefined, newHash: string, blob: Blob) {
  const cache = await openCache()
  const oldKey = cacheKey(ref, oldHash)
  if (!cache || !(await cache.match(oldKey))) return
  await cache.delete(oldKey)
  await cache.put(cacheKey(ref, newHash), new Response(blob))
}

/** Drops every stored blob whose key is not in `keep`. */
export async function collectGarbage(keep: Set<string>) {
  const cache = await openCache()
  if (!cache) return
  for (const request of await cache.keys()) {
    if (!keep.has(new URL(request.url).pathname)) await cache.delete(request)
  }
}

/**
 * Asks for the storage to survive eviction. Chrome grants it silently to installed apps;
 * Safari treats an installed web app as persistent already. Failure is not fatal — it
 * only means the copies may be evicted under disk pressure.
 */
export const persistStorage = async () => (await navigator.storage?.persist?.()) ?? false

export const storageEstimate = async () => await navigator.storage?.estimate?.()

/**
 * Bytes held under each cache key. Firebase serves a content-length, so this is normally
 * a header read; only a response without one has to be measured by reading the body.
 */
export async function cacheSizes() {
  const cache = await openCache()
  const sizes = new Map<string, number>()
  if (!cache) return sizes
  for (const request of await cache.keys()) {
    const response = await cache.match(request)
    if (!response) continue
    const declared = Number(response.headers.get('content-length'))
    sizes.set(new URL(request.url).pathname, declared || (await response.blob()).size)
  }
  return sizes
}
