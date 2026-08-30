import { beforeAll, expect, test } from 'vitest'

/**
 * The worklet is plain DSP over Float32Arrays, so it can be run here with only the two
 * globals the worklet scope would have provided.
 */
let Processor: any

beforeAll(async () => {
  ;(globalThis as any).AudioWorkletProcessor = class {
    port = { postMessage: () => {}, onmessage: null as any }
  }
  ;(globalThis as any).registerProcessor = (_name: string, cls: any) => (Processor = cls)
  await import('../soundtouchWorklet.js')
})

const ramp = (n: number) => Float32Array.from({ length: n }, (_, i) => Math.sin(i / 10) * 0.5)

function play(frames: number, { tempo = 1, pitch = 0 } = {}) {
  const processor = new Processor({ processorOptions: { tempo, pitch } })
  const channels = [ramp(frames), ramp(frames)]
  processor.port.onmessage({ data: { channels, startFrame: 0 } })
  processor.port.onmessage({ data: { playing: true } })
  const out = new Float32Array(frames)
  const block = [new Float32Array(128), new Float32Array(128)]
  for (let pos = 0; pos < frames; pos += 128) {
    block[0].fill(0), block[1].fill(0)
    processor.process([], [block])
    out.set(block[0].subarray(0, Math.min(128, frames - pos)), pos)
  }
  return { processor, source: channels[0], out }
}

// the wobble this guards against is SoundTouch splicing the track even with nothing to
// stretch: at its own speed and pitch the output has to be the recording, sample for sample
test('plays an unaltered track back untouched', () => {
  const { source, out } = play(48000)
  expect(Array.from(out)).toEqual(Array.from(source))
})

test('stretches once tempo or pitch move off unaltered', () => {
  const { source, out } = play(48000, { tempo: 1.2 })
  expect(Array.from(out)).not.toEqual(Array.from(source))
})

test('hands the playhead over when the stretcher takes the track on', () => {
  const { processor } = play(48000)
  const position = processor.position
  processor.port.onmessage({ data: { tempo: 1.2 } })
  expect(processor.filter.sourcePosition).toBe(Math.round(position))
})
