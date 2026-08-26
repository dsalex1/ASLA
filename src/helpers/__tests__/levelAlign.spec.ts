import { PEAKS_PER_SECOND } from '@/helpers/audioPeaks'
import { estimateLag, Reading } from '@/helpers/levelAlign'
import { describe, expect, it } from 'vitest'

/** a track whose loudness wanders, so its shape is actually distinctive */
const peaks = () => {
  const data = new Uint8Array(20 * PEAKS_PER_SECOND)
  for (let i = 0; i < data.length; i++) data[i] = Math.round(128 + 120 * Math.sin(i / 37) * Math.cos(i / 11))
  return data
}

/** readings of that same track, arriving `lag` seconds late and scaled by some gain */
const readingsFor = (source: Uint8Array, lag: number, gain = 1, from = 5, to = 8): Reading[] => {
  const out: Reading[] = []
  for (let at = from; at < to; at += 1 / 60) {
    const index = Math.round((at - lag) * PEAKS_PER_SECOND)
    out.push({ at, level: (source[index] / 255) * gain })
  }
  return out
}

describe('estimateLag', () => {
  it('finds the delay the readings arrived with', () => {
    const source = peaks()
    for (const lag of [0, 0.09, 0.4, 1.28]) {
      expect(estimateLag(readingsFor(source, lag), source).lag).toBeCloseTo(lag, 1)
    }
  })

  it('is unmoved by the gain, since only the shape is compared', () => {
    const source = peaks()
    const quiet = estimateLag(readingsFor(source, 0.5, 0.05), source)
    const loud = estimateLag(readingsFor(source, 0.5, 8), source)
    expect(quiet.lag).toBeCloseTo(0.5, 1)
    expect(loud.lag).toBeCloseTo(0.5, 1)
  })

  it('scores a real match far above a wrong one', () => {
    const source = peaks()
    const readings = readingsFor(source, 0.3)
    expect(estimateLag(readings, source).score).toBeGreaterThan(0.9)
  })

  it('reports no confidence when there is nothing to match', () => {
    const silence = new Uint8Array(20 * PEAKS_PER_SECOND)
    const readings = readingsFor(peaks(), 0.3)
    expect(estimateLag(readings, silence).score).toBe(-1)
  })

  it('refuses to guess from a handful of readings', () => {
    const source = peaks()
    expect(estimateLag(readingsFor(source, 0.3).slice(0, 5), source).score).toBe(-1)
  })
})
