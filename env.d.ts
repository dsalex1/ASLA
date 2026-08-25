/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_MEASUREMENT_ID: string

  readonly VITE_FIREBASE_APP_NAME: string
  readonly VITE_APP_SHORT_NAME: string
  readonly VITE_APP_DESCRIPTION: string
  readonly VITE_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 

declare module 'soundtouchjs' {
  /** Time-stretch / pitch-shift source node wrapping a decoded AudioBuffer. */
  export class PitchShifter {
    constructor(context: BaseAudioContext, buffer: AudioBuffer, bufferSize: number, onEnd?: () => void)
    readonly duration: number
    readonly timePlayed: number
    percentagePlayed: number
    tempo: number
    rate: number
    pitch: number
    pitchSemitones: number
    connect(node: AudioNode): void
    disconnect(): void
    on(event: 'play', cb: (detail: { timePlayed: number; percentagePlayed: number }) => void): void
    off(event?: string): void
  }
}
