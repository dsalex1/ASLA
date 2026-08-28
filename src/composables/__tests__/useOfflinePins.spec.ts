import { Song } from '@/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('idb-keyval', () => {
  const store = new Map<string, unknown>()
  return {
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: unknown) => void store.set(key, value)),
  }
})

const song = (id: string, extra: Partial<Song> = {}): Song => ({
  id,
  filename: `${id}.pdf`,
  pdfImageStorageRefs: [`sheet_images/${id}.webp`],
  hashes: { [`sheet_images/${id}.webp`]: `hash-${id}` },
  ...extra,
})

/** The module keeps the pins in module scope, so each test needs a fresh copy of it. */
const freshPins = async () => (await import('@/composables/useOfflinePins')).useOfflinePins()

beforeEach(async () => {
  vi.resetModules()
  await caches.delete('offline-v1')
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => Promise.resolve(new Response(new TextEncoder().encode(`body of ${url}`))))
  )
})

describe('pinning', () => {
  it('downloads every file the setlist needs and remembers it is pinned', async () => {
    const pins = await freshPins()
    await pins.pin('set-1', [song('a'), song('b')])

    expect(pins.isPinned('set-1')).toBe(true)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
  })

  it('reports failures but keeps whatever did arrive', async () => {
    const pins = await freshPins()
    vi.mocked(fetch).mockResolvedValueOnce(new Response('nope', { status: 500 }))

    await expect(pins.pin('set-1', [song('a'), song('b')])).rejects.toThrow('1 of 2 files')
    // still pinned, so the songs that made it are usable and a refresh only fetches the rest
    expect(pins.isPinned('set-1')).toBe(true)

    const { isSongCached } = await import('@/composables/useOfflinePins')
    const cached = await Promise.all([isSongCached(song('a')), isSongCached(song('b'))])
    expect(cached.filter(Boolean)).toHaveLength(1)
  })

  it('refreshing fetches only what changed', async () => {
    const pins = await freshPins()
    await pins.pin('set-1', [song('a'), song('b')])
    vi.mocked(fetch).mockClear()

    const edited = song('b', { hashes: { 'sheet_images/b.webp': 'hash-b-edited' } })
    await pins.pin('set-1', [song('a'), edited])

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it('drops the copy of content that no longer belongs to the setlist', async () => {
    const pins = await freshPins()
    const { isSongCached } = await import('@/composables/useOfflinePins')
    await pins.pin('set-1', [song('a'), song('b')])

    await pins.pin('set-1', [song('a')])

    expect(await isSongCached(song('a'))).toBe(true)
    expect(await isSongCached(song('b'))).toBe(false)
  })
})

describe('unpinning', () => {
  it('keeps a song that another pinned setlist still needs', async () => {
    const pins = await freshPins()
    const { isSongCached } = await import('@/composables/useOfflinePins')
    const shared = song('shared')

    await pins.pin('set-1', [shared, song('only-1')])
    await pins.pin('set-2', [shared, song('only-2')])
    // stored once, not twice: the second pin found the shared content already there
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3)

    await pins.unpin('set-1')

    expect(pins.isPinned('set-1')).toBe(false)
    expect(await isSongCached(shared)).toBe(true)
    expect(await isSongCached(song('only-2'))).toBe(true)
    expect(await isSongCached(song('only-1'))).toBe(false)
  })

  it('drops the shared song once the last setlist holding it is gone', async () => {
    const pins = await freshPins()
    const { isSongCached } = await import('@/composables/useOfflinePins')
    const shared = song('shared')

    await pins.pin('set-1', [shared])
    await pins.pin('set-2', [shared])
    await pins.unpin('set-1')
    await pins.unpin('set-2')

    expect(await isSongCached(shared)).toBe(false)
  })
})
