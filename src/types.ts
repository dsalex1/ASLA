/*export type User = {
  id: string
  name: string
  email: string
}*/

export type Setlist = {
  id?: string
  name?: string
  songs: (NonNullable<Song['id']> | CustomSetlistEntry)[]
  updatedAt?: string
}

export type CustomSetlistEntry = {
  title: string
  description: string
}

export type ViewMode = 'lyrics' | 'chords' | 'drums' | 'audio'

/** what the big pane is showing; the ViewMode above only picks which one it opens on */
export type PaneView = 'waveform' | 'sheet' | 'drums' | 'lyrics' | 'chords'

export type Folder = {
  id?: string
  name: string
}

/** One separated part of a track. Its peaks are computed on decode, so only audio is stored. */
export type Stem = {
  name: string
  storageRef: string
  /** 0..1, shared like tempo and markers: the band hears the same mix */
  volume: number
}

/** A separation in flight, kept on the track so every device shows the same state. */
export type StemJob = {
  taskId: string
  requested: string[]
  startedAt: string
  by: string
  phase: 'separating' | 'storing'
  error?: string
}

/** What the separation service detected about the recording itself, as it reported it. */
export type TrackAnalysis = {
  bpm?: number
  key?: string
  tuning?: number
}

/** One saved A-B selection. Both bounds are set: it is made from an A-B that had both. */
export type Loop = {
  a: number
  b: number
  /** what it was called; an unnamed loop is shown by its position in the list */
  name?: string
}

export type AudioTrack = {
  name: string
  storageRef: string
  peaksRef: string
  duration: number
  /** the markers on the track, kept sorted; a bare number is the shape before they were named */
  markers: (number | Marker)[]
  /** the saved A-B selections on this track; the live A-B is not stored */
  loops?: Loop[]
  /** @deprecated fields an older shape wrote; read once, then dropped on the next write */
  selectedLoop?: number
  loopA?: number
  loopB?: number
  tempo?: number // playback rate, 1 = original
  pitch?: number // semitones, -12..12
  gainDb?: number // level trim in dB, 0 = untouched
  stems?: Stem[]
  stemJob?: StemJob
  analysis?: TrackAnalysis
  /** where the file came from, when it was not a local upload */
  source?: { kind: 'youtube'; videoId: string; title: string }
}

/**
 * A place on the track, named or shown by its number. A skip marker is not somewhere to
 * come back to: playing into one carries on from the next marker.
 */
export type Marker = { at: number; name?: string; skip?: boolean }

/** the clicks counted off before the track comes in */
export type CountIn = {
  enabled?: boolean
  /** the beat they are counted at; the song's own bpm until it is set */
  bpm?: number
  beats?: number
}

export type Song = {
  id?: string
  filename: string
  pdfStorageSHA?: string
  pdfStorageRef?: string
  pdfImageStorageRefs?: string[]
  drumsPdfStorageRef?: string
  drumsPdfImageStorageRefs?: string[]
  name?: string
  ibi_instrument?: 'Bass' | 'A.Git' | 'E.Git'
  nadine_moderation?: string
  key_signature?: `${'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'}${'#' | 'b' | ''}${'m' | ''}`
  bpm?: number
  duration?: number
  lyrics?: string
  transpose?: number // semitones (-11..11) applied to chords in the lyrics chord view
  folderId?: string | null // null/absent = no folder
  /** sha-256 (16 hex chars) of the bytes at each storage ref, keyed by ref path; the offline cache key */
  hashes?: Record<string, string>
  countIn?: CountIn
  audioTracks?: AudioTrack[]
  selectedAudioTrack?: number // index into audioTracks, remembered between visits
}
