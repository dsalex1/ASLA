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

export type Song = {
  id?: string
  filename: string
  pdfStorageSHA?: string
  pdfStorageRef?: string
  drumsPdfStorageRef?: string
  name?: string
  ibi_instrument?: 'Bass' | 'A.Git' | 'E.Git'
  nadine_moderation?: string
  key_signature?: `${'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'}${'#' | 'b' | ''}${'m' | ''}`
  bpm?: number
  duration?: number
  lyrics?: string
}
