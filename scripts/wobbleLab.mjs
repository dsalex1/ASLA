/**
 * Measures pitch wobble (wow & flutter) in the playback engine, offline.
 *
 * The engine's worklet is pure DSP over Float32Arrays, so it can be run headlessly here
 * and its output compared against the file it was fed. A window of output is located in
 * the source by cross-correlation, which gives the source position each output instant
 * came from; at tempo 1 that offset should be a constant. Any wander in it *is* the
 * wobble, and each jump in it is a splice - a few ms of the recording repeated or dropped.
 *
 *   node scripts/wobbleLab.mjs <input.wav> [--tempo 1] [--pitch 0] [--secs 30] [--out dir]
 *                               [--engines worklet,ideal] [--worklet path.js] [--track]
 *
 * The offset only means anything while the output is the same recording, so the reading
 * is exact at 1x and 0 semitones - the case this exists to keep honest - and only
 * indicative once the stretcher is genuinely stretching.
 *
 * Input must be 32-bit float WAV (ffmpeg -c:a pcm_f32le). Renders one WAV per engine
 * variant next to the input so a run can also be judged by ear.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const RENDER_QUANTUM = 128

// --- wav ------------------------------------------------------------------------------

function readWav(path) {
  const buf = readFileSync(path)
  let pos = 12
  let fmt = null
  let data = null
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4)
    const size = buf.readUInt32LE(pos + 4)
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(pos + 8), channels: buf.readUInt16LE(pos + 10), sampleRate: buf.readUInt32LE(pos + 12), bits: buf.readUInt16LE(pos + 22) }
    if (id === 'data') data = buf.subarray(pos + 8, pos + 8 + size)
    pos += 8 + size + (size & 1)
  }
  if (!fmt || !data) throw new Error('not a wav')
  // 0xfffe is WAVE_FORMAT_EXTENSIBLE, which is what ffmpeg writes for float
  if ((fmt.format !== 3 && fmt.format !== 0xfffe) || fmt.bits !== 32)
    throw new Error('need 32-bit float wav: ffmpeg -c:a pcm_f32le')
  const frames = data.length / 4 / fmt.channels
  const channels = Array.from({ length: fmt.channels }, () => new Float32Array(frames))
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < fmt.channels; c++) channels[c][i] = data.readFloatLE((i * fmt.channels + c) * 4)
  return { sampleRate: fmt.sampleRate, channels }
}

function writeWav(path, channels, sampleRate) {
  const frames = channels[0].length
  const ch = channels.length
  const data = Buffer.alloc(frames * ch * 4)
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < ch; c++) data.writeFloatLE(channels[c][i], (i * ch + c) * 4)
  const head = Buffer.alloc(44)
  head.write('RIFF', 0)
  head.writeUInt32LE(36 + data.length, 4)
  head.write('WAVEfmt ', 8)
  head.writeUInt32LE(16, 16)
  head.writeUInt16LE(3, 20) // float
  head.writeUInt16LE(ch, 22)
  head.writeUInt32LE(sampleRate, 24)
  head.writeUInt32LE(sampleRate * ch * 4, 28)
  head.writeUInt16LE(ch * 4, 32)
  head.writeUInt16LE(32, 34)
  head.write('data', 36)
  head.writeUInt32LE(data.length, 40)
  writeFileSync(path, Buffer.concat([head, data]))
}

// --- the real worklet, off the audio thread -------------------------------------------

// enough of the worklet global scope for the shipped processor to be imported and run here
globalThis.AudioWorkletProcessor = class {
  constructor() {
    this.port = { postMessage: () => {}, onmessage: null }
  }
}
let Processor
globalThis.registerProcessor = (_name, cls) => (Processor = cls)

/**
 * @param engine 'worklet' is the shipped processor; 'ideal' reads the source straight
 *   through, as the control the measurement must score at zero.
 */
function render({ left, right, seconds, sampleRate, tempo, pitch, engine }) {
  const frames = Math.min(left.length, Math.round(seconds * sampleRate))
  const outL = new Float32Array(frames)
  const outR = new Float32Array(frames)
  if (engine === 'ideal') return [left.subarray(0, frames), right.subarray(0, frames)]

  const processor = new Processor({ processorOptions: { tempo, pitch } })
  processor.port.onmessage({ data: { channels: [left, right], startFrame: 0 } })
  processor.port.onmessage({ data: { playing: true } })
  const block = [new Float32Array(RENDER_QUANTUM), new Float32Array(RENDER_QUANTUM)]
  for (let pos = 0; pos < frames; pos += RENDER_QUANTUM) {
    block[0].fill(0), block[1].fill(0) // the graph hands a worklet zeroed output blocks
    processor.process([], [block])
    const n = Math.min(RENDER_QUANTUM, frames - pos)
    outL.set(block[0].subarray(0, n), pos)
    outR.set(block[1].subarray(0, n), pos)
  }
  return [outL, outR]
}

// --- analysis -------------------------------------------------------------------------

/** in-place iterative radix-2 FFT */
function fft(re, im, inverse) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) ([re[i], re[j]] = [re[j], re[i]]), ([im[i], im[j]] = [im[j], im[i]])
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k]
        const ui = im[i + k]
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k] = ur + vr
        im[i + k] = ui + vi
        re[i + k + len / 2] = ur - vr
        im[i + k + len / 2] = ui - vi
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) (re[i] /= n), (im[i] /= n)
}

const WIN = 4096 // ~85 ms: long enough to correlate, short enough to see the wobble
const HOP = 2048
const SEARCH = 2048 // how far the offset may wander, either way

/**
 * Where each window of `out` sits in `ref`, in samples, one reading every HOP frames.
 * Cross-correlation peak, refined to sub-sample by a parabola through its neighbours.
 */
function offsetTrack(out, ref, from, to) {
  const size = 1 << Math.ceil(Math.log2(WIN + 2 * SEARCH))
  const track = []
  const ar = new Float64Array(size)
  const ai = new Float64Array(size)
  const br = new Float64Array(size)
  const bi = new Float64Array(size)
  for (let pos = from; pos + WIN + SEARCH < to; pos += HOP) {
    ar.fill(0), ai.fill(0), br.fill(0), bi.fill(0)
    const start = pos - SEARCH
    if (start < 0) continue
    for (let i = 0; i < WIN + 2 * SEARCH; i++) ar[i] = ref[start + i] || 0
    for (let i = 0; i < WIN; i++) br[i] = out[pos + i] || 0
    let energy = 0
    for (let i = 0; i < WIN; i++) energy += br[i] * br[i]
    if (energy < 1e-4) continue // silence tells us nothing about timing
    fft(ar, ai, false)
    fft(br, bi, false)
    for (let i = 0; i < size; i++) {
      const cr = ar[i] * br[i] + ai[i] * bi[i] // A * conj(B)
      const ci = ai[i] * br[i] - ar[i] * bi[i]
      ar[i] = cr
      ai[i] = ci
    }
    fft(ar, ai, true)
    // normalised, or the peak drifts towards whichever part of the search range is loudest
    const score = new Float64Array(2 * SEARCH + 1)
    let running = 0
    for (let i = 0; i < WIN; i++) running += (ref[start + i] || 0) ** 2
    let best = -Infinity
    let bestAt = 0
    for (let m = 0; m <= 2 * SEARCH; m++) {
      score[m] = ar[m] / Math.sqrt(running || 1e-12)
      if (score[m] > best) (best = score[m]), (bestAt = m)
      running += (ref[start + m + WIN] || 0) ** 2 - (ref[start + m] || 0) ** 2
    }
    if (bestAt === 0 || bestAt === 2 * SEARCH) continue
    const [l, c, r] = [score[bestAt - 1], score[bestAt], score[bestAt + 1]]
    const sub = (0.5 * (l - r)) / (l - 2 * c + r || 1)
    track.push({ at: pos, offset: bestAt + sub - SEARCH })
  }
  return track
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

/** a step in the offset this big is a splice, not measurement noise */
const SPLICE_MS = 1

/**
 * Wow and flutter, from the offset track: how far the source position wanders from where
 * it should be, and how often it jumps. A time-stretcher moves in steps rather than
 * gliding, so it is the jumps that are heard - each one repeats or drops a few ms of the
 * recording, and on a sustained note that lands as a wobble.
 */
function wobble(track, sampleRate) {
  if (track.length < 3) return null
  const mid = median(track.map((t) => t.offset))
  const dev = track.map((t) => Math.abs(t.offset - mid))
  const toMs = (samples) => (samples / sampleRate) * 1000
  let splices = 0
  for (let i = 1; i < track.length; i++)
    if (toMs(Math.abs(track[i].offset - track[i - 1].offset)) > SPLICE_MS) splices++
  const span = (track.at(-1).at - track[0].at) / sampleRate
  return {
    windows: track.length,
    driftMsRms: toMs(Math.sqrt(dev.reduce((s, x) => s + x * x, 0) / dev.length)),
    driftMsPeak: toMs(Math.max(...dev)),
    splicesPerSecond: splices / span,
  }
}

// --- run ------------------------------------------------------------------------------

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args[i + 1]
}
const input = args[0]
if (!input || input.startsWith('--')) throw new Error('usage: node scripts/wobbleLab.mjs <input.wav> [--tempo 1] [--pitch 0] [--secs 30]')

const tempo = Number(flag('tempo', 1))
const pitch = Number(flag('pitch', 0))
const seconds = Number(flag('secs', 30))
const outDir = flag('out', dirname(input))
const engines = flag('engines', 'worklet,ideal').split(',')

// a path lets an older copy of the worklet be rendered beside the current one, for A/B
await import(pathToFileURL(resolve(flag('worklet', 'src/audio/soundtouchWorklet.js'))).href)

const { sampleRate, channels } = readWav(input)
const [left, right] = [channels[0], channels[1] || channels[0]]
const name = basename(input).replace(/\.wav$/i, '')
console.log(`${name}: ${sampleRate} Hz, ${channels.length} ch, analysing ${seconds}s at tempo ${tempo}, pitch ${pitch}`)

for (const engine of engines) {
  const t0 = Date.now()
  const [outL, outR] = render({ left, right, sampleRate, seconds, tempo, pitch, engine })
  const path = join(outDir, `${name}--${engine}.wav`)
  writeWav(path, [outL, outR], sampleRate)
  // measured against the mono sum, so a wobble that moves the two channels alike still shows
  const refMono = Float32Array.from({ length: Math.round(seconds * sampleRate) }, (_, i) => (left[i] + right[i]) / 2)
  const outMono = Float32Array.from(outL, (v, i) => (v + outR[i]) / 2)
  const at = Math.round(1 * sampleRate) // skip the pipe's first fill
  const track = offsetTrack(outMono, refMono, at, outMono.length - SEARCH)
  if (args.includes('--track'))
    writeFileSync(join(outDir, `${name}--${engine}.csv`), track.map((t) => `${(t.at / sampleRate).toFixed(3)},${t.offset.toFixed(2)}`).join('\n'))
  const w = wobble(track, sampleRate)
  const report = w
    ? `drift ${w.driftMsRms.toFixed(2)} ms rms / ${w.driftMsPeak.toFixed(2)} ms peak, ${w.splicesPerSecond.toFixed(1)} splices/s (${w.windows} windows)`
    : 'not enough signal to measure'
  console.log(`  ${engine.padEnd(11)} ${report}  [${((Date.now() - t0) / 1000).toFixed(1)}s] -> ${basename(path)}`)
}
