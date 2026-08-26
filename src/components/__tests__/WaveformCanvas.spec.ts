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
  for (const method of ['beginPath', 'closePath', 'roundRect', 'setTransform', 'clearRect', 'moveTo', 'lineTo', 'rect', 'clip', 'save', 'restore'])
    Object.assign(ctx, { [method]: record(method) })
  // colour matters for these three, so capture the style that was active
  Object.assign(ctx, {
    fillRect: (...a: unknown[]) => void calls.push(['fillRect', ...a, ctx.fillStyle]),
    stroke: () => void calls.push(['stroke', ctx.strokeStyle, ctx.lineWidth]),
    fill: () => void calls.push(['fill', ctx.fillStyle]),
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
/** the wave silhouette is everything up to the first fill; its first half is the top edge */
const wavePoints = () => {
  const end = ctx.calls.findIndex((c) => c[0] === 'fill')
  const start = ctx.calls.slice(0, end).map((c) => c[0]).lastIndexOf('beginPath')
  return ctx.calls
    .slice(start, end)
    .filter((c) => c[0] === 'lineTo')
    .map((c) => ({ x: c[1] as number, y: c[2] as number }))
}
const topEdge = () => wavePoints().slice(0, wavePoints().length / 2)

describe('WaveformCanvas drawing', () => {
  it('sizes the backing store to the element times the device pixel ratio', async () => {
    const canvas = (await render()).find('canvas').element as HTMLCanvasElement
    expect([canvas.width, canvas.height]).toEqual([WIDTH * (window.devicePixelRatio || 1), HEIGHT * (window.devicePixelRatio || 1)])
  })

  it('draws the wave as one closed silhouette, a point per pixel column', async () => {
    await render()
    // the top edge runs left to right, the bottom edge back again
    expect(wavePoints()).toHaveLength(WIDTH * 2)
    expect(callsOf('closePath')).not.toHaveLength(0)
    // a 255 peak reaches the top of the canvas
    expect(topEdge()[0].y).toBe(0)
  })

  it('scales the envelope by the peak amplitude', async () => {
    const peaks = fullPeaks()
    peaks.fill(128, 0, 100) // first second at half amplitude
    await render({ peaks })
    const top = topEdge()
    expect(top[0].y).toBeCloseTo(HEIGHT / 2 - (128 / 255) * (HEIGHT / 2), 0)
    expect(top[500].y).toBe(0)
  })

  it('mirrors the envelope around the centre line', async () => {
    const peaks = fullPeaks()
    peaks.fill(128, 0, 100)
    await render({ peaks })
    const points = wavePoints()
    const [first, last] = [points[0], points[points.length - 1]]
    expect(first.x).toBe(last.x) // same column
    expect(first.y + last.y).toBeCloseTo(HEIGHT, 6)
  })

  it('draws a zero line across the middle, under the wave', async () => {
    await render()
    const zeroLine = ctx.calls.findIndex((c) => c[0] === 'stroke' && c[1] === '#333')
    const points = ctx.calls.slice(0, zeroLine).filter((c) => c[0] === 'moveTo' || c[0] === 'lineTo')
    expect(points.slice(-2)).toEqual([
      ['moveTo', 0, HEIGHT / 2 + 0.5],
      ['lineTo', WIDTH, HEIGHT / 2 + 0.5],
    ])
    expect(zeroLine).toBeLessThan(ctx.calls.findIndex((c) => c[0] === 'fill')) // before the wave
  })

  it('places the playhead at the position, in red', async () => {
    await render({ position: 2.5 })
    const line = ctx.calls.filter((c) => c[0] === 'moveTo' || c[0] === 'stroke')
    const playhead = line.findIndex((c) => c[0] === 'stroke' && c[1] === '#e53935')
    expect(line[playhead - 1]).toEqual(['moveTo', 250, 0])
  })

  const dbLabels = () => callsOf('fillText').map((c) => c[1] as string).filter((l) => /^-?\d+$/.test(l))
  // marker numbers are the white ones; the rules are drawn in the dimmer grid colour
  const markerLabels = () => callsOf('fillText').filter((c) => c[4] === '#fff').map((c) => c[1] as string)

  it('fills the A-B region and redraws the wave clipped to it in orange', async () => {
    await render({ loopA: 2, loopB: 4 })
    const region = callsOf('fillRect').find((c) => c[5] === 'rgba(245, 158, 11, 0.35)')
    expect(region!.slice(1)).toEqual([200, 0, 200, HEIGHT, 'rgba(245, 158, 11, 0.35)'])
    // clipped rather than re-ranged, so the orange wave lines up exactly with the region
    expect(callsOf('rect')[0].slice(1)).toEqual([200, 0, 200, HEIGHT])
    expect(callsOf('clip')).toHaveLength(1)
  })

  it('numbers markers in order and skips ones scrolled out of view', async () => {
    await render({ markers: [1, 5], start: 4, end: 10 })
    expect(markerLabels()).toEqual(['2']) // marker 1 is left of the window
  })

  it('rules the view on round times, closer together as it zooms in', async () => {
    const timeLabels = () => callsOf('fillText').map((c) => c[1] as string).filter((l) => l.includes(':'))

    await render({ start: 0, end: 10 })
    expect(timeLabels()).toEqual(['0:00', '0:01', '0:02', '0:03', '0:04', '0:05', '0:06', '0:07', '0:08', '0:09', '0:10'])

    ctx = recordingContext()
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never
    // zoomed right in, whole seconds would give one rule, so it steps down to tenths
    await render({ start: 4, end: 5 })
    expect(timeLabels()).toContain('0:04.5')
  })

  it('rules the view at fixed dB levels, placed by amplitude', async () => {
    await render({})
    expect(dbLabels()).toEqual(['0', '-3', '-6', '-12', '-18', '-24'])

    // -6 dB is half amplitude, so its line sits a quarter of the height from the middle
    const y = callsOf('moveTo').find((c) => Math.abs((c[2] as number) - HEIGHT / 4) < 1)
    expect(y).toBeTruthy()
  })

  it('turns markers inside the A-B region orange', async () => {
    await render({ markers: [1, 3], loopA: 2, loopB: 4 })
    const strokes = callsOf('stroke').map((c) => c[1])
    expect(strokes).toContain('#4a90d9') // marker at 1s, outside the loop
    expect(strokes).toContain('#f59e0b') // marker at 3s, inside it
  })

  describe('scrolling', () => {
    const SPP = 10 / WIDTH
    const edgeAt = async (start: number) => {
      ctx = recordingContext()
      HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never
      await render({ start, end: start + 10, position: start + 5 })
      return topEdge()
    }

    // shape frozen: a column keeps sampling the same audio however far the view scrolled,
    // so the silhouette never re-forms under the reader (that was the flicker)
    it('keeps the same heights for a sub-pixel scroll', async () => {
      const [before, after] = [await edgeAt(2), await edgeAt(2 + SPP * 0.3)]
      expect(after.map((p) => p.y)).toEqual(before.map((p) => p.y))
    })

    // ...but slides: the same heights are drawn a fraction of a pixel further along
    it('moves the shape by the fraction of a pixel it scrolled', async () => {
      const [before, after] = [await edgeAt(2), await edgeAt(2 + SPP * 0.3)]
      expect(after[10].x).toBeCloseTo(before[10].x - 0.3, 6)
    })

    it('rolls onto the next column once a whole pixel has passed', async () => {
      const [before, after] = [await edgeAt(2), await edgeAt(2 + SPP)]
      expect(after.slice(0, 50).map((p) => p.y)).toEqual(before.slice(1, 51).map((p) => p.y))
      expect(after[10].x).toBeCloseTo(before[10].x, 6) // back in step with the pixel grid
    })

    it('leaves the area outside the track empty', async () => {
      // the zoomed view can sit before 0:00 when the playhead is at the very start
      await render({ start: -5, end: 5, position: 0 })
      expect(topEdge().length).toBeCloseTo(WIDTH / 2, -1) // only the half that overlaps
    })
  })

  it('uses the warm palette for the overview strip', async () => {
    await render({ overview: true })
    expect(callsOf('fill')[0][1]).toBe('#e8bd6d')
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

  it('zooms the window on wheel', async () => {
    const wrapper = await render({ start: 0, end: 10 })
    await wrapper.find('.waveform').trigger('wheel', { deltaY: -100 })
    expect(wrapper.emitted('zoom')![0][0] as number).toBeCloseTo(10 / 1.2, 3)
    await wrapper.find('.waveform').trigger('wheel', { deltaY: 100 })
    expect(wrapper.emitted('zoom')![1][0] as number).toBeCloseTo(10 * 1.2, 3)
  })

  it('ignores the wheel on the overview strip', async () => {
    const wrapper = await render({ overview: true })
    await wrapper.find('.waveform').trigger('wheel', { deltaY: -100 })
    expect(wrapper.emitted('zoom')).toBeUndefined()
  })

  describe('dragging the zoomed view', () => {
    const move = (wrapper: ReturnType<typeof mount>, clientX: number) =>
      wrapper.find('.waveform').trigger('pointermove', { clientX, clientY: HEIGHT / 2, pointerId: 1 })
    const up = (wrapper: ReturnType<typeof mount>, clientX: number) =>
      wrapper.find('.waveform').trigger('pointerup', { clientX, clientY: HEIGHT / 2, pointerId: 1 })

    it('scrubs backwards when the wave is dragged to the right', async () => {
      const wrapper = await render({ draggable: true, position: 5, start: 0, end: 10 })
      await down(wrapper, 500)
      await move(wrapper, 600) // 100px right = 1s of a 10s window
      expect(wrapper.emitted('seek')!.at(-1)).toEqual([4])
    })

    it('scrubs forwards when dragged to the left', async () => {
      const wrapper = await render({ draggable: true, position: 5, start: 0, end: 10 })
      await down(wrapper, 500)
      await move(wrapper, 400)
      expect(wrapper.emitted('seek')!.at(-1)).toEqual([6])
    })

    it('does not seek on press alone, so a drag starts from where it was', async () => {
      const wrapper = await render({ draggable: true, position: 5, start: 0, end: 10 })
      await down(wrapper, 300)
      expect(wrapper.emitted('seek')).toBeUndefined()
    })

    it('ignores jitter below the tap threshold', async () => {
      const wrapper = await render({ draggable: true, position: 5, start: 0, end: 10 })
      await down(wrapper, 500)
      await move(wrapper, 502)
      expect(wrapper.emitted('seek')).toBeUndefined()
    })

    it('treats a press that never moved as a tap and seeks there', async () => {
      const wrapper = await render({ draggable: true, position: 5, start: 0, end: 10 })
      await down(wrapper, 300)
      await up(wrapper, 300)
      expect(wrapper.emitted('seek')!.at(-1)).toEqual([3])
    })

    it('clamps a drag past the start of the track', async () => {
      const wrapper = await render({ draggable: true, position: 1, start: -4, end: 6 })
      await down(wrapper, 500)
      await move(wrapper, 900) // would be -3s
      expect(wrapper.emitted('seek')!.at(-1)).toEqual([0])
    })

    it('still grabs a marker flag rather than panning', async () => {
      const wrapper = await render({ draggable: true, markers: [5], position: 5, start: 0, end: 10 })
      await down(wrapper, 505, 10)
      expect(wrapper.emitted('moveMarker')![0]).toEqual([0, 5.05])
    })
  })

  it('always seeks on the overview strip, even on top of a flag', async () => {
    const wrapper = await render({ overview: true, markers: [5] })
    await down(wrapper, 505, 10)
    expect(wrapper.emitted('moveMarker')).toBeUndefined()
    expect(wrapper.emitted('seek')![0]).toEqual([5.05])
  })
})

describe('WaveformCanvas level monitoring', () => {
  /** the points of each path that was stroked in the given colour */
  const strokedPaths = (color: string) => {
    const paths: { x: number; y: number }[][] = []
    let current: { x: number; y: number }[] = []
    for (const [name, ...args] of ctx.calls) {
      if (name === 'beginPath') current = []
      else if (name === 'moveTo' || name === 'lineTo') current.push({ x: args[0] as number, y: args[1] as number })
      else if (name === 'stroke' && args[0] === color) paths.push(current)
    }
    return paths
  }
  const filled = (color: string) => ctx.calls.filter((c) => c[0] === 'fill' && c[1] === color).length

  it('draws none of the monitoring layers until it is switched on', async () => {
    await render({ gainDb: 6 })
    expect(filled('#ff6b3d')).toBe(0)
    expect(strokedPaths('#5ad07a')).toHaveLength(0)
  })

  it('draws the gain as a stretch of the source, with no playing needed', async () => {
    await render({ monitor: true, gainDb: 6, headroomDb: 6 })
    expect(filled('#ff6b3d')).toBe(1)

    // +6 dB is twice the amplitude, and 6 dB of headroom puts that at the very edge
    const boosted = ctx.calls.filter((c) => c[0] === 'lineTo').map((c) => c[2] as number)
    expect(Math.min(...boosted)).toBe(0)
  })

  it('keeps a cut gain on top, where the smaller shape can still be seen', async () => {
    const order = async (gainDb: number) => {
      // a fresh recorder, so the previous render's calls are not counted twice
      ctx = recordingContext()
      HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never
      await render({ monitor: true, gainDb })
      return ctx.calls.filter((c) => c[0] === 'fill').map((c) => c[1])
    }
    expect((await order(6)).slice(0, 2)).toEqual(['#ff6b3d', '#dcdcdc'])
    expect((await order(-6)).slice(0, 2)).toEqual(['#dcdcdc', '#ff6b3d'])
  })

  it('leaves headroom above 0 dBFS so what is driven past it stays visible', async () => {
    await render({ monitor: true, headroomDb: 6 })
    // with 6 dB of headroom, 0 dBFS sits half way up rather than on the edge
    const zero = callsOf('fillText').find((c) => c[1] === '0')
    expect(Math.round(zero![3] as number)).toBe(HEIGHT / 4 + 11)
  })

  it('rules the ceiling the limiter holds to, and nothing when it is passing through', async () => {
    await render({ monitor: true, headroomDb: 6 })
    expect(strokedPaths('#5ad07a')).toHaveLength(0) // no ceiling given, so nothing is being held

    await render({ monitor: true, headroomDb: 6, ceilingDb: -1 })
    const ys = strokedPaths('#5ad07a').map((p) => p[0].y).sort((a, b) => a - b)
    // -1 dBFS, one rule either side of the middle
    expect(ys[0]).toBeGreaterThan(0)
    expect(ys[0]).toBeLessThan(HEIGHT / 2)
    expect(ys[1]).toBeCloseTo(HEIGHT - ys[0], 0)
  })

  it('hangs the gain reduction curve from the top edge', async () => {
    const reductionTrail = new Float32Array(DURATION * 100)
    reductionTrail.fill(12, 0, DURATION * 50) // 12 dB of limiting over the first half
    await render({ monitor: true, reductionTrail })
    const [curve] = strokedPaths('#f2f2f2')
    // half of the 24 dB range, so half way down the top half
    expect(curve[0].y).toBeCloseTo(HEIGHT / 4, 0)
    expect(curve.at(-1)!.y).toBe(0) // nothing measured yet in the second half
  })

  it('strokes the measured output in its own colour', async () => {
    const outTrail = new Float32Array(DURATION * 100).fill(0.5)
    await render({ monitor: true, outTrail })
    expect(strokedPaths('#3ddc84').length).toBeGreaterThan(0)
  })

  it('names the gain it is drawing in the legend', async () => {
    await render({ monitor: true, gainDb: 6, reduction: -6.25 })
    const labels = callsOf('fillText').map((c) => c[1])
    expect(labels).toContain('after gain (+6.0 dB)')
    expect(labels).toContain('output')
    expect(labels).toContain('-6.3 dB limiting')
  })

  it('reads as no limiting when the reduction is only dither', async () => {
    await render({ monitor: true, reduction: -0.0001 })
    expect(callsOf('fillText').map((c) => c[1])).toContain('0.0 dB limiting')
  })
})
