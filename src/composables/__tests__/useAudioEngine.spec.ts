import { useAudioEngine } from '@/composables/useAudioEngine'
import { nextTick } from 'vue'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

/**
 * What this guards is the same thing the old soundtouch worklet spec guarded, said in the
 * terms of the graph that replaced it: a track at its own speed and pitch must not be put
 * through the stretcher at all. Signalsmith is spectral and always processes, so routing
 * through it at 1x/0 st would colour the recording for nothing — and unity is where the
 * app sits by default. The old spec could assert that sample-for-sample because the
 * stretcher was ours; this one asserts the wiring, which is where the decision now lives.
 *
 * The compensation is the other half: tempo is `playbackRate`, which transposes, so the
 * stretcher has to be asked for the difference or a capo would drift with the tempo.
 */

/** the edges of the graph, as (from -> to) pairs, so the routing can be read back */
let edges: [string, string][] = []
let stretchNode: any
let scheduled: { semitones?: number }[] = []
let sourceRates: number[] = []
let gains = 0
let clickTimes: number[] = []
let sourceStarts: number[] = []
let sourceStops = 0

const tag = (n: any) => n?.__tag ?? 'unknown'

function node(__tag: string, extra: object = {}) {
  const self: any = {
    __tag,
    connect: (to: any) => (edges.push([__tag, tag(to)]), to),
    disconnect: () => (edges = edges.filter(([from]) => from !== __tag)),
    ...extra,
  }
  return self
}

const param = (value = 0) => ({ value, setTargetAtTime: () => {}, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} })

vi.mock('@/audio/signalsmith', () => ({ stretchFactory: async () => async () => stretchNode }))

class FakeAudioContext {
  currentTime = 0
  sampleRate = 48000
  destination = node('destination')
  resume = async () => {}
  close = async () => {}
  // numbered, because which gain is which is exactly what these tests read: the first one
  // built is the stem mix, the second is the output trim
  createGain = () => node(`gain${gains++}`, { gain: param(1) })
  createDynamicsCompressor = () =>
    node('limiter', { knee: param(), threshold: param(), ratio: param(), attack: param(), release: param() })
  createAnalyser = () => node('analyser', { fftSize: 0, getFloatTimeDomainData: () => {} })
  createOscillator = () =>
    node('osc', { frequency: param(0), start: (at: number) => clickTimes.push(at), stop: () => {} })
  createBufferSource = () => {
    const src: any = node('source', {
      playbackRate: param(1),
      start: (when: number) => sourceStarts.push(when),
      stop: () => sourceStops++,
      set buffer(_b: AudioBuffer) {},
    })
    sourceRates.push(0)
    const i = sourceRates.length - 1
    Object.defineProperty(src.playbackRate, 'value', {
      get: () => sourceRates[i],
      set: (v: number) => (sourceRates[i] = v),
    })
    return src
  }
  decodeAudioData = async () => ({ duration: 60, numberOfChannels: 2, getChannelData: () => new Float32Array(8) })
}

beforeEach(() => {
  edges = []
  scheduled = []
  sourceRates = []
  gains = 0
  clickTimes = []
  sourceStarts = []
  sourceStops = 0
  stretchNode = node('stretch', {
    schedule: (c: { semitones?: number }) => scheduled.push(c),
    start: () => {},
    latency: async () => 0.12,
  })
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => vi.useRealTimers())

/** what the mix is feeding: the stretcher, or the output gain past it */
const mixGoesTo = () => edges.find(([from]) => from === 'gain0')?.[1]

async function started() {
  const engine = useAudioEngine()
  await engine.load(async () => new ArrayBuffer(8))
  await engine.play()
  return engine
}

async function settle(engine: ReturnType<typeof useAudioEngine>, tempo: number, pitch: number) {
  engine.tempo.value = tempo
  engine.pitch.value = pitch
  await nextTick()
  // the routing awaits the stretcher coming up before it reconnects anything
  await new Promise((r) => setTimeout(r))
  await new Promise((r) => setTimeout(r))
}

async function counting(beats: number, bpm: number) {
  const engine = useAudioEngine()
  await engine.load(async () => new ArrayBuffer(8))
  engine.countInBeats.value = beats
  engine.countInBpm.value = bpm
  await engine.play()
  return engine
}

test('counts the beats off and brings the track in on the downbeat after them', async () => {
  vi.useFakeTimers()
  const engine = await counting(4, 120)
  // all four scheduled up front on the audio clock, half a second apart...
  expect(clickTimes).toEqual([0.1, 0.6, 1.1, 1.6])
  // ...and the track with them, for the beat after the last click rather than for whenever
  // a timer happens to fire
  expect(sourceStarts).toEqual([2.1])
  expect(engine.countingIn.value).toBe(true)
  expect(engine.currentTime.value).toBe(0) // the playhead holds at the start over the count

  await vi.advanceTimersByTimeAsync(2100)
  expect([engine.playing.value, engine.countingIn.value]).toEqual([true, false])
})

test('gives the sources a head start when the graph holds the sound back', async () => {
  const engine = useAudioEngine()
  await engine.load(async () => new ArrayBuffer(8))
  await settle(engine, 1, 3) // a capo puts the mix through the stretcher, which holds 120 ms
  engine.countInBeats.value = 4
  engine.countInBpm.value = 120
  await engine.play()
  expect(sourceStarts.at(-1)).toBeCloseTo(2.1 - 0.12, 6) // out of the speakers on the downbeat
  engine.pause() // and nothing left counting once the test is done
})

test('pausing over the count calls it off, track and clicks together', async () => {
  vi.useFakeTimers()
  const engine = await counting(4, 120)
  engine.pause()
  expect([engine.countingIn.value, engine.playing.value]).toEqual([false, false])
  expect(sourceStops).toBe(1) // the scheduled track is called off before it is heard

  await vi.advanceTimersByTimeAsync(2100)
  expect(engine.playing.value).toBe(false)
})

test('plays an unaltered track without going through the stretcher', async () => {
  await started()
  expect(mixGoesTo()).toBe('gain1')
  expect(scheduled).toEqual([])
})

test('routes through the stretcher once a capo or a tempo is on', async () => {
  const engine = await started()
  await settle(engine, 1, 3)
  expect(mixGoesTo()).toBe('stretch')
})

test('comes back off the stretcher when the track returns to its own speed and pitch', async () => {
  const engine = await started()
  await settle(engine, 1, 3)
  await settle(engine, 1, 0)
  expect(mixGoesTo()).toBe('gain1')
})

test('puts the pitch back that the playback rate took away', async () => {
  const engine = await started()
  // half speed drops the recording an octave on its own, so the stretcher owes it one back
  await settle(engine, 0.5, 0)
  expect(sourceRates.at(-1)).toBe(0.5)
  expect(scheduled.at(-1)!.semitones).toBeCloseTo(12, 6)

  // and a capo on top of that is the sum of the two
  await settle(engine, 0.5, 3)
  expect(scheduled.at(-1)!.semitones).toBeCloseTo(15, 6)
})
