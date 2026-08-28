import {
  cacheKey,
  cacheRef,
  cacheSizes,
  collectGarbage,
  isCached,
  recache,
  resolveBytes,
  resolveRef,
} from '@/helpers/offlineCache'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const bytesOf = (text: string) => new TextEncoder().encode(text)

beforeEach(async () => {
  await caches.delete('offline-v1')
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => Promise.resolve(new Response(bytesOf(`body of ${url}`))))
  )
  URL.createObjectURL = vi.fn(() => 'blob:cached')
})

describe('cacheKey', () => {
  it('keys by content, so the same bytes under two refs are stored once', () => {
    expect(cacheKey('sheet_images/a.webp', 'abc123')).toBe(cacheKey('drums_images/b.webp', 'abc123'))
  })

  it('falls back to the ref for content uploaded before hashes existed', () => {
    expect(cacheKey('a/b c.pdf')).toBe('/offline/ref:a%2Fb%20c.pdf')
    expect(cacheKey('a/b c.pdf')).not.toBe(cacheKey('a/other.pdf'))
  })
})

describe('resolving', () => {
  it('goes to the download url when nothing is cached', async () => {
    expect(await resolveRef('sheet_images/a.webp', 'abc')).toBe('https://files.test/sheet_images/a.webp')
  })

  it('serves an object url from the cache once the content is held', async () => {
    await cacheRef('sheet_images/a.webp', 'abc')
    expect(await resolveRef('sheet_images/a.webp', 'abc')).toBe('blob:cached')
  })

  it('misses when the hash changed, so edited content is never served stale', async () => {
    await cacheRef('sheet_images/a.webp', 'abc')
    expect(await isCached('sheet_images/a.webp', 'abc')).toBe(true)
    expect(await isCached('sheet_images/a.webp', 'def')).toBe(false)
  })

  it('reads bytes from the cache without a fetch', async () => {
    await cacheRef('audio/track.mp3', 'abc')
    vi.mocked(fetch).mockClear()
    const bytes = await resolveBytes('audio/track.mp3', 'abc')
    expect(new TextDecoder().decode(bytes)).toContain('audio/track.mp3')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('cacheRef', () => {
  it('does not download content it is already holding', async () => {
    await cacheRef('sheet_images/a.webp', 'abc')
    vi.mocked(fetch).mockClear()
    await cacheRef('sheet_images/a.webp', 'abc')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports a failed download rather than caching the error page', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('nope', { status: 404 }))
    await expect(cacheRef('sheet_images/gone.webp', 'abc')).rejects.toThrow('404')
    expect(await isCached('sheet_images/gone.webp', 'abc')).toBe(false)
  })
})

describe('recache', () => {
  it('replaces a held copy with the annotated bytes, under the new hash', async () => {
    await cacheRef('sheet_images/a.webp', 'old')
    await recache('sheet_images/a.webp', 'old', 'new', new Blob(['annotated']))

    expect(await isCached('sheet_images/a.webp', 'old')).toBe(false)
    expect(new TextDecoder().decode(await resolveBytes('sheet_images/a.webp', 'new'))).toBe('annotated')
  })

  it('leaves content nobody is holding offline alone', async () => {
    await recache('sheet_images/a.webp', 'old', 'new', new Blob(['annotated']))
    expect(await isCached('sheet_images/a.webp', 'new')).toBe(false)
  })
})

describe('cacheSizes', () => {
  it('reports the bytes held under each key', async () => {
    await cacheRef('a.webp', 'one')
    await cacheRef('b.webp', 'two')

    const sizes = await cacheSizes()

    expect([...sizes.keys()].sort()).toEqual([cacheKey('a.webp', 'one'), cacheKey('b.webp', 'two')].sort())
    // the stub serves `body of <url>`, so the sizes are the real byte lengths
    expect(sizes.get(cacheKey('a.webp', 'one'))).toBeGreaterThan(0)
  })

  it('is empty when nothing is held', async () => {
    expect((await cacheSizes()).size).toBe(0)
  })
})

describe('collectGarbage', () => {
  it('keeps what is still referenced and drops the rest', async () => {
    await cacheRef('a.webp', 'keep')
    await cacheRef('b.webp', 'drop')

    await collectGarbage(new Set([cacheKey('a.webp', 'keep')]))

    expect(await isCached('a.webp', 'keep')).toBe(true)
    expect(await isCached('b.webp', 'drop')).toBe(false)
  })
})
