import { cacheKey, cacheRef, collectGarbage, isCached, persistStorage } from '@/helpers/offlineCache'
import { offlineSongRefs } from '@/helpers/songRefs'
import { setlistCollection, songCollection } from '@/plugins/firebase'
import { Song } from '@/types'
import { getDocs } from 'firebase/firestore'
import { get, set } from 'idb-keyval'
import { computed, ref } from 'vue'

const PINS_KEY = 'offlinePins'

/**
 * setlist id -> the cache keys it put there. Keeping the keys rather than the refs means
 * collecting garbage never needs Firestore: what to keep is the union of these lists.
 */
const pins = ref<Record<string, string[]>>({})
const progress = ref<{ setlistId: string; done: number; total: number } | null>(null)

let loading: Promise<void> | undefined
const ensureLoaded = () =>
  (loading ??= get<Record<string, string[]>>(PINS_KEY)
    .then((stored) => void (pins.value = stored ?? {}))
    .catch((e) => console.warn('Could not read the offline pins:', e)))

/** Four at a time: a setlist is hundreds of small files, and serial downloads crawl. */
const CONCURRENCY = 4
async function pool<T>(items: T[], run: (item: T) => Promise<void>) {
  const queue = [...items]
  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await run(item)
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
}

/** True when every file this song needs to render is already held offline. */
export async function isSongCached(song: Song) {
  const refs = offlineSongRefs(song)
  const held = await Promise.all(refs.map((ref) => isCached(ref, song.hashes?.[ref])))
  return held.every(Boolean)
}

export function useOfflinePins() {
  ensureLoaded()

  const pinnedIds = computed(() => Object.keys(pins.value))
  const isPinned = (setlistId: string) => setlistId in pins.value

  // published last, so anything watching the pins measures the cache after it has settled
  // rather than while the blobs an unpin is dropping are still there
  async function save(next: Record<string, string[]>) {
    await set(PINS_KEY, next)
    await collectGarbage(new Set(Object.values(next).flat()))
    pins.value = next
  }

  /**
   * Downloads whatever this setlist needs and is not already holding, then records the
   * keys. Doubles as refresh: content that has not changed keeps its hash, so it is
   * already in the cache and skipped, and only genuinely new bytes are fetched.
   */
  async function pin(setlistId: string, songs: Song[]) {
    await ensureLoaded()
    const wanted = songs.flatMap((song) => offlineSongRefs(song).map((ref) => ({ ref, hash: song.hashes?.[ref] })))
    progress.value = { setlistId, done: 0, total: wanted.length }

    const keys: string[] = []
    const failed: string[] = []
    try {
      await persistStorage()
      // the views read whole collections, so this leaves every song's text in the
      // firestore cache whether or not the user has opened the view that lists it
      await Promise.all([getDocs(songCollection), getDocs(setlistCollection)])

      await pool(wanted, async ({ ref, hash }) => {
        try {
          await cacheRef(ref, hash)
          keys.push(cacheKey(ref, hash))
        } catch (e) {
          console.warn('Could not store', ref, 'offline:', e)
          failed.push(ref)
        }
        if (progress.value) progress.value = { ...progress.value, done: progress.value.done + 1 }
      })
      // recorded even when incomplete, so the songs that did arrive stay available and a
      // later refresh only has to pick up the rest
      await save({ ...pins.value, [setlistId]: keys })
    } finally {
      progress.value = null
    }

    if (failed.length) throw new Error(`${failed.length} of ${wanted.length} files could not be downloaded`)
  }

  async function unpin(setlistId: string) {
    await ensureLoaded()
    const { [setlistId]: _removed, ...rest } = pins.value
    await save(rest)
  }

  return { pins, pinnedIds, isPinned, pin, unpin, progress }
}
