<script setup lang="ts">
import WaveformCanvas from '@/components/WaveformCanvas.vue'
import { useAudioEngine } from '@/composables/useAudioEngine'
import { audioUrl, loadPeaks } from '@/helpers/audioTracks'
import { songCollection } from '@/plugins/firebase'
import { AudioTrack, Song } from '@/types'
import { useDebounceFn } from '@vueuse/core'
import { doc, updateDoc } from 'firebase/firestore'
import { computed, ref, watch } from 'vue'

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
const { currentTime, duration, playing, loading, error, tempo, pitch, loopA, loopB } = engine

const trackIndex = ref(0)
const tracks = computed(() => props.song.audioTracks ?? [])
const track = computed((): AudioTrack | undefined => tracks.value[trackIndex.value])
const peaks = ref(new Uint8Array())
const markers = ref<number[]>([])

const windowStart = ref(0)
const windowEnd = ref(DEFAULT_SPAN)

watch(
  () => props.song.id,
  () => (trackIndex.value = 0)
)

// load the selected track: peaks first so the waveform is there before the audio is
watch(
  track,
  async (current) => {
    if (!current) return
    markers.value = [...current.markers]
    loopA.value = current.loopA ?? null
    loopB.value = current.loopB ?? null
    tempo.value = current.tempo ?? 1
    pitch.value = current.pitch ?? 0
    windowStart.value = 0
    windowEnd.value = Math.min(DEFAULT_SPAN, current.duration)
    peaks.value = new Uint8Array()
    peaks.value = await loadPeaks(current)
    await engine.load(await audioUrl(current))
  },
  { immediate: true }
)

// --- persistence: markers, loop, tempo and pitch belong to the track ---
const persist = useDebounceFn(() => {
  if (!props.song.id || !track.value) return
  const updated = tracks.value.map((t, i) => {
    if (i !== trackIndex.value) return t
    // Firestore rejects undefined, so a cleared A-B has to be left out entirely
    const next: AudioTrack = { ...t, markers: markers.value, tempo: tempo.value, pitch: pitch.value }
    delete next.loopA
    delete next.loopB
    if (loopA.value != null) next.loopA = loopA.value
    if (loopB.value != null) next.loopB = loopB.value
    return next
  })
  updateDoc(doc(songCollection, props.song.id), { audioTracks: updated })
}, 500)

watch([markers, loopA, loopB, tempo, pitch], persist, { deep: true })

// --- markers ---
const nearestMarker = (seconds: number) =>
  markers.value.reduce<number | null>((best, m) => (best == null || Math.abs(m - seconds) < Math.abs(best - seconds) ? m : best), null)

function snap(seconds: number) {
  const nearest = nearestMarker(seconds)
  return nearest != null && Math.abs(nearest - seconds) <= SNAP ? nearest : seconds
}

function toggleMarker() {
  const existing = markers.value.findIndex((m) => Math.abs(m - currentTime.value) <= MARKER_HIT)
  if (existing >= 0) markers.value = markers.value.filter((_, i) => i !== existing)
  else markers.value = [...markers.value, currentTime.value].sort((a, b) => a - b)
}

function moveMarker(index: number, seconds: number) {
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
  const at = snap(seconds)
  if (which === 'a') {
    loopA.value = at
    if (loopB.value != null && loopB.value <= at) loopB.value = null
  } else {
    loopB.value = at
    if (loopA.value != null && loopA.value >= at) loopA.value = null
  }
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

// --- zoomed view follows the playhead ---
watch(currentTime, (t) => {
  if (!playing.value) return
  const span = windowEnd.value - windowStart.value
  windowStart.value = Math.max(0, Math.min(t - span / 2, duration.value - span))
  windowEnd.value = windowStart.value + span
})

function setWindow(start: number, end: number) {
  windowStart.value = start
  windowEnd.value = end
}

const stamp = (seconds: number) => {
  const safe = Math.max(0, seconds)
  const mins = Math.floor(safe / 60)
  const secs = Math.floor(safe % 60)
  return `${mins}:${String(secs).padStart(2, '0')}.${String(Math.floor((safe % 1) * 1000)).padStart(3, '0')}`
}

const effectiveBpm = computed(() => (props.song.bpm ? Math.round(props.song.bpm * tempo.value) : null))
const adjustTempo = (delta: number) => (tempo.value = Math.round(Math.max(0.5, Math.min(1.5, tempo.value + delta)) * 100) / 100)
const adjustPitch = (delta: number) => (pitch.value = Math.max(-12, Math.min(12, pitch.value + delta)))

defineExpose({ position: currentTime })
</script>

<template>
  <div class="d-flex flex-column h-100 audio-pane">
    <div v-if="!track" class="flex-1-1-0 d-flex align-center justify-center text-grey">No audio track for this song</div>

    <template v-else>
      <div class="flex-1-1-0" style="min-height: 0; position: relative">
        <WaveformCanvas
          v-show="view == 'waveform'"
          :peaks="peaks"
          :duration="duration || track.duration"
          :start="windowStart"
          :end="windowEnd"
          :markers="markers"
          :loopA="loopA"
          :loopB="loopB"
          :position="currentTime"
          @seek="engine.seek"
          @moveMarker="moveMarker"
          @moveLoop="setLoop"
          @window="setWindow"
        />
        <div v-if="view != 'waveform'" class="h-100 d-flex justify-center" style="overflow: hidden">
          <slot name="view" :position="currentTime" />
        </div>
        <div v-if="loading || error" class="loading-badge">{{ error || 'Loading audio…' }}</div>
      </div>

      <!-- tempo, markers and pitch, flanked by elapsed / remaining -->
      <div class="d-flex align-center ga-2 px-2 py-1 flex-wrap justify-center controls">
        <span class="text-caption stamp">{{ stamp(currentTime) }}</span>

        <div class="d-flex align-center ga-1">
          <v-btn size="small" variant="tonal" icon="fas fa-minus" @click="adjustTempo(-0.05)" />
          <span class="value">
            {{ tempo.toFixed(2) }}x
            <small v-if="effectiveBpm" class="text-grey">{{ effectiveBpm }} bpm</small>
          </span>
          <v-btn size="small" variant="tonal" icon="fas fa-plus" @click="adjustTempo(0.05)" />
        </div>

        <div class="d-flex align-center ga-1">
          <v-btn size="small" variant="tonal" icon="fas fa-backward-step" @click="jumpMarker(-1)" />
          <v-btn size="small" variant="tonal" icon="fas fa-flag" @click="toggleMarker" />
          <v-btn size="small" variant="tonal" icon="fas fa-forward-step" @click="jumpMarker(1)" />
        </div>

        <div class="d-flex align-center ga-1">
          <v-btn size="small" variant="tonal" icon="fas fa-arrow-down" @click="adjustPitch(-1)" />
          <span class="value">{{ pitch.toFixed(2) }} semi</span>
          <v-btn size="small" variant="tonal" icon="fas fa-arrow-up" @click="adjustPitch(1)" />
        </div>

        <span class="text-caption stamp">-{{ stamp((duration || track.duration) - currentTime) }}</span>
      </div>

      <div style="height: 60px; flex: none">
        <WaveformCanvas
          overview
          :peaks="peaks"
          :duration="duration || track.duration"
          :start="0"
          :end="duration || track.duration"
          :markers="markers"
          :loopA="loopA"
          :loopB="loopB"
          :position="currentTime"
          @seek="engine.seek"
        />
      </div>

      <!-- A-B, transport and the view switch -->
      <div class="d-flex align-center ga-2 px-2 py-1 flex-wrap justify-center controls">
        <v-select
          v-if="tracks.length > 1"
          v-model="trackIndex"
          :items="tracks.map((t, i) => ({ title: t.name, value: i }))"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 160px"
        />

        <div class="d-flex align-center ga-1">
          <v-btn size="small" :variant="loopA != null ? 'flat' : 'tonal'" :color="loopA != null ? 'warning' : undefined" @click="setLoop('a')">A</v-btn>
          <v-btn size="small" variant="tonal" icon="fas fa-times" @click="clearLoop" />
          <v-btn size="small" :variant="loopB != null ? 'flat' : 'tonal'" :color="loopB != null ? 'warning' : undefined" @click="setLoop('b')">B</v-btn>
        </div>

        <div class="d-flex align-center ga-1">
          <v-btn size="small" variant="tonal" icon="fas fa-backward-fast" @click="toStart" />
          <v-btn size="small" variant="tonal" icon="fas fa-backward" @click="engine.skip(-SKIP)" />
          <v-btn
            size="large"
            variant="flat"
            color="warning"
            :icon="playing ? 'fas fa-pause' : 'fas fa-play'"
            :loading="loading"
            :disabled="!!error"
            @click="engine.toggle"
          />
          <v-btn size="small" variant="tonal" icon="fas fa-forward" @click="engine.skip(SKIP)" />
          <v-btn size="small" variant="tonal" icon="fas fa-forward-fast" :disabled="!hasNext" @click="emit('nextSong')" />
        </div>

        <v-btn-toggle v-model="view" mandatory density="compact" variant="outlined" divided>
          <v-btn value="waveform" icon="fas fa-wave-square" size="small" />
          <v-btn value="lyrics" icon="fas fa-file-lines" size="small" />
          <v-btn value="chords" icon="fas fa-music" size="small" />
        </v-btn-toggle>
      </div>
    </template>
  </div>
</template>

<style scoped>
.audio-pane {
  background: #050505;
  color: #eee;
}
.controls {
  background: #101010;
}
.stamp {
  font-variant-numeric: tabular-nums;
  min-width: 8ch;
  text-align: center;
}
.value {
  min-width: 9ch;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.loading-badge {
  position: absolute;
  inset: auto 0 8px 0;
  text-align: center;
  color: #f59e0b;
  pointer-events: none;
}
</style>
