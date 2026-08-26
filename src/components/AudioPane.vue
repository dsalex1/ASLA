<script setup lang="ts">
import JogStrip from '@/components/JogStrip.vue'
import WaveformCanvas from '@/components/WaveformCanvas.vue'
import { useAudioEngine } from '@/composables/useAudioEngine'
import { PEAKS_PER_SECOND } from '@/helpers/audioPeaks'
import { audioUrl, loadPeaks } from '@/helpers/audioTracks'
import { songCollection } from '@/plugins/firebase'
import { AudioTrack, Song } from '@/types'
import { useDebounceFn, useLocalStorage } from '@vueuse/core'
import { doc, updateDoc } from 'firebase/firestore'
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  song: Song
  hasPrev: boolean
  hasNext: boolean
}>()

const emit = defineEmits<{
  (e: 'prevSong'): void
  (e: 'nextSong'): void
}>()

const view = defineModel<'waveform' | 'lyrics' | 'chords'>('view', { required: true })

const SKIP = 10 // seconds for the two skip buttons
const SNAP = 1 // A/B snap to a marker this close
const MARKER_HIT = 0.3 // pressing the marker button this close to one removes it instead
const DEFAULT_SPAN = 30 // seconds visible in the zoomed view
const RESTART_WINDOW = 3 // pressing |<< after this many seconds restarts instead of going back a song

const engine = useAudioEngine()
const { currentTime, duration, playing, loading, error, tempo, pitch, gainDb, outputDevice, loopA, loopB } = engine

const tracks = computed(() => props.song.audioTracks ?? [])
const startingTrack = () => Math.min(props.song.selectedAudioTrack ?? 0, Math.max(tracks.value.length - 1, 0))
const trackIndex = ref(startingTrack())
const track = computed((): AudioTrack | undefined => tracks.value[trackIndex.value])
const peaks = ref(new Uint8Array())
const markers = ref<number[]>([])

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
    markers.value = [...current.markers]
    loopA.value = current.loopA ?? null
    loopB.value = current.loopB ?? null
    tempo.value = current.tempo ?? 1
    pitch.value = current.pitch ?? 0
    gainDb.value = current.gainDb ?? 0
    span.value = Math.min(DEFAULT_SPAN, current.duration)
    peaks.value = new Uint8Array()
    peaks.value = await loadPeaks(current)
    await engine.load(await audioUrl(current), current.duration)
  },
  { immediate: true }
)

// --- persistence: markers, loop, tempo and pitch belong to the track ---
const persist = useDebounceFn(() => {
  if (!props.song.id || !track.value) return
  const updated = tracks.value.map((t, i) => {
    if (i !== trackIndex.value) return t
    // Firestore rejects undefined, so a cleared A-B has to be left out entirely
    const next: AudioTrack = { ...t, markers: markers.value, tempo: tempo.value, pitch: pitch.value, gainDb: gainDb.value }
    delete next.loopA
    delete next.loopB
    if (loopA.value != null) next.loopA = loopA.value
    if (loopB.value != null) next.loopB = loopB.value
    return next
  })
  updateDoc(doc(songCollection, props.song.id), { audioTracks: updated, selectedAudioTrack: trackIndex.value })
}, 500)

watch([markers, loopA, loopB, tempo, pitch, gainDb, trackIndex], persist, { deep: true })

// --- markers ---
const nearestMarker = (seconds: number) =>
  markers.value.reduce<number | null>((best, m) => (best == null || Math.abs(m - seconds) < Math.abs(best - seconds) ? m : best), null)

function snap(seconds: number) {
  const nearest = nearestMarker(seconds)
  return nearest != null && Math.abs(nearest - seconds) <= SNAP ? nearest : seconds
}

const markerAtPlayhead = computed(() =>
  markers.value.some((m) => Math.abs(m - currentTime.value) <= MARKER_HIT)
)

function toggleMarker() {
  if (!Number.isFinite(currentTime.value)) return
  const existing = markers.value.findIndex((m) => Math.abs(m - currentTime.value) <= MARKER_HIT)
  if (existing >= 0) markers.value = markers.value.filter((_, i) => i !== existing)
  else markers.value = [...markers.value, currentTime.value].sort((a, b) => a - b)
}

function moveMarker(index: number, seconds: number) {
  if (!Number.isFinite(seconds)) return
  const moved = markers.value.map((m, i) => (i === index ? seconds : m))
  markers.value = moved.sort((a, b) => a - b)
}

const jumpMarker = (direction: -1 | 1) => {
  const candidates = markers.value.filter((m) => (direction < 0 ? m < currentTime.value - 0.3 : m > currentTime.value))
  const target = direction < 0 ? candidates[candidates.length - 1] : candidates[0]
  engine.seek(target ?? (direction < 0 ? 0 : duration.value))
}

// --- A-B repeat ---
function setLoop(which: 'a' | 'b', seconds = currentTime.value) {
  if (!Number.isFinite(seconds)) return
  const at = snap(seconds)
  if (which === 'a') {
    loopA.value = at
    if (loopB.value != null && loopB.value <= at) loopB.value = null
  } else {
    loopB.value = at
    if (loopA.value != null && loopA.value >= at) loopA.value = null
  }
}

const NUDGE = 0.1 // seconds a single arrow press moves a loop point

/** which end the arrows move: 'a', 'b', or both at once keeping the length */
const loopTarget = ref<'a' | 'b' | 'ab'>('ab')

const hasLoop = computed(() => loopA.value != null && loopB.value != null)

function nudgeLoop(direction: -1 | 1) {
  const delta = direction * NUDGE
  if (loopTarget.value != 'b' && loopA.value != null) loopA.value = Math.max(0, loopA.value + delta)
  if (loopTarget.value != 'a' && loopB.value != null) loopB.value = Math.min(trackDuration.value, loopB.value + delta)
  keepLoopOrdered()
}

/** halve or double the selection, keeping A where it is */
function scaleLoop(factor: number) {
  if (loopA.value == null || loopB.value == null) return
  loopB.value = Math.min(trackDuration.value, loopA.value + (loopB.value - loopA.value) * factor)
  keepLoopOrdered()
}

// a nudge or a scale must never leave B at or before A
function keepLoopOrdered() {
  if (loopA.value != null && loopB.value != null && loopB.value <= loopA.value) loopA.value = Math.max(0, loopB.value - NUDGE)
}

function clearLoop() {
  loopA.value = null
  loopB.value = null
}

// --- transport ---
function toStart() {
  if (currentTime.value <= RESTART_WINDOW && props.hasPrev) emit('prevSong')
  else engine.seek(0)
}

const zoom = (seconds: number) => (span.value = Math.max(2, Math.min(seconds, duration.value || span.value)))

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
// were mastered at different levels. The output device, by contrast, is this device's. ---
const GAIN_LIMIT = 20 // dB either way

const storedOutput = useLocalStorage('audio.output', '')
outputDevice.value = storedOutput.value
watch(outputDevice, (v) => (storedOutput.value = v))

const adjustGain = (delta: number) =>
  (gainDb.value = Math.round(Math.max(-GAIN_LIMIT, Math.min(GAIN_LIMIT, gainDb.value + delta)) * 100) / 100)

const gainLabel = computed(() => `${gainDb.value > 0 ? '+' : ''}${gainDb.value.toFixed(2)} dB`)
const gainPercent = computed(() => `${Math.round(10 ** (gainDb.value / 20) * 100)}%`)

const outputs = ref<MediaDeviceInfo[]>([])

async function loadOutputs() {
  if (!engine.canPickOutput || !navigator.mediaDevices?.enumerateDevices) return
  // before permission is granted Chrome reports one placeholder device with a blank id;
  // it is just the default output again, so it is dropped rather than shown twice
  outputs.value = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind == 'audiooutput' && d.deviceId)
}

// device labels stay blank until something has been granted mic access, so the picker
// offers to ask for it rather than listing a row of unnamed devices
const outputsNamed = computed(() => outputs.value.length > 0 && outputs.value.every((d) => d.label))

async function nameOutputs() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    await loadOutputs()
  } catch {
    /* declined: the default device still works, it just has no name */
  }
}

onMounted(() => {
  loadOutputs()
  navigator.mediaDevices?.addEventListener?.('devicechange', loadOutputs)
})

// --- level monitoring: what the gain and the limiter are actually doing, measured off
// the live signal and painted onto the waveform as the track plays ---
const monitor = useLocalStorage('audio.monitor', false)
const gainTrail = ref<Float32Array | null>(null)
const outTrail = ref<Float32Array | null>(null)
const reduction = ref(0)

function resetTrails() {
  const buckets = Math.ceil(trackDuration.value * PEAKS_PER_SECOND) + 1
  gainTrail.value = new Float32Array(buckets)
  outTrail.value = new Float32Array(buckets)
  reduction.value = 0
  lastBucket = -1
}

// a trail measured at one gain says nothing about another, so changing it starts over
watch([monitor, trackKey, gainDb], () => monitor.value && resetTrails())

let lastBucket = -1

// currentTime advances once per animation frame while playing, which is exactly when
// there is a fresh window of samples to measure
watch(currentTime, (at) => {
  if (!monitor.value || !playing.value || !gainTrail.value || !outTrail.value) return
  const { pre, post, reduction: gr } = engine.levels()
  reduction.value = gr
  const bucket = Math.min(Math.round(at * PEAKS_PER_SECOND), gainTrail.value.length - 1)
  // one frame can span several buckets, more so at high tempo, so fill the gap behind it
  const from = lastBucket >= 0 && bucket - lastBucket <= PEAKS_PER_SECOND ? lastBucket + 1 : bucket
  for (let i = Math.min(from, bucket); i <= bucket; i++) {
    gainTrail.value[i] = Math.max(gainTrail.value[i], pre)
    outTrail.value[i] = Math.max(outTrail.value[i], post)
  }
  lastBucket = bucket
})

const hasAudio = computed(() => !!track.value)
const trackDuration = computed(() => duration.value || track.value?.duration || 0)
const viewModes = computed(() =>
  (['waveform', 'lyrics', 'chords'] as const).filter((m) => m != 'waveform' || hasAudio.value)
)

// nothing to show on the waveform when the song has no track
watch(
  hasAudio,
  (audio) => {
    if (!audio && view.value == 'waveform') view.value = 'lyrics'
  },
  { immediate: true }
)

defineExpose({ position: currentTime })
</script>

<template>
  <div class="d-flex flex-column h-100 audio-pane">
    <div class="flex-1-1-0" style="min-height: 0; position: relative">
      <WaveformCanvas
        v-if="hasAudio"
        v-show="view == 'waveform'"
        draggable
        :peaks="peaks"
        :duration="trackDuration"
        :start="windowStart"
        :end="windowEnd"
        :markers="markers"
        :loopA="loopA"
        :loopB="loopB"
        :position="currentTime"
        :gainTrail="monitor ? gainTrail : null"
        :outTrail="monitor ? outTrail : null"
        :reduction="reduction"
        @seek="engine.seek"
        @moveMarker="moveMarker"
        @moveLoop="setLoop"
        @zoom="zoom"
      />
      <div v-if="view != 'waveform'" class="h-100 w-100 d-flex justify-center view-pane" style="overflow: hidden">
        <slot name="view" :position="currentTime" :playing="playing" />
      </div>
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
        <button class="tbtn" aria-label="Quieter" @click="adjustGain(-0.1)"><i class="fas fa-volume-low" /></button>
        <JogStrip
          v-model="gainDb"
          :step="0.01"
          :min="-GAIN_LIMIT"
          :max="GAIN_LIMIT"
          :resetTo="0"
          :label="gainLabel"
          :sub="gainPercent"
        />
        <button class="tbtn" aria-label="Louder" @click="adjustGain(0.1)"><i class="fas fa-volume-high" /></button>
        <select v-if="engine.canPickOutput" v-model="outputDevice" class="track-picker" aria-label="Audio output" @focus="loadOutputs">
          <option value="">System default</option>
          <option v-for="d in outputs" :key="d.deviceId" :value="d.deviceId">{{ d.label || 'Unnamed output' }}</option>
        </select>
        <button v-if="engine.canPickOutput && !outputsNamed" class="tbtn" aria-label="Name audio outputs" @click="nameOutputs">
          <i class="fas fa-tag" />
        </button>
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
        :loopA="loopA"
        :loopB="loopB"
        :position="currentTime"
        @seek="engine.seek"
      />
      <div v-else class="h-100 d-flex align-center justify-center text-grey no-audio">No audio available</div>
    </div>

    <!-- A-B, transport and the view switch -->
    <div class="controls">
      <template v-if="hasAudio">
        <div class="group group--side">
          <select v-if="tracks.length > 1" v-model="trackIndex" class="track-picker" aria-label="Audio track">
            <option v-for="(t, i) in tracks" :key="t.storageRef" :value="i">{{ t.name }}</option>
          </select>
          <button class="tbtn" :class="{ 'tbtn--on': loopA != null }" @click="setLoop('a')">A</button>
          <button class="tbtn" aria-label="Clear A-B" @click="clearLoop"><i class="fas fa-times" /></button>
          <button class="tbtn" :class="{ 'tbtn--on': loopB != null }" @click="setLoop('b')">B</button>
        </div>

        <div class="group">
          <button
            v-for="t in (['a', 'ab', 'b'] as const)"
            :key="t"
            class="tbtn"
            :class="{ 'tbtn--on': loopTarget == t }"
            :aria-label="{ a: 'Move A', ab: 'Move A and B', b: 'Move B' }[t]"
            @click="loopTarget = t"
          >
            {{ { a: 'A', ab: '⇄', b: 'B' }[t] }}
          </button>
          <button class="tbtn" aria-label="Nudge left" :disabled="!hasLoop" @click="nudgeLoop(-1)"><i class="fas fa-arrow-left" /></button>
          <button class="tbtn" aria-label="Nudge right" :disabled="!hasLoop" @click="nudgeLoop(1)"><i class="fas fa-arrow-right" /></button>
          <button class="tbtn" aria-label="Halve selection" :disabled="!hasLoop" @click="scaleLoop(0.5)">½</button>
          <button class="tbtn" aria-label="Double selection" :disabled="!hasLoop" @click="scaleLoop(2)">x2</button>
        </div>

        <div class="group group--centre">
          <button class="tbtn" aria-label="Restart or previous song" @click="toStart"><i class="fas fa-backward-fast" /></button>
          <button class="tbtn" aria-label="Back 10 seconds" @click="engine.skip(-SKIP)"><i class="fas fa-backward" /></button>
          <button class="tbtn tbtn--play" :aria-label="playing ? 'Pause' : 'Play'" :disabled="!!error || loading" @click="engine.toggle">
            <i :class="playing ? 'fas fa-pause' : 'fas fa-play'" />
          </button>
          <button class="tbtn" aria-label="Forward 10 seconds" @click="engine.skip(SKIP)"><i class="fas fa-forward" /></button>
          <button class="tbtn" aria-label="Next song" :disabled="!hasNext" @click="emit('nextSong')"><i class="fas fa-forward-fast" /></button>
        </div>
      </template>

      <button
        v-if="hasAudio"
        class="tbtn"
        :class="{ 'tbtn--on': monitor }"
        aria-label="Monitor levels"
        title="Show measured levels on the waveform"
        @click="monitor = !monitor"
      >
        <i class="fas fa-chart-simple" />
      </button>

      <div class="group group--side segmented">
        <button
          v-for="mode in viewModes"
          :key="mode"
          class="tbtn"
          :class="{ 'tbtn--on': view == mode }"
          :aria-label="mode"
          @click="view = mode"
        >
          <i :class="{ waveform: 'fas fa-wave-square', lyrics: 'fas fa-file-lines', chords: 'fas fa-music' }[mode]" />
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
  min-width: 42px;
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

.view-pane {
  background: #fff;
}

.no-audio {
  font-size: 13px;
}

.loading-badge {
  position: absolute;
  inset: auto 0 8px 0;
  text-align: center;
  color: #f59e0b;
  pointer-events: none;
}
</style>
