import { allSongRefs, offlineSongRefs, pruneHashes } from '@/helpers/songRefs'
import { Song } from '@/types'
import { describe, expect, it } from 'vitest'

const song = (extra: Partial<Song> = {}): Song => ({ filename: 'a.pdf', ...extra })

describe('offlineSongRefs', () => {
  it('takes the page images and leaves the pdf, which only annotating reads', () => {
    const refs = offlineSongRefs(
      song({ pdfStorageRef: 'a.pdf', pdfImageStorageRefs: ['sheet_images/a_1.webp', 'sheet_images/a_2.webp'] })
    )
    expect(refs).toEqual(['sheet_images/a_1.webp', 'sheet_images/a_2.webp'])
  })

  it('falls back to the pdf for a song that was never rendered to images', () => {
    expect(offlineSongRefs(song({ pdfStorageRef: 'a.pdf' }))).toEqual(['a.pdf'])
  })

  it('covers both sheets and every audio track with its peaks', () => {
    const refs = offlineSongRefs(
      song({
        pdfImageStorageRefs: ['sheet_images/a.webp'],
        drumsPdfImageStorageRefs: ['drums_images/a.webp'],
        audioTracks: [
          { name: 't', storageRef: 'audio/t.mp3', peaksRef: 'audio/t.peaks', duration: 1, markers: [] },
        ],
      })
    )
    expect(refs).toEqual(['sheet_images/a.webp', 'drums_images/a.webp', 'audio/t.mp3', 'audio/t.peaks'])
  })

  it('is empty for a song with nothing stored', () => {
    expect(offlineSongRefs(song())).toEqual([])
  })
})

describe('allSongRefs', () => {
  it('keeps the pdf as well, since it is still a file the song owns', () => {
    const s = song({ pdfStorageRef: 'a.pdf', pdfImageStorageRefs: ['sheet_images/a.webp'] })
    expect(allSongRefs(s)).toEqual(['a.pdf', 'sheet_images/a.webp'])
  })
})

describe('pruneHashes', () => {
  it('drops hashes of pages a shorter pdf no longer has', () => {
    const s = song({
      pdfImageStorageRefs: ['sheet_images/a_1.webp'],
      hashes: { 'sheet_images/a_1.webp': 'one', 'sheet_images/a_2.webp': 'two' },
    })
    pruneHashes(s)
    expect(s.hashes).toEqual({ 'sheet_images/a_1.webp': 'one' })
  })

  it('leaves a song without hashes alone', () => {
    const s = song()
    pruneHashes(s)
    expect(s.hashes).toBeUndefined()
  })
})
