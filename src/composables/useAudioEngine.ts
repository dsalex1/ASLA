import { PitchShifter } from 'soundtouchjs'
import { onUnmounted, ref, watch } from 'vue'

const BUFFER_SIZE = 4096

/**
 * Streaming is not an option here: independent tempo and pitch need the whole
 * track decoded up front, so a track is fetched, decoded and kept in memory
 * while it is selected, and released as soon as another one is.
 */
export function useAudioEngine() {
  const currentTime = ref(0)
  const duration = ref(0)
  const playing = ref(false)
  const loading = ref(false)
  const error = ref('')
  const tempo = ref(1)
  const pitch = ref(0)
  const loopA = ref<number | null>(null)
  const loopB = ref<number | null>(null)

  let context: AudioContext | null = null
  let buffer: AudioBuffer | null = null
  let shifter: PitchShifter | null = null
  let loadToken = 0

  const audioContext = () => (context ??= new AudioContext())

  function teardownShifter() {
    shifter?.disconnect()
    shifter?.off()
    shifter = null
    playing.value = false
  }

  async function load(url: string) {
    const token = ++loadToken
    teardownShifter()
    buffer = null
    duration.value = 0
    currentTime.value = 0
    loading.value = true
    error.value = ''
    try {
      const bytes = await (await fetch(url)).arrayBuffer()
      const decoded = await audioContext().decodeAudioData(bytes)
      if (token !== loadToken) return // a newer load won
      buffer = decoded
      duration.value = decoded.duration
    } catch (e) {
      if (token !== loadToken) return
      console.error('Failed to load audio track:', e)
      error.value = 'Could not load this audio track'
    } finally {
      if (token === loadToken) loading.value = false
    }
  }

  function ensureShifter() {
    if (shifter || !buffer) return shifter
    shifter = new PitchShifter(audioContext(), buffer, BUFFER_SIZE, () => pause())
    shifter.tempo = tempo.value
    shifter.pitchSemitones = pitch.value
    shifter.percentagePlayed = duration.value ? currentTime.value / duration.value : 0
    shifter.on('play', ({ timePlayed }) => {
      currentTime.value = timePlayed
      // A-B repeat: jump back as soon as the playhead runs past B
      if (loopB.value != null && loopA.value != null && timePlayed >= loopB.value) seek(loopA.value)
    })
    return shifter
  }

  async function play() {
    const s = ensureShifter()
    if (!s) return
    await audioContext().resume()
    if (loopA.value != null && loopB.value != null && (currentTime.value < loopA.value || currentTime.value >= loopB.value))
      seek(loopA.value)
    s.connect(audioContext().destination)
    playing.value = true
  }

  function pause() {
    shifter?.disconnect()
    playing.value = false
  }

  const toggle = () => (playing.value ? pause() : play())

  function seek(seconds: number) {
    const clamped = Math.max(0, Math.min(seconds, duration.value))
    currentTime.value = clamped
    if (shifter && duration.value) shifter.percentagePlayed = clamped / duration.value
  }

  const skip = (seconds: number) => seek(currentTime.value + seconds)

  watch(tempo, (v) => shifter && (shifter.tempo = v))
  watch(pitch, (v) => shifter && (shifter.pitchSemitones = v))

  onUnmounted(() => {
    teardownShifter()
    buffer = null
    context?.close()
    context = null
  })

  return { currentTime, duration, playing, loading, error, tempo, pitch, loopA, loopB, load, play, pause, toggle, seek, skip }
}
