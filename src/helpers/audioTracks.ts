import { computePeaks, decodeAudio } from '@/helpers/audioPeaks'
import { AudioTrack, Song } from '@/types'
import { deleteObject, ref as firebaseRef, getDownloadURL, getStorage, uploadBytes } from 'firebase/storage'

/** compressed formats browsers can actually decode — no wav/aiff, they are far too big to stream */
export const AUDIO_ACCEPT = '.mp3,.m4a,.aac,.ogg,.oga,.opus,.webm,.flac'

const ACCEPTED_TYPES = /^audio\/(mpeg|mp3|mp4|aac|aacp|x-m4a|ogg|opus|webm|flac|x-flac)$/

export function isPlayableAudio(file: File) {
  if (ACCEPTED_TYPES.test(file.type)) return true
  // some browsers report an empty or vendor type; fall back to what the audio element claims
  return !!file.type && document.createElement('audio').canPlayType(file.type) !== ''
}

export async function uploadAudioTrack(song: Song, file: File): Promise<AudioTrack> {
  const decoded = await decodeAudio(await file.arrayBuffer())
  const peaks = computePeaks(decoded)

  const storage = getStorage()
  const base = `audio/${song.id}_${Date.now()}`
  const audioRef = firebaseRef(storage, `${base}_${file.name}`)
  const peaksRef = firebaseRef(storage, `${base}.peaks`)

  await uploadBytes(audioRef, file, { contentType: file.type, customMetadata: { originalFileName: file.name } })
  await uploadBytes(peaksRef, peaks, { contentType: 'application/octet-stream' })

  return {
    name: file.name.replace(/\.[^.]+$/, ''),
    storageRef: audioRef.fullPath,
    peaksRef: peaksRef.fullPath,
    duration: decoded.duration,
    markers: [],
  }
}

export const audioTrackRefs = (song: Song) => (song.audioTracks ?? []).flatMap((t) => [t.storageRef, t.peaksRef])

export async function deleteAudioTrack(track: AudioTrack) {
  const storage = getStorage()
  await Promise.all(
    [track.storageRef, track.peaksRef].map((path) =>
      deleteObject(firebaseRef(storage, path)).catch((e) => console.warn('Failed to delete audio file: ', e))
    )
  )
}

const download = (path: string) => getDownloadURL(firebaseRef(getStorage(), path))

export const audioUrl = (track: AudioTrack) => download(track.storageRef)

export async function loadPeaks(track: AudioTrack) {
  const response = await fetch(await download(track.peaksRef))
  return new Uint8Array(await response.arrayBuffer())
}
