import { computePeaks, peakIndex, peakTime } from '@/helpers/audioPeaks'
import { describe, expect, it } from 'vitest'

const fakeBuffer = (channels: number[][], sampleRate = 100) => ({
  numberOfChannels: channels.length,
  length: channels[0].length,
  sampleRate,
  getChannelData: (i: number) => Float32Array.from(channels[i]),
})

describe('computePeaks', () => {
  it('produces one byte per bucket, scaled to 0..255', () => {
    // 100Hz "audio", 10 buckets/sec => 10 samples per bucket
    const samples = [...Array(20)].map((_, i) => (i < 10 ? 1 : 0.5))
    expect(Array.from(computePeaks(fakeBuffer([samples]), 10))).toEqual([255, 128])
  })

  it('takes the loudest channel', () => {
    expect(Array.from(computePeaks(fakeBuffer([[0.1], [0.8]]), 100))).toEqual([204])
  })

  it('uses absolute amplitude so negative half-waves count', () => {
    expect(Array.from(computePeaks(fakeBuffer([[-1, 0]]), 50))).toEqual([255])
  })

  it('keeps a partial trailing bucket', () => {
    expect(computePeaks(fakeBuffer([[...Array(15)].map(() => 1)]), 10)).toHaveLength(2)
  })

  it('sizes to roughly perSecond bytes per second of audio', () => {
    const oneSecond = [...Array(44100)].map(() => 0)
    expect(computePeaks(fakeBuffer([oneSecond], 44100), 100)).toHaveLength(100)
  })
})

describe('peak index/time', () => {
  it('round-trips', () => {
    expect(peakTime(peakIndex(12.34))).toBeCloseTo(12.34)
  })
})
