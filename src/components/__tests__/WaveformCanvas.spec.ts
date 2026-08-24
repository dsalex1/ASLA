import WaveformCanvas from '@/components/WaveformCanvas.vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const WIDTH = 1000
const HEIGHT = 200

vi.mock('@vueuse/core', async (original) => ({
  ...(await original<typeof import('@vueuse/core')>()),
  useElementSize: () => ({ width: ref(WIDTH), height: ref(HEIGHT) }),
}))

type Call = [string, ...unknown[]]

function recordingContext() {
  const calls: Call[] = []
  const ctx = {
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D & { calls: Call[] }
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      void calls.push([name, ...args])
  for (const method of ['beginPath', 'closePath', 'fill', 'roundRect', 'setTransform', 'clearRect', 'moveTo', 'lineTo'])
    Object.assign(ctx, { [method]: record(method) })
  // colour matters for these three, so capture the style that was active
  Object.assign(ctx, {
    fillRect: (...a: unknown[]) => void calls.push(['fillRect', ...a, ctx.fillStyle]),
    stroke: () => void calls.push(['stroke', ctx.strokeStyle, ctx.lineWidth]),
    fillText: (...a: unknown[]) => void calls.push(['fillText', ...a, ctx.fillStyle]),
  })
  return ctx
}

let ctx: ReturnType<typeof recordingContext>

beforeEach(() => {
  ctx = recordingContext()
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => (cb(0), 1))
})

const DURATION = 10
const fullPeaks = () => new Uint8Array(DURATION * 100).fill(255)

const render = async (over: Record<string, unknown> = {}) => {
  const wrapper = mount(WaveformCanvas, {
    props: {
      peaks: fullPeaks(),
      duration: DURATION,
      start: 0,
      end: DURATION,
      markers: [],
      position: 0,
      ...over,
    },
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

const callsOf = (name: string) => ctx.calls.filter((c) => c[0] === name)

describe('WaveformCanvas drawing', () => {
  it('sizes the backing store to the element times the device pixel ratio', async () => {
    const canvas = (await render()).find('canvas').element as HTMLCanvasElement
    expect([canvas.width, canvas.height]).toEqual([WIDTH * (window.devicePixelRatio || 1), HEIGHT * (window.devicePixelRatio || 1)])
  })

  it('draws one mirrored bar per pixel column, full height at full amplitude', async () => {
    await render()
    const bars = callsOf('fillRect').filter((c) => c[3] === 1) // width-1 columns
    expect(bars).toHaveLength(WIDTH)
    // a 255 peak fills the whole height, centred
    expect(bars[0].slice(1, 5)).toEqual([0, 0, 1, HEIGHT])
  })

  it('scales bar height by the peak amplitude', async () => {
    const peaks = fullPeaks()
    peaks.fill(128, 0, 100) // first second at half amplitude
    await render({ peaks })
    const bars = callsOf('fillRect').filter((c) => c[3] === 1)
    expect(bars[0][4]).toBeCloseTo((128 / 255) * HEIGHT, 0)
    expect(bars[500][4]).toBe(HEIGHT)
  })

  it('places the playhead at the position, in red', async () => {
    await render({ position: 2.5 })
    const line = ctx.calls.filter((c) => c[0] === 'moveTo' || c[0] === 'stroke')
    const playhead = line.findIndex((c) => c[0] === 'stroke' && c[1] === '#e53935')
    expect(line[playhead - 1]).toEqual(['moveTo', 250, 0])
  })

  it('fills the A-B region and redraws the wave inside it in orange', async () => {
    await render({ loopA: 2, loopB: 4 })
    const region = callsOf('fillRect').find((c) => c[5] === 'rgba(245, 158, 11, 0.35)')
    expect(region!.slice(1)).toEqual([200, 0, 200, HEIGHT, 'rgba(245, 158, 11, 0.35)'])
    const orangeBars = callsOf('fillRect').filter((c) => c[3] === 1 && c[5] === '#f59e0b')
    expect(orangeBars).toHaveLength(200)
  })

  it('numbers markers in order and skips ones scrolled out of view', async () => {
    await render({ markers: [1, 5], start: 4, end: 10 })
    const labels = callsOf('fillText').map((c) => c[1])
    expect(labels).toEqual(['2']) // marker 1 is left of the window
  })

  it('turns markers inside the A-B region orange', async () => {
    await render({ markers: [1, 3], loopA: 2, loopB: 4 })
    const strokes = callsOf('stroke').map((c) => c[1])
    expect(strokes).toContain('#4a90d9') // marker at 1s, outside the loop
    expect(strokes).toContain('#f59e0b') // marker at 3s, inside it
  })

  it('uses the warm palette for the overview strip', async () => {
    await render({ overview: true })
    expect(callsOf('fillRect').filter((c) => c[3] === 1)[0][5]).toBe('#e8bd6d')
  })
})

describe('WaveformCanvas interaction', () => {
  const down = (wrapper: ReturnType<typeof mount>, clientX: number, clientY = HEIGHT / 2) =>
    wrapper.find('.waveform').trigger('pointerdown', { clientX, clientY, pointerId: 1 })

  beforeEach(() => {
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.getBoundingClientRect = vi.fn(() => ({ left: 0, top: 0, width: WIDTH, height: HEIGHT }) as DOMRect)
  })

  it('seeks to the pressed time', async () => {
    const wrapper = await render()
    await down(wrapper, 300)
    expect(wrapper.emitted('seek')![0]).toEqual([3])
  })

  it('drags a marker when its flag is pressed', async () => {
    const wrapper = await render({ markers: [1, 5] })
    await down(wrapper, 505, 10) // inside the flag of marker 2 (x 500..526, y 4..30)
    expect(wrapper.emitted('moveMarker')![0]).toEqual([1, 5.05])
  })

  it('drags the A handle when its box is pressed', async () => {
    const wrapper = await render({ loopA: 4, loopB: 8 })
    await down(wrapper, 385, HEIGHT * 0.55) // the A box sits to the left of x=400
    expect(wrapper.emitted('moveLoop')![0]).toEqual(['a', 3.85])
  })

  it('zooms around the cursor on wheel, and never past the track bounds', async () => {
    const wrapper = await render({ start: 0, end: 10 })
    await wrapper.find('.waveform').trigger('wheel', { clientX: 500, deltaY: -100 })
    const [start, end] = wrapper.emitted('window')![0] as number[]
    expect(end - start).toBeCloseTo(10 / 1.2, 3)
    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeLessThanOrEqual(10)
  })

  it('ignores the wheel on the overview strip', async () => {
    const wrapper = await render({ overview: true })
    await wrapper.find('.waveform').trigger('wheel', { clientX: 500, deltaY: -100 })
    expect(wrapper.emitted('window')).toBeUndefined()
  })

  it('always seeks on the overview strip, even on top of a flag', async () => {
    const wrapper = await render({ overview: true, markers: [5] })
    await down(wrapper, 505, 10)
    expect(wrapper.emitted('moveMarker')).toBeUndefined()
    expect(wrapper.emitted('seek')![0]).toEqual([5.05])
  })
})
