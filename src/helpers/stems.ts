import { computePeaks, decodeAudio } from '@/helpers/audioPeaks'
import { uploadHashed } from '@/helpers/contentHash'
import { resolveBytes } from '@/helpers/offlineCache'
import { auth, songCollection } from '@/plugins/firebase'
import { AudioTrack, Song, Stem, StemJob } from '@/types'
import { doc, updateDoc } from 'firebase/firestore'
import { ref as firebaseRef, getDownloadURL, getStorage } from 'firebase/storage'

/**
 * Stem separation, driven through a worker that holds the Moises credential. The worker
 * only ever sees the track's download URL — Moises pulls the audio itself — and hands
 * back public, immutable stem URLs. Those are copied into Storage here, so a split
 * happens once for the whole band, survives Moises expiring anything, and is pinned
 * offline like every other file the song owns.
 */
const WORKER = 'https://asla-stems.dsalex.workers.dev'

/** What Moises can isolate on this plan. `other` is the residual and is always added. */
export const SPLITTABLE = ['vocals', 'guitars', 'bass', 'drums', 'piano', 'keys', 'wind', 'strings'] as const
/** The click Moises renders from the beat grid; not a separation, so it is free of the cap. */
export const METRONOME = 'metronome'
export const MAX_STEMS = 5 // OPERATION_NOT_ALLOWED_MORE_THAN_5_STEMS
export const MAX_TRACK_SECONDS = 1200 // the plan's maxDuration

/** Display order, so the mixer reads the same everywhere. */
const ORDER = ['vocals', 'guitars', 'bass', 'drums', 'piano', 'keys', 'wind', 'strings', 'other', METRONOME]
export const stemOrder = (a: string, b: string) => ORDER.indexOf(a) - ORDER.indexOf(b)

const LABELS: Record<string, string> = {
  vocals: 'Vocals',
  guitars: 'Guitar',
  bass: 'Bass',
  drums: 'Drums',
  piano: 'Piano',
  keys: 'Keys',
  wind: 'Wind',
  strings: 'Strings',
  other: 'Other',
  [METRONOME]: 'Metronome',
}
const ICONS: Record<string, string> = {
  vocals: 'fas fa-microphone',
  guitars: 'fas fa-guitar',
  bass: 'fas fa-guitar',
  drums: 'fas fa-drum',
  piano: 'fas fa-music',
  keys: 'fas fa-music',
  wind: 'fas fa-music',
  strings: 'fas fa-music',
  other: 'fas fa-wave-square',
  [METRONOME]: 'fas fa-stopwatch',
}
export const stemLabel = (name: string) => LABELS[name] ?? name
export const stemIcon = (name: string) => ICONS[name] ?? 'fas fa-wave-square'

/**
 * Moises reports a key as "A minor". asla stores "Am", and only accepts the shapes its
 * own picker offers — anything else is kept on the track as text and left out of the song.
 */
export function keySignatureOf(key?: string): Song['key_signature'] | undefined {
  const match = /^([A-G][#b]?)\s*(minor|major|min|maj|m)?$/i.exec(key?.trim() ?? '')
  if (!match) return undefined
  const minor = /^m/i.test(match[2] ?? '')
  return `${match[1]}${minor ? 'm' : ''}` as Song['key_signature']
}

/** A job nobody is driving any more, so another device may take it over. */
export const isStale = (job: StemJob) => Date.now() - Date.parse(job.startedAt) > 10 * 60_000

type SplitResult = {
  status: string
  stems?: Record<string, string>
  metronome?: string
  bpm?: number
  key?: string
  tuning?: number
  segments?: { start: number; end: number; label: string }[]
  error?: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function call(path: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('You have to be signed in to split a track')
  const response = await fetch(`${WORKER}${path}`, {
    ...init,
    headers: { ...init?.headers, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? `stem service failed (${response.status})`)
  return body
}

/** Writes one track back, leaving the song's other tracks alone. */
async function patchTrack(song: Song, index: number, patch: Partial<AudioTrack>, hashes?: Record<string, string>) {
  if (!song.id) return
  const tracks = (song.audioTracks ?? []).map((t, i) => (i === index ? { ...t, ...patch } : t))
  // Firestore rejects undefined, so a cleared job has to be dropped from the object
  const next = tracks[index] as Record<string, unknown>
  for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key]
  await updateDoc(doc(songCollection, song.id), {
    audioTracks: tracks,
    ...(hashes ? { hashes: { ...song.hashes, ...hashes } } : {}),
  })
}

/** Downloads one finished stem and stores it beside the track it came from. */
async function storeStem(song: Song, track: AudioTrack, name: string, url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`downloading the ${name} stem failed (${response.status})`)
  const blob = await response.blob()
  const ref = firebaseRef(getStorage(), `audio/${song.id}_${Date.now()}_${name}.m4a`)
  const hash = await uploadHashed(ref, blob, { contentType: 'audio/mp4' })
  return { stem: { name, storageRef: ref.fullPath, volume: 1 } as Stem, hash }
}

/**
 * Starts a separation and follows it to the end: the job is written to the track first,
 * so every other device shows the same state, and cleared once the stems are stored.
 * Safe to call again on a job somebody else abandoned — the task id is what is resumed.
 */
export async function splitTrack(song: Song, index: number, requested: string[], job?: StemJob) {
  const track = song.audioTracks?.[index]
  if (!track) return
  const wantsMetronome = requested.includes(METRONOME)
  const stems = requested.filter((name) => name !== METRONOME)

  let taskId = job?.taskId
  if (!taskId) {
    const url = await getDownloadURL(firebaseRef(getStorage(), track.storageRef))
    const started = await call('/split', { method: 'POST', body: JSON.stringify({ url, stems, name: track.name }) })
    taskId = started.taskId as string
    await patchTrack(song, index, {
      stemJob: {
        taskId,
        requested,
        startedAt: new Date().toISOString(),
        by: auth.currentUser?.email ?? 'someone',
        phase: 'separating',
      },
    })
  }

  let result: SplitResult = { status: 'PENDING' }
  const until = Date.now() + 20 * 60_000
  for (;;) {
    result = (await call(`/split?taskId=${encodeURIComponent(taskId!)}`)) as SplitResult
    if (result.status === 'COMPLETED') break
    if (result.status === 'FAILED' || result.status === 'ERROR') throw new Error(result.error ?? 'separation failed')
    if (Date.now() > until) throw new Error('separation timed out')
    await sleep(4000)
  }

  const urls: Record<string, string> = { ...(result.stems ?? {}) }
  if (!wantsMetronome) delete urls[METRONOME]
  else if (result.metronome) urls[METRONOME] = result.metronome

  const current = { ...track, stemJob: { ...(job ?? {}), taskId, phase: 'storing' } as StemJob }
  await patchTrack(song, index, { stemJob: current.stemJob })

  const stored = await Promise.all(
    Object.entries(urls)
      .sort(([a], [b]) => stemOrder(a, b))
      .map(([name, url]) => storeStem(song, track, name, url))
  )

  // an earlier split's stems are replaced by name, so "add piano" keeps what is there
  const kept = (track.stems ?? []).filter((s) => !stored.some((n) => n.stem.name === s.name))
  const analysis = { bpm: result.bpm, key: result.key, tuning: result.tuning }
  await patchTrack(
    song,
    index,
    {
      stems: [...kept, ...stored.map((s) => s.stem)].sort((a, b) => stemOrder(a.name, b.name)),
      analysis: Object.values(analysis).some((v) => v != null) ? analysis : undefined,
      // section boundaries are markers, but only for a track that has none of its own
      ...(result.segments?.length && !track.markers.length
        ? { markers: [...new Set(result.segments.map((s) => Math.round(s.start * 10) / 10))].sort((a, b) => a - b) }
        : {}),
      stemJob: undefined,
    },
    Object.fromEntries(stored.map((s) => [s.stem.storageRef, s.hash]))
  )

  // the analysis fills in what the song is missing, and never overwrites a typed-in value
  const songPatch: Partial<Song> = {}
  if (result.bpm && !song.bpm) songPatch.bpm = Math.round(result.bpm)
  const signature = keySignatureOf(result.key)
  if (signature && !song.key_signature) songPatch.key_signature = signature
  if (Object.keys(songPatch).length && song.id) await updateDoc(doc(songCollection, song.id), songPatch)
}

/** Clears a job that failed, so the track can be tried again. */
export const failJob = (song: Song, index: number, error: string) => {
  const job = song.audioTracks?.[index]?.stemJob
  return patchTrack(song, index, { stemJob: job ? { ...job, error } : undefined })
}

export const clearJob = (song: Song, index: number) => patchTrack(song, index, { stemJob: undefined })

/** Removes a track's stems and forgets them; the audio itself is left for the GC. */
export const removeStems = (song: Song, index: number) => patchTrack(song, index, { stems: undefined })

/** The stems of a track, ready for the engine: bytes from the offline copy when there is one. */
export const stemSources = (track: AudioTrack, hashes?: Song['hashes']) =>
  (track.stems ?? []).map((stem) => ({
    name: stem.name,
    volume: stem.volume ?? 1,
    read: () => resolveBytes(stem.storageRef, hashes?.[stem.storageRef]),
  }))

/** Peaks for a freshly uploaded track, used by the YouTube import. */
export const peaksOf = async (bytes: ArrayBuffer) => computePeaks(await decodeAudio(bytes.slice(0)))
