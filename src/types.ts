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

export type Folder = {
  id?: string
  name: string
}

export type AudioTrack = {
  name: string
  storageRef: string
  peaksRef: string
  duration: number
  /** marker positions in seconds, kept sorted; displayed numbered 1..n */
  markers: number[]
  loopA?: number
  loopB?: number
  tempo?: number // playback rate, 1 = original
  pitch?: number // semitones, -12..12
  gainDb?: number // level trim in dB, 0 = untouched
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
  audioTracks?: AudioTrack[]
  selectedAudioTrack?: number // index into audioTracks, remembered between visits
}
