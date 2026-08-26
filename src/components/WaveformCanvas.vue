<script setup lang="ts">
import { PEAKS_PER_SECOND } from '@/helpers/audioPeaks'
import { useElementSize } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    peaks: Uint8Array
    duration: number
    start: number
    end: number
    markers: number[]
    loopA?: number | null
    loopB?: number | null
    position: number
    /** the compact whole-track strip: no flags to grab, tap anywhere to seek */
    overview?: boolean
    /** the zoomed view: the wave is dragged under a fixed centre playhead */
    draggable?: boolean
  }>(),
  { loopA: null, loopB: null }
)

const emit = defineEmits<{
  (e: 'seek', seconds: number): void
  (e: 'moveMarker', index: number, seconds: number): void
  (e: 'moveLoop', which: 'a' | 'b', seconds: number): void
  (e: 'zoom', span: number): void
}>()

const COLORS = {
  background: '#050505',
  wave: '#dcdcdc',
  waveOverview: '#e8bd6d',
  loop: '#f59e0b',
  loopFill: 'rgba(245, 158, 11, 0.35)',
  zeroLine: '#333',
  marker: '#4a90d9',
  playhead: '#e53935',
  handle: '#b3a086',
  grid: 'rgba(255, 255, 255, 0.13)',
  gridLabel: 'rgba(255, 255, 255, 0.4)',
}

// the wave is drawn on a linear amplitude scale, so a dB line sits at its amplitude ratio
const DB_LINES = [-3, -6, -12, -18, -24]
const amplitudeOf = (db: number) => 10 ** (db / 20)

const FLAG_W = 26
const FLAG_H = 26
const HANDLE_W = 30
const HANDLE_H = 60

const wrapper = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const { width, height } = useElementSize(wrapper)

const span = computed(() => Math.max(props.end - props.start, 0.05))
const secondsPerPixel = computed(() => span.value / Math.max(width.value, 1))

// The wave is sampled on a grid fixed to the track, not to the canvas, so a column always
// covers the same slice of audio however far the view has scrolled — that keeps the shape
// frozen. The leftover sub-pixel remainder is applied as an offset when drawing, so the
// shape slides smoothly instead of stepping from pixel to pixel.
const gridIndex = computed(() => Math.floor(props.start / secondsPerPixel.value + 1e-9))
const subPixel = computed(() => props.start / secondsPerPixel.value - gridIndex.value)
const columnTime = (column: number) => (gridIndex.value + column) * secondsPerPixel.value

const xOf = (seconds: number) => (seconds - props.start) / secondsPerPixel.value
const timeOf = (x: number) => props.start + x * secondsPerPixel.value
const clampTime = (t: number) => Math.max(0, Math.min(t, props.duration))

/** loudest peak between two times, 0..1 */
function peakBetween(from: number, to: number) {
  const first = Math.max(0, Math.floor(from * PEAKS_PER_SECOND))
  const last = Math.min(props.peaks.length - 1, Math.max(first, Math.ceil(to * PEAKS_PER_SECOND) - 1))
  let peak = 0
  for (let i = first; i <= last; i++) if (props.peaks[i] > peak) peak = props.peaks[i]
  return peak / 255
}

/**
 * Horizontal rules at fixed dBFS levels so a peak can be read as a number rather than
 * eyeballed. Drawn over the wave, faint enough not to fight it: the point is to see
 * where the wave crosses them.
 */
function drawDbGrid(ctx: CanvasRenderingContext2D) {
  const mid = height.value / 2
  ctx.lineWidth = 1
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  for (const db of [0, ...DB_LINES]) {
    const offset = amplitudeOf(db) * mid
    const top = Math.round(mid - offset) + 0.5
    const bottom = Math.round(mid + offset) - 0.5
    ctx.strokeStyle = COLORS.grid
    ctx.beginPath()
    ctx.moveTo(0, top)
    ctx.lineTo(width.value, top)
    ctx.moveTo(0, bottom)
    ctx.lineTo(width.value, bottom)
    ctx.stroke()
    ctx.fillStyle = COLORS.gridLabel
    // 0 dBFS sits on the canvas edge, so its label has to hang below the line
    ctx.fillText(`${db}`, 2, db === 0 ? top + 10 : top - 1)
  }
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, label: string, active: boolean) {
  const color = active ? COLORS.loop : COLORS.marker
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + 0.5, 0)
  ctx.lineTo(x + 0.5, height.value)
  ctx.stroke()

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, 4)
  ctx.lineTo(x + FLAG_W, 4)
  ctx.lineTo(x + FLAG_W, 4 + FLAG_H)
  ctx.lineTo(x + FLAG_W / 2, 4 + FLAG_H * 0.72)
  ctx.lineTo(x, 4 + FLAG_H)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + FLAG_W / 2, 4 + FLAG_H * 0.42)
}

function drawHandle(ctx: CanvasRenderingContext2D, x: number, label: 'A' | 'B') {
  const top = height.value * 0.55 - HANDLE_H / 2
  const left = label === 'A' ? x - HANDLE_W : x
  ctx.fillStyle = COLORS.handle
  ctx.strokeStyle = COLORS.loop
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(left, top, HANDLE_W, HANDLE_H, 4)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#1a1a1a'
  ctx.font = 'bold 22px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, left + HANDLE_W / 2, top + HANDLE_H / 2)
}

/**
 * One filled silhouette rather than a row of separate bars: a solid shape can be shifted
 * by a fraction of a pixel and still read as the same shape sliding, whereas independent
 * bars each redistribute their own anti-aliasing and shimmer.
 */
function drawWave(ctx: CanvasRenderingContext2D, color: string) {
  const mid = height.value / 2
  const columns: { x: number; amplitude: number }[] = []
  // a column either side of the canvas so the shape does not pop in at the edges
  for (let column = -1; column <= width.value + 1; column++) {
    const at = columnTime(column)
    if (at < 0 || at >= props.duration) continue // the view can extend past either end
    columns.push({ x: column - subPixel.value, amplitude: peakBetween(at, columnTime(column + 1)) * mid })
  }
  if (!columns.length) return

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(columns[0].x, mid - columns[0].amplitude)
  for (const c of columns) ctx.lineTo(c.x, mid - c.amplitude)
  for (let i = columns.length - 1; i >= 0; i--) ctx.lineTo(columns[i].x, mid + columns[i].amplitude)
  ctx.closePath()
  ctx.fill()
}

let backingWidth = 0
let backingHeight = 0

function draw() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx || !width.value || !height.value) return

  const dpr = window.devicePixelRatio || 1
  // resizing clears and reallocates the backing store, so only do it when it really changed
  if (backingWidth !== width.value * dpr || backingHeight !== height.value * dpr) {
    backingWidth = canvas.value!.width = width.value * dpr
    backingHeight = canvas.value!.height = height.value * dpr
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  ctx.fillStyle = COLORS.background
  ctx.fillRect(0, 0, width.value, height.value)

  // zero line, under the wave so it shows through the quiet stretches
  const mid = Math.round(height.value / 2) + 0.5
  ctx.strokeStyle = COLORS.zeroLine
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, mid)
  ctx.lineTo(width.value, mid)
  ctx.stroke()

  drawWave(ctx, props.overview ? COLORS.waveOverview : COLORS.wave)
  if (!props.overview) drawDbGrid(ctx)

  // A-B repeat region, drawn over the wave so the looped part reads as one block
  const { loopA, loopB } = props
  if (loopA != null && loopB != null) {
    const [left, right] = [xOf(loopA), xOf(loopB)]
    ctx.fillStyle = COLORS.loopFill
    ctx.fillRect(left, 0, right - left, height.value)
    ctx.save()
    ctx.beginPath()
    ctx.rect(left, 0, right - left, height.value)
    ctx.clip()
    drawWave(ctx, COLORS.loop)
    ctx.restore()
  }

  props.markers.forEach((seconds, i) => {
    const x = xOf(seconds)
    if (x < -FLAG_W || x > width.value) return
    drawFlag(ctx, x, String(i + 1), isLoopBoundary(seconds))
  })

  if (loopA != null) drawHandle(ctx, xOf(loopA), 'A')
  if (loopB != null) drawHandle(ctx, xOf(loopB), 'B')

  const playX = xOf(props.position)
  ctx.strokeStyle = COLORS.playhead
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(playX, 0)
  ctx.lineTo(playX, height.value)
  ctx.stroke()
}

/** markers sitting on an A-B bound (or inside the loop) turn orange */
function isLoopBoundary(seconds: number) {
  const { loopA, loopB } = props
  if (loopA == null || loopB == null) return false
  return seconds >= loopA && seconds <= loopB
}

let pending = false
function scheduleDraw() {
  if (pending) return
  pending = true
  requestAnimationFrame(() => {
    pending = false
    draw()
  })
}

// the immediate watch below runs before the canvas ref exists, so draw once it does
onMounted(draw)

watch(
  () => [props.peaks, props.start, props.end, props.markers, props.loopA, props.loopB, props.position, width.value, height.value],
  scheduleDraw,
  { immediate: true, deep: true }
)

// --- pointer interaction ---
const TAP_SLOP = 4 // a press that moves less than this is a tap, not a drag

type Drag =
  | { kind: 'seek' }
  | { kind: 'marker'; index: number }
  | { kind: 'loop'; which: 'a' | 'b' }
  | { kind: 'pan'; fromX: number; fromPosition: number; moved: boolean }

let drag: Drag | null = null
const pointers = new Map<number, number>() // pointerId -> x
let pinchStart: { distance: number; span: number } | null = null

function localX(e: PointerEvent) {
  return e.clientX - (wrapper.value?.getBoundingClientRect().left ?? 0)
}

function hitTest(x: number, y: number): Drag {
  if (props.overview) return { kind: 'seek' }
  const handleTop = height.value * 0.55 - HANDLE_H / 2
  if (y >= handleTop && y <= handleTop + HANDLE_H) {
    if (props.loopA != null && Math.abs(x - (xOf(props.loopA) - HANDLE_W / 2)) < HANDLE_W / 2) return { kind: 'loop', which: 'a' }
    if (props.loopB != null && Math.abs(x - (xOf(props.loopB) + HANDLE_W / 2)) < HANDLE_W / 2) return { kind: 'loop', which: 'b' }
  }
  if (y <= 4 + FLAG_H) {
    const index = props.markers.findIndex((m) => x >= xOf(m) && x <= xOf(m) + FLAG_W)
    if (index >= 0) return { kind: 'marker', index }
  }
  // on the zoomed view an empty press drags the wave under the centre playhead
  return props.draggable ? { kind: 'pan', fromX: x, fromPosition: props.position, moved: false } : { kind: 'seek' }
}

function applyDrag(x: number) {
  if (!drag) return
  if (drag.kind === 'pan') {
    const travelled = x - drag.fromX
    if (Math.abs(travelled) > TAP_SLOP) drag.moved = true
    if (drag.moved) emit('seek', clampTime(drag.fromPosition - travelled * secondsPerPixel.value))
    return
  }
  const seconds = clampTime(timeOf(x))
  if (drag.kind === 'seek') emit('seek', seconds)
  if (drag.kind === 'marker') emit('moveMarker', drag.index, seconds)
  if (drag.kind === 'loop') emit('moveLoop', drag.which, seconds)
}

function onPointerDown(e: PointerEvent) {
  // capture is a nicety; a browser that refuses it must not lose the whole gesture
  try {
    ;(e.target as Element).setPointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  pointers.set(e.pointerId, e.clientX)
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinchStart = { distance: Math.abs(a - b), span: span.value }
    drag = null
    return
  }
  const rect = wrapper.value!.getBoundingClientRect()
  drag = hitTest(localX(e), e.clientY - rect.top)
  if (drag.kind !== 'pan') applyDrag(localX(e)) // a pan only acts once it actually moves
}

function onPointerMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, e.clientX)
  if (pinchStart && pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    emit('zoom', (pinchStart.span * pinchStart.distance) / Math.max(Math.abs(a - b), 1))
    return
  }
  if (drag) applyDrag(localX(e))
}

function onPointerUp(e: PointerEvent) {
  // a press that never moved is a tap: jump to the spot it landed on
  if (drag?.kind === 'pan' && !drag.moved) emit('seek', clampTime(timeOf(localX(e))))
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinchStart = null
  if (pointers.size === 0) drag = null
}

function onWheel(e: WheelEvent) {
  if (props.overview) return
  e.preventDefault()
  emit('zoom', span.value * (e.deltaY > 0 ? 1.2 : 1 / 1.2))
}
</script>

<template>
  <div
    ref="wrapper"
    class="waveform"
    :style="{ touchAction: overview || draggable ? 'none' : 'pan-y' }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel="onWheel"
  >
    <canvas ref="canvas" style="display: block; width: 100%; height: 100%" />
  </div>
</template>

<style scoped>
.waveform {
  width: 100%;
  height: 100%;
  background: #050505;
  overflow: hidden;
  user-select: none;
}
</style>
