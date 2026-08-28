import { computePeaks, decodeAudio } from '@/helpers/audioPeaks'
import { uploadHashed } from '@/helpers/contentHash'
import { resolveBytes } from '@/helpers/offlineCache'
import { AudioTrack, Song } from '@/types'
import { deleteObject, ref as firebaseRef, getStorage } from 'firebase/storage'

/** compressed formats browsers can actually decode — no wav/aiff, they are far too big to stream */
export const AUDIO_ACCEPT = '.mp3,.m4a,.aac,.ogg,.oga,.opus,.webm,.flac'

const ACCEPTED_TYPES = /^audio\/(mpeg|mp3|mp4|aac|aacp|x-m4a|ogg|opus|webm|flac|x-flac)$/

export function isPlayableAudio(file: File) {
  if (ACCEPTED_TYPES.test(file.type)) return true
  // some browsers report an empty or vendor type; fall back to what the audio element claims
  return !!file.type && document.createElement('audio').canPlayType(file.type) !== ''
}

/** Returns the track plus the content hashes of both uploads, for the song's `hashes` map. */
export async function uploadAudioTrack(song: Song, file: File) {
  const decoded = await decodeAudio(await file.arrayBuffer())
  const peaks = computePeaks(decoded)

  const storage = getStorage()
  const base = `audio/${song.id}_${Date.now()}`
  const audioRef = firebaseRef(storage, `${base}_${file.name}`)
  const peaksRef = firebaseRef(storage, `${base}.peaks`)

  const [audioHash, peaksHash] = await Promise.all([
    uploadHashed(audioRef, file, { contentType: file.type, customMetadata: { originalFileName: file.name } }),
    uploadHashed(peaksRef, peaks, { contentType: 'application/octet-stream' }),
  ])

  const track: AudioTrack = {
    name: file.name.replace(/\.[^.]+$/, ''),
    storageRef: audioRef.fullPath,
    peaksRef: peaksRef.fullPath,
    duration: decoded.duration,
    markers: [],
  }
  return { track, hashes: { [audioRef.fullPath]: audioHash, [peaksRef.fullPath]: peaksHash } }
}

export async function deleteAudioTrack(track: AudioTrack) {
  const storage = getStorage()
  await Promise.all(
    [track.storageRef, track.peaksRef].map((path) =>
      deleteObject(firebaseRef(storage, path)).catch((e) => console.warn('Failed to delete audio file: ', e))
    )
  )
}

/** The encoded track, straight to decodeAudioData — never an object URL, these are the big ones. */
export const audioBytes = (track: AudioTrack, hashes?: Song['hashes']) =>
  resolveBytes(track.storageRef, hashes?.[track.storageRef])

export const loadPeaks = async (track: AudioTrack, hashes?: Song['hashes']) =>
  new Uint8Array(await resolveBytes(track.peaksRef, hashes?.[track.peaksRef]))
