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
    shifter = null
    pause()
  }

  /** knownDuration lets the waveform be scrubbed while the file is still decoding */
  async function load(url: string, knownDuration = 0) {
    const token = ++loadToken
    teardownShifter()
    buffer = null
    duration.value = knownDuration
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
    seekShifter(currentTime.value)
    return shifter
  }

  // SoundTouch reports how far it has read ahead, which leads what you hear by a few
  // hundred ms, so the playhead is driven off the audio clock instead.
  let baseContextTime = 0
  let baseTrackTime = 0
  let frame: number | null = null

  function rebase() {
    baseContextTime = audioContext().currentTime
    baseTrackTime = currentTime.value
  }

  const positionNow = () => baseTrackTime + (audioContext().currentTime - baseContextTime) * tempo.value

  function tick() {
    if (!playing.value) return
    const at = positionNow()
    // A-B repeat: jump back as soon as the playhead runs past B
    if (loopA.value != null && loopB.value != null && at >= loopB.value) seek(loopA.value)
    else if (at >= duration.value) (currentTime.value = duration.value), pause()
    else currentTime.value = at
    frame = requestAnimationFrame(tick)
  }

  async function play() {
    const s = ensureShifter()
    if (!s) return
    await audioContext().resume()
    if (loopA.value != null && loopB.value != null && (currentTime.value < loopA.value || currentTime.value >= loopB.value))
      seek(loopA.value)
    rebase()
    s.connect(audioContext().destination)
    playing.value = true
    tick()
  }

  function pause() {
    // frames stop while the page is hidden, so take the position from the clock rather
    // than trusting whatever the last frame wrote
    if (playing.value) currentTime.value = Math.max(0, Math.min(positionNow(), duration.value))
    shifter?.disconnect()
    playing.value = false
    if (frame) cancelAnimationFrame(frame)
    frame = null
  }

  const toggle = () => (playing.value ? pause() : play())

  const seekShifter = (seconds: number) => {
    if (shifter && duration.value) shifter.percentagePlayed = seconds / duration.value
  }

  function seek(seconds: number) {
    if (!Number.isFinite(seconds)) return // a seek from a not-yet-measured waveform must not poison the position
    currentTime.value = Math.max(0, Math.min(seconds, duration.value))
    seekShifter(currentTime.value)
    rebase()
  }

  const skip = (seconds: number) => seek(currentTime.value + seconds)

  // the clock slope changes with tempo, so restart the measurement from here
  watch(tempo, (v) => {
    rebase()
    if (shifter) shifter.tempo = v
  })
  watch(pitch, (v) => shifter && (shifter.pitchSemitones = v))

  onUnmounted(() => {
    teardownShifter()
    buffer = null
    context?.close()
    context = null
  })

  return { currentTime, duration, playing, loading, error, tempo, pitch, loopA, loopB, load, play, pause, toggle, seek, skip }
}
