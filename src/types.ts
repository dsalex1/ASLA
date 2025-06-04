/*export type User = {
  id: string
  name: string
  email: string
}*/

export type Setlist = {
  id?: string
  name?: string
  songs: Song['filename'][]
}

export type Song = {
  id?: string
  filename: string
  pdfStorageSHA?: string
  pdfStorageRef?: string
  name?: string
  key_signature?: `${'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'}${'#' | 'b' | ''}${'m' | ''}`
  bpm?: number
  duration?: number
  lyrics?: string
}
