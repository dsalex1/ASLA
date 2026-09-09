<script setup lang="ts">
import JogStrip from '@/components/JogStrip.vue'
import StemMixer from '@/components/StemMixer.vue'
import WaveformCanvas from '@/components/WaveformCanvas.vue'
import { useAccess } from '@/composables/useAccess'
import { useAudioEngine } from '@/composables/useAudioEngine'
import { autoNumbers } from '@/helpers/autoNumber'
import { PEAKS_PER_SECOND } from '@/helpers/audioPeaks'
import { audioBytes, loadPeaks } from '@/helpers/audioTracks'
import { estimateLag, Reading } from '@/helpers/levelAlign'
import { PANE_VIEW_ICONS, PANE_VIEWS } from '@/helpers/paneViews'
import { stemSources } from '@/helpers/stems'
import { songCollection } from '@/plugins/firebase'
import { AudioTrack, CountIn, Loop, Marker, PaneView, Song } from '@/types'
import { onClickOutside, useDebounceFn, useElementSize, useLocalStorage } from '@vueuse/core'
import { doc, updateDoc } from 'firebase/firestore'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  song: Song
  hasPrev: boolean
  hasNext: boolean
  /** the view on screen: the waveform, or whatever the caller puts in the slot */
  shown: PaneView
  /** which views this song has anything for, so the rest can be greyed out */
  available: Record<PaneView, boolean>
}>()

const emit = defineEmits<{
  (e: 'prevSong'): void
  (e: 'nextSong'): void
  /** no audio yet: send the user to the import in the song's settings */
  (e: 'addAudio'): void
}>()

const view = defineModel<PaneView>('view', { required: true })

const SKIP = 10 // seconds for the two skip buttons
const MARKER_HIT = 0.3 // pressing the marker button this close to one removes it instead
const DEFAULT_SPAN = 30 // seconds visible in the zoomed view
const RESTART_WINDOW = 3 // pressing |<< after this many seconds restarts instead of going back a song

const { canWrite } = useAccess()
const engine = useAudioEngine()
const { currentTime, duration, playing, loading, error, tempo, pitch, gainDb, loopA, loopB, limiterCeilingDb, countingIn } = engine
const { stemNames, stemVolume, stemPeaks } = engine

const tracks = computed(() => props.song.audioTracks ?? [])
const startingTrack = () => Math.min(props.song.selectedAudioTrack ?? 0, Math.max(tracks.value.length - 1, 0))
const trackIndex = ref(startingTrack())
const track = computed((): AudioTrack | undefined => tracks.value[trackIndex.value])
const peaks = ref(new Uint8Array())
// once the stems are in, the waveform is their blend, so it follows the faders
const shownPeaks = computed(() => (stemPeaks.value.length ? stemPeaks.value : peaks.value))
const mixerOpen = ref(false)
const mixerAnchor = ref<HTMLElement | null>(null)
onClickOutside(mixerAnchor, () => (mixerOpen.value = false))
const job = computed(() => track.value?.stemJob)
// The markers on the track, held as objects while they are being worked on: each carries
// its name and whether it is a skip, so both travel with it when it is moved.
const markers = ref<Marker[]>([])
// The saved selections on this track, read straight off the song: saving one on a phone
// puts it on every other device. The live A-B is the engine's and is not one of them, so
// dragging A about does not rewrite what was saved.
const loops = computed((): Loop[] => {
  const current = track.value
  if (current?.loops?.length) return current.loops
  // a track saved before there were several loops carries the one A-B it had
  if (current?.loopA != null && current.loopB != null) return [{ a: current.loopA, b: current.loopB }]
  return []
})
// a saved loop is "selected" while the A-B stands on it, which is what the name field and
// the delete button act on; nudging either bound simply steps off it
const selectedLoop = computed(() => loops.value.findIndex((l) => l.a === loopA.value && l.b === loopB.value))
const currentLoop = computed((): Loop | undefined => loops.value[selectedLoop.value])
const hasAudio = computed(() => !!track.value)
// the stored duration stands in until the file has decoded, so the whole track can be
// zoomed to and scrubbed straight away
const trackDuration = computed(() => duration.value || track.value?.duration || 0)

// the playhead sits in the middle of the zoomed view, so the window follows from the
// position and only its width is state; it may run past either end of the track
const span = ref(DEFAULT_SPAN)
const windowStart = computed(() => currentTime.value - span.value / 2)
const windowEnd = computed(() => currentTime.value + span.value / 2)

watch(
  () => props.song.id,
  () => (trackIndex.value = startingTrack())
)

// Every write re-creates the track object, so the load is keyed on which file it is:
// moving a marker or nudging the tempo must not re-fetch and re-decode the audio.
const trackKey = computed(() => (track.value ? `${props.song.id}/${track.value.storageRef}` : ''))

// load the selected track: peaks first so the waveform is there before the audio is
watch(
  trackKey,
  async () => {
    const current = track.value
    if (!current) return
    // a track saved before markers were named carries bare positions
    markers.value = current.markers.map((m) => (typeof m === 'number' ? { at: m } : { ...m }))
    loopA.value = loopB.value = null
    tempo.value = current.tempo ?? 1
    pitch.value = current.pitch ?? 0
    gainDb.value = current.gainDb ?? 0
    span.value = Math.min(DEFAULT_SPAN, current.duration)
    peaks.value = new Uint8Array()
    peaks.value = await loadPeaks(current, props.song.hashes)
    await engine.load(() => audioBytes(current, props.song.hashes), current.duration, stemSources(current, props.song.hashes))
  },
  { immediate: true }
)

// --- persistence: markers, loops, tempo and pitch belong to the track ---
/** write these fields of the selected track back to the song */
function saveTrack(patch: Partial<AudioTrack>) {
  if (!props.song.id || !track.value || !canWrite.value) return
  const updated = tracks.value.map((t, i) => {
    if (i !== trackIndex.value) return t
    const next: AudioTrack = { ...t, ...patch }
    // Firestore rejects undefined, and what these held has been migrated into `loops`
    delete next.loopA
    delete next.loopB
    delete next.selectedLoop
    return next
  })
  updateDoc(doc(songCollection, props.song.id), { audioTracks: updated, selectedAudioTrack: trackIndex.value })
}

// the knobs are turned continuously, so they are written once the hand comes off them
const persist = useDebounceFn(() => {
  const current = track.value
  if (!current) return
  saveTrack({
    markers: markers.value,
    tempo: tempo.value,
    pitch: pitch.value,
    gainDb: gainDb.value,
    // the mix belongs to the song, like the tempo: the band hears what was set up
    ...(current.stems?.length
      ? { stems: current.stems.map((s) => ({ ...s, volume: stemVolume.value[s.name] ?? s.volume })) }
      : {}),
  })
}, 500)

watch([markers, tempo, pitch, gainDb, trackIndex, stemVolume], persist, { deep: true })

// a split that finished elsewhere, or one this device just ran: pick the stems up
watch(
  () => track.value?.stems?.map((s) => s.storageRef).join(),
  (next, previous) => {
    const current = track.value
    if (!current || next === previous) return
    engine.load(() => audioBytes(current, props.song.hashes), current.duration, stemSources(current, props.song.hashes))
  }
)

// --- markers ---
const markerAtPlayhead = computed(() => markers.value.some((m) => Math.abs(m.at - currentTime.value) <= MARKER_HIT))

const sorted = (list: Marker[]) => [...list].sort((a, b) => a.at - b.at)

function toggleMarker() {
  if (!canWrite.value || !Number.isFinite(currentTime.value)) return
  const existing = markers.value.findIndex((m) => Math.abs(m.at - currentTime.value) <= MARKER_HIT)
  markers.value =
    existing >= 0
      ? markers.value.filter((_, i) => i !== existing)
      : sorted([...markers.value, { at: currentTime.value }])
}

/** the name and the kind belong to the marker, so they travel with it */
function moveMarker(index: number, seconds: number) {
  if (!canWrite.value || !Number.isFinite(seconds)) return
  markers.value = sorted(markers.value.map((m, i) => (i === index ? { ...m, at: seconds } : m)))
}

// --- naming a marker, and what kind it is ---
// Holding a flag and letting go without dragging it opens this over the flag; the hold
// still picks the marker up as soon as it is actually moved.
const markerMenu = ref<{ index: number; x: number } | null>(null)
const markerMenuAnchor = ref<HTMLElement | null>(null)
onClickOutside(markerMenuAnchor, () => (markerMenu.value = null))
watch(trackKey, () => (markerMenu.value = null)) // it belongs to a flag on the track that left

const heldMarker = computed((): Marker | undefined => (markerMenu.value ? markers.value[markerMenu.value.index] : undefined))

/** what the flags show while a marker or a loop has no name of its own */
const markerNumbers = computed(() => autoNumbers(markers.value))
const loopNumbers = computed(() => autoNumbers(loops.value.map((l) => ({ at: l.a, name: l.name }))))

/** what is left of a marker once its empty fields are dropped: Firestore rejects undefined */
const tidy = (m: Marker): Marker => ({ at: m.at, ...(m.name ? { name: m.name } : {}), ...(m.skip ? { skip: true } : {}) })

function patchMarker(index: number, patch: Partial<Marker>) {
  if (!canWrite.value) return
  markers.value = markers.value.map((m, i) => (i === index ? tidy({ ...m, ...patch }) : m))
}

function setMarkerKind(index: number, skip: boolean) {
  patchMarker(index, { skip })
  markerMenu.value = null
}

/** typed into the menu; an empty name puts the marker back to being shown by number */
const markerName = computed({
  get: () => heldMarker.value?.name ?? '',
  set: (value: string) => markerMenu.value && patchMarker(markerMenu.value.index, { name: value.trim() }),
})

/** where a skip lands: the next marker, or the one after that when it is a skip as well */
function afterSkip(from: number): number {
  const next = markers.value.find((m) => m.at > from)
  if (!next) return trackDuration.value
  return next.skip ? afterSkip(next.at) : next.at
}

/**
 * Pressing play on a skip marker starts where it skips to, rather than starting on the
 * marker and jumping a frame later: the count-in has to lead into the music it counts in,
 * and a jump after the downbeat is a jump behind the beat.
 */
function togglePlay() {
  if (!playing.value && !countingIn.value) {
    const here = markers.value.find((m) => m.skip && m.at >= currentTime.value && m.at <= currentTime.value + MARKER_HIT)
    if (here) engine.seek(afterSkip(here.at))
  }
  engine.toggle()
}

watch(currentTime, (now, before) => {
  if (!playing.value || now <= before) return // a wrap or a seek is not playing into one
  const crossed = markers.value.find((m) => m.skip && m.at >= before && m.at <= now)
  if (crossed) engine.seek(afterSkip(crossed.at))
})

// --- count-in ---
// The settings sit on the song, like the markers do: whoever counts the band in, everyone
// gets the same four beats.
// A read-only account cannot change the band's count-in, but counting yourself in is
// exactly what practising wants, so theirs is this device's own and is not written.
const localCountIn = ref<CountIn | null>(null)
watch(() => props.song.id, () => (localCountIn.value = null))
const countIn = computed((): CountIn => localCountIn.value ?? props.song.countIn ?? {})
const countInOn = computed(() => !!countIn.value.enabled)
const countInBpm = computed(() => countIn.value.bpm ?? props.song.bpm ?? 120)
const countInBeats = computed(() => countIn.value.beats ?? 4)
const countInOpen = ref(false)
const countInAnchor = ref<HTMLElement | null>(null)
onClickOutside(countInAnchor, () => (countInOpen.value = false))

function saveCountIn(patch: CountIn) {
  const next = { enabled: countInOn.value, bpm: countInBpm.value, beats: countInBeats.value, ...patch }
  if (!canWrite.value) return void (localCountIn.value = next)
  if (!props.song.id) return
  updateDoc(doc(songCollection, props.song.id), { countIn: next })
}

const fieldValue = (e: Event) => Number((e.target as HTMLInputElement).value)

watch(
  [countInOn, countInBeats, countInBpm],
  () => {
    engine.countInBeats.value = countInOn.value ? countInBeats.value : 0
    engine.countInBpm.value = countInBpm.value
  },
  { immediate: true }
)

/** Every loop bound is a place you want to get back to as much as any marker, so the
 *  step buttons walk them alongside the flags. */
const jumpTargets = computed(() =>
  [...markers.value.map((m) => m.at), ...loops.value.flatMap((l) => [l.a, l.b])].sort((a, b) => a - b)
)

const jumpMarker = (direction: -1 | 1) => {
  const candidates = jumpTargets.value.filter((m) => (direction < 0 ? m < currentTime.value - 0.3 : m > currentTime.value))
  const target = direction < 0 ? candidates[candidates.length - 1] : candidates[0]
  engine.seek(target ?? (direction < 0 ? 0 : duration.value))
}

// --- A-B repeat ---
// A and B are the engine's own and live only on this device: they are where you are
// working right now. Pressing + is what turns one into a loop the whole band gets.

function setLoop(which: 'a' | 'b', seconds = currentTime.value) {
  if (!Number.isFinite(seconds)) return
  if (which === 'a') {
    loopA.value = seconds
    if (loopB.value != null && loopB.value <= seconds) loopB.value = null
  } else {
    loopB.value = seconds
    if (loopA.value != null && loopA.value >= seconds) loopA.value = null
  }
}

/** the +: keep the A-B on screen as a loop. It comes back selected, being the one the A-B stands on. */
function saveLoop() {
  if (loopA.value == null || loopB.value == null) return
  saveTrack({ loops: [...loops.value, { a: loopA.value, b: loopB.value }] })
}

/** picked off the waveform: the A-B jumps to the saved loop, and nothing is written */
function selectLoop(index: number) {
  const loop = loops.value[index]
  if (!loop) return
  loopA.value = loop.a
  loopB.value = loop.b
}

/** Dragging a saved loop flag edits that loop; a selected A-B follows the edit. */
function moveSavedLoop(index: number, which: 'a' | 'b', seconds: number) {
  const loop = loops.value[index]
  if (!loop || !Number.isFinite(seconds)) return
  if ((which === 'a' && seconds >= loop.b) || (which === 'b' && seconds <= loop.a)) return
  const selected = selectedLoop.value === index
  saveTrack({ loops: loops.value.map((saved, i) => (i === index ? { ...saved, [which]: seconds } : saved)) })
  if (selected) (which === 'a' ? loopA : loopB).value = seconds
}

/** drop the saved loop the A-B stands on; the A-B itself stays where it is */
function deleteLoop() {
  if (selectedLoop.value < 0) return
  saveTrack({ loops: loops.value.filter((_, i) => i !== selectedLoop.value) })
}

/** typed into the loop row; an empty name puts the loop back to being shown by number */
const loopName = computed({
  get: () => currentLoop.value?.name ?? '',
  set: (value: string) => {
    if (selectedLoop.value < 0) return
    const name = value.trim()
    saveTrack({
      loops: loops.value.map((l, i) => (i === selectedLoop.value ? { a: l.a, b: l.b, ...(name ? { name } : {}) } : l)),
    })
  },
})

// hiding the loop controls also stops the loop: the region stays, greyed out, but the
// track plays straight through it
const loopBarOpen = useLocalStorage('audio.loopBar', false)
watch(loopBarOpen, (open) => (engine.loopEnabled.value = open), { immediate: true })

const hasLoop = computed(() => loopA.value != null && loopB.value != null)

/** step the whole selection one selection-length forward or back, so you can walk the track */
function stepLoop(direction: -1 | 1) {
  if (loopA.value == null || loopB.value == null) return
  const length = loopB.value - loopA.value
  const start = Math.max(0, Math.min(loopA.value + direction * length, trackDuration.value - length))
  loopA.value = start
  loopB.value = start + length
}

/** halve or double the selection, keeping A where it is */
function scaleLoop(factor: number) {
  if (loopA.value == null || loopB.value == null) return
  loopB.value = Math.min(trackDuration.value, loopA.value + (loopB.value - loopA.value) * factor)
}

/** the x: take the A-B off screen, leaving whatever was saved alone */
function clearLoop() {
  loopA.value = loopB.value = null
}

// --- transport ---
function toStart() {
  if (currentTime.value <= RESTART_WINDOW && props.hasPrev) emit('prevSong')
  else engine.seek(0)
}

const zoom = (seconds: number) => (span.value = Math.max(2, Math.min(seconds, trackDuration.value || span.value)))

const stamp = (seconds: number) => {
  const safe = Math.max(0, seconds)
  const mins = Math.floor(safe / 60)
  const secs = Math.floor(safe % 60)
  return `${mins}:${String(secs).padStart(2, '0')}.${String(Math.floor((safe % 1) * 1000)).padStart(3, '0')}`
}

const MIN_TEMPO = 0.25
const MAX_TEMPO = 4
const MAX_PITCH = 24

const effectiveBpm = computed(() => (props.song.bpm ? Math.round(props.song.bpm * tempo.value) : null))
const clampTempo = (v: number) => Math.round(Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, v)) * 10000) / 10000
const adjustTempo = (delta: number) => (tempo.value = clampTempo(tempo.value + delta))
const adjustPitch = (delta: number) => (pitch.value = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, Math.round(pitch.value) + delta)))

// with a known bpm the jog works in whole bpm, which is what you actually want to dial in
const tempoJog = computed({
  get: () => effectiveBpm.value ?? tempo.value,
  set: (v) => (tempo.value = clampTempo(props.song.bpm ? v / props.song.bpm : v)),
})
const tempoJogRange = computed(() =>
  props.song.bpm
    ? { step: 1, min: Math.ceil(props.song.bpm * MIN_TEMPO), max: Math.floor(props.song.bpm * MAX_TEMPO) }
    : { step: 0.01, min: MIN_TEMPO, max: MAX_TEMPO }
)
const signed = (n: number) => (n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2))

// --- level trim: no web API reaches the system volume, so this is the app's own gain
// stage. It belongs to the track, which is the point: it evens out backing tracks that
// were mastered at different levels. ---
const GAIN_LIMIT = 20 // dB either way


const GAIN_STEP = 0.4 // dB per press of the volume buttons

const adjustGain = (delta: number) =>
  (gainDb.value = Math.round(Math.max(-GAIN_LIMIT, Math.min(GAIN_LIMIT, gainDb.value + delta)) * 100) / 100)

const gainLabel = computed(() => `${gainDb.value > 0 ? '+' : ''}${gainDb.value.toFixed(2)} dB`)
const gainPercent = computed(() => `${Math.round(10 ** (gainDb.value / 20) * 100)}%`)


// --- level monitoring: what the gain and the limiter are actually doing, measured off
// the live signal and painted onto the waveform as the track plays ---
const monitor = useLocalStorage('audio.monitor', false)
const outTrail = ref<Float32Array | null>(null)
const reductionTrail = ref<Float32Array | null>(null)
const reduction = ref(0)

// the wave after the gain is a plain vertical stretch of the source, so it is drawn
// straight from the peaks; only what the limiter does has to be measured
const MONITOR_HEADROOM = 6 // dB kept above 0 dBFS while monitoring
const IDLE_HEADROOM = 2 // and a little either way the rest of the time

// the measurement runs behind the playhead by an amount only the device knows, so it is
// found by matching what arrives against the peaks it should look like
const ALIGN_HISTORY = 3 // seconds of readings to match over
const ALIGN_EVERY = 0.5 // seconds between re-matches
const ALIGN_TRUST = 0.6 // correlation below this is not a match worth moving to
const lag = ref(0)
let readings: Reading[] = []
let lastAligned = -Infinity

function realign(at: number) {
  const best = estimateLag(readings, peaks.value)
  // ease towards it, so one poor stretch of audio cannot yank the whole overlay
  if (best.score >= ALIGN_TRUST) lag.value = lag.value * 0.6 + best.lag * 0.4
  lastAligned = at
}

function resetTrails() {
  readings = []
  const buckets = Math.ceil(trackDuration.value * PEAKS_PER_SECOND) + 1
  outTrail.value = new Float32Array(buckets)
  reductionTrail.value = new Float32Array(buckets)
  reduction.value = 0
}

// what the limiter did at one gain says nothing about another, so changing it starts over
watch([monitor, trackKey, gainDb], () => monitor.value && resetTrails(), { immediate: true })

/**
 * Each sample in the window is placed at the position it was actually played at, so the
 * trail lands on the same time axis as the waveform underneath it and carries the
 * waveform's own resolution rather than one reading per animation frame.
 *
 * A frame covers ~17 ms of wall clock and the window holds ~43 ms, so every bucket is
 * measured even at high tempo, where each real second covers several track seconds.
 */
function record(trail: Float32Array, samples: Float32Array, endsAt: number, trackSecondsPerSample: number) {
  for (let i = samples.length - 1; i >= 0; i--) {
    const bucket = Math.round((endsAt - (samples.length - 1 - i) * trackSecondsPerSample) * PEAKS_PER_SECOND)
    if (bucket < 0) break // wound back past the start of the track
    if (bucket >= trail.length) continue
    const level = Math.abs(samples[i])
    if (level > trail[bucket]) trail[bucket] = level
  }
}

// currentTime advances once per animation frame while playing, which is exactly when
// there is a fresh window of samples to measure
watch(currentTime, (at) => {
  if (!monitor.value || !playing.value || !outTrail.value || !reductionTrail.value) return
  const { pre, post, sampleRate, latency, reduction: gr } = engine.levels()
  reduction.value = gr
  if (!lag.value) lag.value = latency * tempo.value // a starting point until the first match

  // the signal ahead of the limiter is the source scaled, so it is what the offset is
  // measured against; it is never drawn, since the gain is drawn from the peaks instead
  let loudest = 0
  for (let i = 0; i < pre.length; i++) if (Math.abs(pre[i]) > loudest) loudest = Math.abs(pre[i])
  readings.push({ at, level: loudest })
  while (readings.length && readings[0].at < at - ALIGN_HISTORY) readings.shift()
  if (at - lastAligned >= ALIGN_EVERY) realign(at)

  const endsAt = at - lag.value
  const trackSecondsPerSample = tempo.value / sampleRate
  record(outTrail.value, post, endsAt, trackSecondsPerSample)

  // one reduction figure covers the whole window, so it is written across every bucket
  // the window spans rather than pinned to its end
  const first = Math.max(0, Math.round((endsAt - post.length * trackSecondsPerSample) * PEAKS_PER_SECOND))
  const last = Math.min(Math.round(endsAt * PEAKS_PER_SECOND), reductionTrail.value.length - 1)
  for (let i = first; i <= last; i++) reductionTrail.value[i] = Math.max(reductionTrail.value[i], -gr)
})

// what fills the pane is the caller's decision: it knows which views the song can
// actually serve, and hands the fallback in through the slot
const showsSlot = computed(() => props.shown != 'waveform')

// the sheet has to be sized to the space left over above the controls, which is a good
// deal less than the window
const viewPane = ref<HTMLElement | null>(null)
const { height: viewHeight } = useElementSize(viewPane)

defineExpose({ position: currentTime })
</script>

<template>
  <div class="d-flex flex-column h-100 audio-pane">
    <div class="flex-1-1-0" style="min-height: 0; position: relative">
      <WaveformCanvas
        v-if="hasAudio"
        v-show="!showsSlot"
        draggable
        :peaks="shownPeaks"
        :duration="trackDuration"
        :start="windowStart"
        :end="windowEnd"
        :markers="markers"
        :loops="loops"
        :loopA="loopA"
        :loopB="loopB"
        :loopActive="loopBarOpen"
        :position="currentTime"
        :monitor="monitor"
        :gainDb="gainDb"
        :outTrail="outTrail"
        :reductionTrail="reductionTrail"
        :reduction="reduction"
        :ceilingDb="limiterCeilingDb"
        :headroomDb="monitor ? MONITOR_HEADROOM : IDLE_HEADROOM"
        :editable="canWrite"
        @seek="engine.seek"
        @moveMarker="moveMarker"
        @moveLoop="setLoop"
        @moveSavedLoop="moveSavedLoop"
        @selectLoop="selectLoop"
        @markerMenu="(index, x) => canWrite && (markerMenu = { index, x })"
        @zoom="zoom"
      />

      <!-- what the held flag should be: somewhere to come back to, or somewhere to jump from -->
      <div v-if="markerMenu" ref="markerMenuAnchor" class="marker-menu" :style="{ left: `${markerMenu.x}px` }">
        <input
          v-model.lazy="markerName"
          class="loop-name"
          :placeholder="`Marker ${markerNumbers[markerMenu.index] ?? ''}`"
          aria-label="Name this marker"
        />
        <button
          class="tbtn"
          :class="{ 'tbtn--on': !heldMarker?.skip }"
          aria-label="Normal marker"
          @click="setMarkerKind(markerMenu.index, false)"
        >
          <i class="fas fa-flag" /> Marker
        </button>
        <button
          class="tbtn"
          :class="{ 'tbtn--on': heldMarker?.skip }"
          aria-label="Skip marker"
          @click="setMarkerKind(markerMenu.index, true)"
        >
          <i class="fas fa-forward-step" /> Skip
        </button>
      </div>
      <div v-if="showsSlot" ref="viewPane" class="h-100 w-100 d-flex justify-center view-pane">
        <slot name="view" :position="currentTime" :playing="playing" :height="viewHeight" />
      </div>
      <button
        v-if="hasAudio && !showsSlot"
        class="monitor-toggle"
        :class="{ 'monitor-toggle--on': monitor }"
        aria-label="Monitor levels"
        title="Show measured levels on the waveform"
        @click="monitor = !monitor"
      >
        <i class="fas fa-chart-simple" />
      </button>

      <div v-if="loading || error" class="loading-badge">{{ error || 'Loading audio…' }}</div>
    </div>

    <!-- tempo, markers and pitch, flanked by elapsed / remaining -->
    <div v-if="hasAudio" class="controls">
      <span class="stamp">{{ stamp(currentTime) }}</span>

      <div class="group">
        <button class="tbtn" aria-label="Slower" @click="adjustTempo(-0.05)"><i class="fas fa-minus" /></button>
        <JogStrip
          v-model="tempoJog"
          v-bind="tempoJogRange"
          :resetTo="song.bpm ?? 1"
          :label="`${tempo.toFixed(2)}x`"
          :sub="effectiveBpm ? `${effectiveBpm} bpm` : undefined"
        />
        <button class="tbtn" aria-label="Faster" @click="adjustTempo(0.05)"><i class="fas fa-plus" /></button>
      </div>

      <div class="group">
        <button class="tbtn" aria-label="Previous marker" @click="jumpMarker(-1)"><i class="fas fa-backward-step" /></button>
        <button
          v-if="canWrite"
          class="tbtn"
          :class="{ 'tbtn--on': markerAtPlayhead }"
          :aria-label="markerAtPlayhead ? 'Remove marker' : 'Add marker'"
          @click="toggleMarker"
        >
          <i :class="markerAtPlayhead ? 'fas fa-flag-checkered' : 'fas fa-flag'" />
        </button>
        <button class="tbtn" aria-label="Next marker" @click="jumpMarker(1)"><i class="fas fa-forward-step" /></button>
      </div>

      <div class="group">
        <button class="tbtn tbtn--glyph" aria-label="Pitch down" @click="adjustPitch(-1)">♭</button>
        <JogStrip v-model="pitch" :step="0.01" :min="-MAX_PITCH" :max="MAX_PITCH" :resetTo="0" :label="signed(pitch)" sub="semi" />
        <button class="tbtn tbtn--glyph" aria-label="Pitch up" @click="adjustPitch(1)">♯</button>
      </div>

      <div class="group">
        <button class="tbtn" aria-label="Quieter" @click="adjustGain(-GAIN_STEP)"><i class="fas fa-volume-low" /></button>
        <JogStrip
          v-model="gainDb"
          :step="0.02"
          :min="-GAIN_LIMIT"
          :max="GAIN_LIMIT"
          :resetTo="0"
          :label="gainLabel"
          :sub="gainPercent"
        />
        <button class="tbtn" aria-label="Louder" @click="adjustGain(GAIN_STEP)"><i class="fas fa-volume-high" /></button>
      </div>

      <span class="stamp">-{{ stamp(trackDuration - currentTime) }}</span>
    </div>

    <div style="height: 60px; flex: none">
      <WaveformCanvas
        v-if="hasAudio"
        overview
        :peaks="peaks"
        :duration="trackDuration"
        :start="0"
        :end="trackDuration"
        :markers="markers"
        :loops="loops"
        :loopA="loopA"
        :loopB="loopB"
        :loopActive="loopBarOpen"
        :position="currentTime"
        :editable="canWrite"
        @seek="engine.seek"
        @moveSavedLoop="moveSavedLoop"
        @selectLoop="selectLoop"
      />
      <div v-else class="h-100 d-flex align-center justify-center text-grey no-audio">
        <button v-if="canWrite" class="add-audio" @click="emit('addAudio')">
          No audio -
          <i class="fab fa-youtube" />
          add a track from YouTube
        </button>
        <span v-else>No audio</span>
      </div>
    </div>

    <!-- everything to do with the A-B loop, kept out of the way until asked for -->
    <div v-if="hasAudio && loopBarOpen" class="controls loop-row">
      <div class="group">
        <button class="tbtn" :class="{ 'tbtn--on': loopA != null }" @click="setLoop('a')">A</button>
        <button class="tbtn" aria-label="Clear A-B" :disabled="loopA == null && loopB == null" @click="clearLoop">
          <i class="fas fa-times" />
        </button>
        <button class="tbtn" :class="{ 'tbtn--on': loopB != null }" @click="setLoop('b')">B</button>
      </div>

      <!-- the list itself is the flags on the strips above, which are what select them;
           this saves the A-B as another one, and names or drops the one it stands on -->
      <div class="group">
        <input
          v-model.lazy="loopName"
          class="loop-name"
          :disabled="!currentLoop || !canWrite"
          :placeholder="currentLoop ? `Loop ${loopNumbers[selectedLoop] ?? ''}` : 'No loop'"
          aria-label="Name this loop"
        />
        <button
          class="tbtn"
          aria-label="Save loop"
          title="Save the A-B as a loop"
          :disabled="!hasLoop || selectedLoop >= 0 || !canWrite"
          @click="saveLoop"
        >
          <i class="fas fa-plus" />
        </button>
        <button class="tbtn" aria-label="Delete this loop" :disabled="!currentLoop || !canWrite" @click="deleteLoop">
          <i class="fas fa-trash" />
        </button>
      </div>

      <div class="group">
          <button class="tbtn" aria-label="Step back one selection" :disabled="!hasLoop" @click="stepLoop(-1)"><i class="fas fa-arrow-left" /></button>
          <button class="tbtn" aria-label="Step forward one selection" :disabled="!hasLoop" @click="stepLoop(1)"><i class="fas fa-arrow-right" /></button>
          <button class="tbtn" aria-label="Halve selection" :disabled="!hasLoop" @click="scaleLoop(0.5)">½</button>
          <button class="tbtn" aria-label="Double selection" :disabled="!hasLoop" @click="scaleLoop(2)">x2</button>
      </div>
    </div>

    <!-- transport and the view switch -->
    <div class="controls">
      <div class="group group--side">
        <select v-if="tracks.length > 1" v-model="trackIndex" class="track-picker" aria-label="Audio track">
          <option v-for="(t, i) in tracks" :key="t.storageRef" :value="i">{{ t.name }}</option>
        </select>
        <span v-else-if="track" class="track-name">{{ track.name }}</span>
        <div v-if="stemNames.length" ref="mixerAnchor" class="mixer-anchor">
          <button
            class="tbtn"
            :class="{ 'tbtn--on': mixerOpen }"
            :aria-label="mixerOpen ? 'Hide the stem mixer' : 'Show the stem mixer'"
            @click="mixerOpen = !mixerOpen"
          >
            <i class="fas fa-sliders" />
          </button>
          <div v-if="mixerOpen" class="mixer-popover">
            <StemMixer
              :names="stemNames"
              :volume="stemVolume"
              @setVolume="engine.setStemVolume"
              @mute="engine.toggleStemMute"
            />
          </div>
        </div>
        <span v-else-if="job" class="job" :title="`${job.by} started this ${job.requested.join(', ')} split`">
          <i class="fas fa-circle-notch fa-spin" />
          {{ job.phase === 'storing' ? 'Storing stems' : 'Separating' }}...
        </span>
        <div v-if="hasAudio" ref="countInAnchor" class="mixer-anchor">
          <button
            class="tbtn"
            :class="{ 'tbtn--on': countInOn }"
            aria-label="Count-in"
            :title="countInOn ? `${countInBeats} beats at ${countInBpm} bpm` : 'No count-in'"
            @click="countInOpen = !countInOpen"
          >
            <i class="fas fa-stopwatch" />
          </button>
          <div v-if="countInOpen" class="count-in-popover">
            <div class="count-in-row">
              <span>Count in</span>
              <button
                class="tbtn"
                :class="{ 'tbtn--on': countInOn }"
                aria-label="Count-in on"
                @click="saveCountIn({ enabled: !countInOn })"
              >
                {{ countInOn ? 'On' : 'Off' }}
              </button>
            </div>
            <label class="count-in-row">
              <span>Tempo</span>
              <input
                type="number"
                class="count-in-field"
                :value="countInBpm"
                min="20"
                max="300"
                aria-label="Count-in tempo"
                @change="saveCountIn({ bpm: fieldValue($event) })"
              />
            </label>
            <label class="count-in-row">
              <span>Beats</span>
              <input
                type="number"
                class="count-in-field"
                :value="countInBeats"
                min="1"
                max="16"
                aria-label="Count-in beats"
                @change="saveCountIn({ beats: fieldValue($event) })"
              />
            </label>
          </div>
        </div>
        <button
          v-if="hasAudio"
          class="tbtn"
          :class="{ 'tbtn--on': loopBarOpen }"
          :aria-label="loopBarOpen ? 'Hide loop controls' : 'Show loop controls'"
          @click="loopBarOpen = !loopBarOpen"
        >
          <i class="fas fa-repeat" />
        </button>
      </div>

      <!-- stepping between songs has to work on a song without a track too -->
      <div class="group group--centre">
        <button class="tbtn" aria-label="Restart or previous song" @click="toStart"><i class="fas fa-backward-fast" /></button>
        <button class="tbtn" aria-label="Back 10 seconds" :disabled="!hasAudio" @click="engine.skip(-SKIP)"><i class="fas fa-backward" /></button>
        <button
          class="tbtn tbtn--play"
          :aria-label="playing || countingIn ? 'Pause' : 'Play'"
          :disabled="!hasAudio || !!error || loading"
          @click="togglePlay"
        >
          <i :class="playing || countingIn ? 'fas fa-pause' : 'fas fa-play'" />
        </button>
        <button class="tbtn" aria-label="Forward 10 seconds" :disabled="!hasAudio" @click="engine.skip(SKIP)"><i class="fas fa-forward" /></button>
        <button class="tbtn" aria-label="Next song" :disabled="!hasNext" @click="emit('nextSong')"><i class="fas fa-forward-fast" /></button>
      </div>


      <div class="group group--side segmented">
        <button
          v-for="v in PANE_VIEWS"
          :key="v"
          class="tbtn"
          :class="{ 'tbtn--on': view == v }"
          :disabled="!available[v]"
          :aria-label="v"
          @click="view = v"
        >
          <i :class="PANE_VIEW_ICONS[v]" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audio-pane {
  background: #050505;
  color: #eee;
}

.add-audio {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border: 1px solid #2c2c2c;
  border-radius: 8px;
  background: #141414;
  color: #ddd;
  cursor: pointer;
}
.add-audio i {
  color: #ff0033;
}

.mixer-anchor {
  position: relative;
  display: inline-flex;
}

/* over the button it belongs to, and no wider than the faders need */
.mixer-popover,
.count-in-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 20;
  width: 240px;
  padding: 10px 12px;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  background: #141414;
  box-shadow: 0 8px 24px rgb(0 0 0 / 60%);
}

.job {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #9a9a9a;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 12px;
  background: #101010;
  flex-wrap: wrap;
}

.group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}
/* Equal weight either side keeps the middle group centred. No min-width override, so the
   groups refuse to shrink under their contents and the row wraps like the one above the
   waveform instead of squashing the transport. */
.group--side {
  flex: 1 1 0;
}
.group--side:last-child {
  justify-content: flex-end;
}
.group--centre {
  flex: 0 0 auto;
}

/* elapsed hard left, remaining hard right */
.stamp {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #cfcfcf;
  flex: 0 0 auto;
  min-width: 8ch;
}
.stamp:last-child {
  text-align: right;
}

.tbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  height: 34px;
  padding-inline: 10px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #1d1d1d;
  color: #e8e8e8;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.tbtn:hover:not(:disabled) {
  background: #2a2a2a;
}
.tbtn:disabled {
  opacity: 0.35;
  cursor: default;
}
.tbtn--on {
  background: #f59e0b;
  border-color: #f59e0b;
  color: #111;
}
.tbtn--glyph {
  font-size: 20px;
  line-height: 1;
}
.tbtn--play {
  min-width: 62px;
  height: 42px;
  margin-inline: 4px;
  background: #f59e0b;
  border-color: #f59e0b;
  color: #111;
  font-size: 17px;
}
.tbtn--play:hover:not(:disabled) {
  background: #ffad20;
}

/* the mode switch reads as one control rather than three loose buttons */
.segmented {
  gap: 0;
}
.segmented .tbtn {
  border-radius: 0;
  border-inline-width: 0 1px;
  min-width: 38px;
  padding-inline: 6px;
}
.segmented .tbtn:first-child {
  border-left-width: 1px;
  border-start-start-radius: 6px;
  border-end-start-radius: 6px;
}
.segmented .tbtn:last-child {
  border-start-end-radius: 6px;
  border-end-end-radius: 6px;
}

.count-in-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 0;
  font-size: 13px;
}
.count-in-field {
  width: 64px;
  padding: 2px 6px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #0d0d0d;
  color: #eee;
  text-align: right;
}
/* the icons in it label their words, so they need the room a gap gives them */
.marker-menu .tbtn {
  gap: 6px;
}

/* over the flag it was opened on, just under the row of flags */
.marker-menu {
  position: absolute;
  top: 34px;
  z-index: 20;
  display: flex;
  gap: 4px;
  padding: 4px;
  transform: translateX(-4px);
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  background: #141414;
  box-shadow: 0 8px 24px rgb(0 0 0 / 60%);
  white-space: nowrap;
}

.loop-row {
  justify-content: center;
  gap: 24px;
  border-top: 1px solid #1e1e1e;
}

.loop-name {
  width: 130px;
  height: 34px;
  padding-inline: 10px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #1d1d1d;
  color: #e8e8e8;
  font-size: 13px;
}
.loop-name:disabled {
  opacity: 0.35;
}

.track-picker {
  height: 34px;
  max-width: 150px;
  margin-right: 8px;
  padding-inline: 8px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #1d1d1d;
  color: #e8e8e8;
}

.track-name {
  max-width: 150px;
  margin-right: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #cfcfcf;
}

/* the caller lays its page-turn halves over this, so it has to be the containing block */
.view-pane {
  position: relative;
  overflow: hidden;
  background: #fff;
}

.no-audio {
  font-size: 13px;
}

.monitor-toggle {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.07);
  color: #888;
  font-size: 11px;
  cursor: pointer;
}
.monitor-toggle:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #ddd;
}
.monitor-toggle--on {
  background: rgba(61, 220, 132, 0.18);
  color: #3ddc84;
}

.loading-badge {
  position: absolute;
  inset: auto 0 8px 0;
  text-align: center;
  color: #f59e0b;
  pointer-events: none;
}
</style>
