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

export type Folder = {
  id?: string
  name: string
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
}
