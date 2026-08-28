import { Song } from '@/types'

export const audioTrackRefs = (song: Song) => (song.audioTracks ?? []).flatMap((t) => [t.storageRef, t.peaksRef])

/** Every storage path the song mentions. */
export const allSongRefs = (song: Song) =>
  [
    song.pdfStorageRef,
    ...(song.pdfImageStorageRefs ?? []),
    song.drumsPdfStorageRef,
    ...(song.drumsPdfImageStorageRefs ?? []),
    ...audioTrackRefs(song),
  ].filter((ref): ref is string => !!ref)

/**
 * What an offline copy needs to render: page images when there are any, else the pdf —
 * the same preference `useFileContents` resolves with. The pdf is skipped once images
 * exist because only annotating reads it, and annotating is disabled offline.
 */
export const offlineSongRefs = (song: Song) => [
  ...(song.pdfImageStorageRefs?.length ? song.pdfImageStorageRefs : song.pdfStorageRef ? [song.pdfStorageRef] : []),
  ...(song.drumsPdfImageStorageRefs?.length
    ? song.drumsPdfImageStorageRefs
    : song.drumsPdfStorageRef
      ? [song.drumsPdfStorageRef]
      : []),
  ...audioTrackRefs(song),
]

/** Drops hash entries for refs the song no longer has, so the map cannot grow forever. */
export function pruneHashes(song: Song) {
  if (!song.hashes) return
  const kept = new Set(allSongRefs(song))
  song.hashes = Object.fromEntries(Object.entries(song.hashes).filter(([ref]) => kept.has(ref)))
}
