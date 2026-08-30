import { computePeaks, decodeAudio } from '@/helpers/audioPeaks'
import { uploadHashed } from '@/helpers/contentHash'
import { resolveBytes } from '@/helpers/offlineCache'
import { auth, songCollection } from '@/plugins/firebase'
import { AudioTrack, Song, Stem, StemJob } from '@/types'
import { doc, updateDoc } from 'firebase/firestore'
import { deleteObject, ref as firebaseRef, getDownloadURL, getStorage } from 'firebase/storage'

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

/** The stem files a track no longer refers to, dropped best-effort. */
async function deleteStemFiles(stems: Stem[]) {
  const storage = getStorage()
  await Promise.all(
    stems.map((stem) =>
      deleteObject(firebaseRef(storage, stem.storageRef)).catch((e) => console.warn('Failed to delete a stem: ', e))
    )
  )
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
async function storeStem(song: Song, name: string, url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`downloading the ${name} stem failed (${response.status})`)
  const blob = await response.blob()
  const ref = firebaseRef(getStorage(), `audio/${song.id}_${Date.now()}_${name}.m4a`)
  const hash = await uploadHashed(ref, blob, { contentType: 'audio/mp4' })
  // the click is an addition to the recording rather than a part of it, so it starts off
  return { stem: { name, storageRef: ref.fullPath, volume: name === METRONOME ? 0 : 1 } as Stem, hash }
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

  // a retry drops whatever the last attempt failed with; Firestore rejects an undefined
  const retried = job?.taskId ? { ...job, phase: 'separating' as const } : undefined
  if (retried) delete retried.error
  let current: StemJob
  if (retried) current = retried
  else {
    const url = await getDownloadURL(firebaseRef(getStorage(), track.storageRef))
    const started = await call('/split', { method: 'POST', body: JSON.stringify({ url, stems, name: track.name }) })
    current = {
      taskId: started.taskId as string,
      requested,
      startedAt: new Date().toISOString(),
      by: auth.currentUser?.email ?? 'someone',
      phase: 'separating',
    }
  }
  await patchTrack(song, index, { stemJob: current })

  let result: SplitResult = { status: 'PENDING' }
  const until = Date.now() + 20 * 60_000
  for (;;) {
    result = (await call(`/split?taskId=${encodeURIComponent(current.taskId)}`)) as SplitResult
    if (result.status === 'COMPLETED') break
    if (result.status === 'FAILED' || result.status === 'ERROR') throw new Error(result.error ?? 'separation failed')
    if (Date.now() > until) throw new Error('separation timed out')
    await sleep(4000)
  }

  const urls: Record<string, string> = { ...(result.stems ?? {}) }
  if (!wantsMetronome) delete urls[METRONOME]
  else if (result.metronome) urls[METRONOME] = result.metronome

  await patchTrack(song, index, { stemJob: { ...current, phase: 'storing' } })

  const stored = await Promise.all(
    Object.entries(urls)
      .sort(([a], [b]) => stemOrder(a, b))
      .map(([name, url]) => storeStem(song, name, url))
  )

  // a split replaces whatever was there: stems are separated as a set, and a leftover
  // from an earlier pass would be a part of a mix that no longer includes it
  // only what came back: Firestore rejects an undefined however deeply it is nested
  const analysis = Object.fromEntries(
    Object.entries({ bpm: result.bpm, key: result.key, tuning: result.tuning }).filter(([, v]) => v != null)
  )
  await patchTrack(
    song,
    index,
    {
      stems: stored.map((s) => s.stem).sort((a, b) => stemOrder(a.name, b.name)),
      analysis: Object.keys(analysis).length ? analysis : undefined,
      // section boundaries are markers, but only for a track that has none of its own
      ...(result.segments?.length && !track.markers.length
        ? { markers: [...new Set(result.segments.map((s) => Math.round(s.start * 10) / 10))].sort((a, b) => a - b) }
        : {}),
      stemJob: undefined,
    },
    Object.fromEntries(stored.map((s) => [s.stem.storageRef, s.hash]))
  )

  await deleteStemFiles(track.stems ?? [])

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

/** Removes a track's stems, files and all. The track itself is untouched. */
export async function removeStems(song: Song, index: number) {
  const stems = song.audioTracks?.[index]?.stems ?? []
  await patchTrack(song, index, { stems: undefined })
  await deleteStemFiles(stems)
}

/** The stems of a track, ready for the engine: bytes from the offline copy when there is one. */
export const stemSources = (track: AudioTrack, hashes?: Song['hashes']) =>
  (track.stems ?? []).map((stem) => ({
    name: stem.name,
    volume: stem.volume ?? 1,
    read: () => resolveBytes(stem.storageRef, hashes?.[stem.storageRef]),
  }))

/** Peaks for a freshly uploaded track, used by the YouTube import. */
export const peaksOf = async (bytes: ArrayBuffer) => computePeaks(await decodeAudio(bytes.slice(0)))
