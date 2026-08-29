<script setup lang="ts">
import { formatDuration } from '@/helpers'
import { computePeaks, decodeAudio } from '@/helpers/audioPeaks'
import { uploadHashed } from '@/helpers/contentHash'
import { stemLabel } from '@/helpers/stems'
import { AudioTrack, Song } from '@/types'
import { ref as firebaseRef, getStorage } from 'firebase/storage'
import { computed, ref } from 'vue'

/**
 * Pulling a backing track off YouTube. The browser cannot read YouTube audio itself - the
 * player is cross-origin and the stream needs a token only a real client can mint - so a
 * relay resolves and serves the bytes, and everything after that is an ordinary upload.
 */
const RELAY = 'https://looptube-audio.dsalex.workers.dev'

const props = defineProps<{ song: Song; query: string }>()

const emit = defineEmits<{
  (e: 'imported', payload: { track: AudioTrack; hashes: Record<string, string>; split: boolean }): void
}>()

type Result = { id: string; title: string; channel: string; duration: string; thumbnail: string }

const terms = ref(props.query)
const results = ref<Result[] | null>(null)
const loading = ref(false)
const importing = ref('')
const error = ref('')
const splitAfter = ref(true)

const stemDefaults = computed<string[]>(() => {
  try {
    return JSON.parse(localStorage.getItem('stemDefaults') ?? '') ?? ['vocals', 'guitars', 'bass', 'drums']
  } catch {
    return ['vocals', 'guitars', 'bass', 'drums']
  }
})

/** A pasted link, a pasted id, or neither. */
const videoId = (input: string) =>
  /(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/.exec(input)?.[1] ??
  (/^[\w-]{11}$/.test(input.trim()) ? input.trim() : null)

const pastedId = computed(() => videoId(terms.value))

async function search() {
  loading.value = true
  error.value = ''
  results.value = null
  try {
    const response = await fetch(`${RELAY}/search?q=${encodeURIComponent(terms.value)}`)
    const body = await response.json()
    if (!response.ok) throw new Error(body.error ?? response.status)
    results.value = body.results
    if (!results.value?.length) error.value = 'No results found'
  } catch (e) {
    console.error('YouTube search failed:', e)
    error.value = 'Search failed'
  }
  loading.value = false
}

/** How far the video is from what the song claims to be, as a fraction; NaN when unknown. */
const drift = (seconds: number) => (props.song.duration ? Math.abs(seconds - props.song.duration) / props.song.duration : NaN)

async function pick(id: string, title: string) {
  if (importing.value) return
  importing.value = id
  error.value = ''
  try {
    const response = await fetch(`${RELAY}/audio?v=${id}`)
    if (!response.ok) throw new Error(`the relay could not fetch this video (${response.status})`)
    const type = response.headers.get('Content-Type') ?? 'audio/webm'
    const name = decodeURIComponent(response.headers.get('X-Title') ?? '') || title
    const bytes = await response.arrayBuffer()

    // decoded here rather than trusted: the relay's duration is the video's, and the
    // waveform has to match the audio that actually arrived
    const decoded = await decodeAudio(bytes.slice(0))
    const peaks = computePeaks(decoded)
    if (Number.isFinite(drift(decoded.duration)) && drift(decoded.duration) > 0.15)
      console.warn('The imported audio is a different length than the song says it is')

    const storage = getStorage()
    const base = `audio/${props.song.id}_${Date.now()}`
    const audioRef = firebaseRef(storage, `${base}_${id}`)
    const peaksRef = firebaseRef(storage, `${base}.peaks`)
    const [audioHash, peaksHash] = await Promise.all([
      uploadHashed(audioRef, new Uint8Array(bytes), { contentType: type, customMetadata: { youtube: id } }),
      uploadHashed(peaksRef, peaks, { contentType: 'application/octet-stream' }),
    ])

    emit('imported', {
      track: {
        name,
        storageRef: audioRef.fullPath,
        peaksRef: peaksRef.fullPath,
        duration: decoded.duration,
        markers: [],
        source: { kind: 'youtube', videoId: id, title: name },
      },
      hashes: { [audioRef.fullPath]: audioHash, [peaksRef.fullPath]: peaksHash },
      split: splitAfter.value,
    })
    results.value = null
  } catch (e) {
    console.error('YouTube import failed:', e)
    error.value = `Import failed: ${(e as Error).message ?? e}`
  }
  importing.value = ''
}
</script>

<template>
  <div>
    <v-text-field
      v-model="terms"
      label="Search YouTube, or paste a link"
      variant="outlined"
      density="compact"
      hide-details
      append-inner-icon="fas fa-magnifying-glass"
      @keydown.enter="pastedId ? pick(pastedId, terms) : search()"
      @click:append-inner="pastedId ? pick(pastedId, terms) : search()"
    />

    <div class="d-flex align-center flex-wrap mt-1">
      <v-checkbox
        v-model="splitAfter"
        density="compact"
        hide-details
        color="primary"
        label="Split into stems after importing"
      />
      <span v-if="splitAfter" class="text-caption text-grey ms-2">
        {{ stemDefaults.map(stemLabel).join(', ') }}
      </span>
    </div>

    <v-btn
      v-if="pastedId"
      class="mt-1"
      size="small"
      color="primary"
      variant="tonal"
      :loading="importing === pastedId"
      :text="`Import ${pastedId}`"
      @click="pick(pastedId, terms)"
    />

    <v-progress-linear v-if="loading" indeterminate class="mt-2" />
    <div v-if="error" class="text-error text-caption mt-2">{{ error }}</div>

    <v-list v-if="results?.length" density="compact" class="mt-1">
      <v-list-item v-for="result in results" :key="result.id" :disabled="!!importing" @click="pick(result.id, result.title)">
        <template #prepend>
          <v-img :src="result.thumbnail" width="80" height="45" cover class="me-3 rounded" />
        </template>
        <v-list-item-title>{{ result.title }}</v-list-item-title>
        <v-list-item-subtitle>
          {{ result.channel }}
          <template v-if="result.duration"> - {{ result.duration }}</template>
          <template v-if="song.duration"> (song: {{ formatDuration(Math.round(song.duration)) }})</template>
        </v-list-item-subtitle>
        <template #append>
          <v-progress-circular v-if="importing === result.id" indeterminate size="20" />
          <v-icon v-else icon="fas fa-download" size="small" />
        </template>
      </v-list-item>
    </v-list>
  </div>
</template>
