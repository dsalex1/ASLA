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
  }>(),
  { loopA: null, loopB: null }
)

const emit = defineEmits<{
  (e: 'seek', seconds: number): void
  (e: 'moveMarker', index: number, seconds: number): void
  (e: 'moveLoop', which: 'a' | 'b', seconds: number): void
  (e: 'window', start: number, end: number): void
}>()

const COLORS = {
  background: '#050505',
  wave: '#dcdcdc',
  waveOverview: '#e8bd6d',
  loop: '#f59e0b',
  loopFill: 'rgba(245, 158, 11, 0.35)',
  marker: '#4a90d9',
  playhead: '#e53935',
  handle: '#b3a086',
}

const FLAG_W = 26
const FLAG_H = 26
const HANDLE_W = 30
const HANDLE_H = 60

const wrapper = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const { width, height } = useElementSize(wrapper)

const span = computed(() => Math.max(props.end - props.start, 0.05))
const xOf = (seconds: number) => ((seconds - props.start) / span.value) * width.value
const timeOf = (x: number) => props.start + (x / Math.max(width.value, 1)) * span.value
const clampTime = (t: number) => Math.max(0, Math.min(t, props.duration))

/** loudest peak between two times, 0..1 */
function peakBetween(from: number, to: number) {
  const first = Math.max(0, Math.floor(from * PEAKS_PER_SECOND))
  const last = Math.min(props.peaks.length - 1, Math.max(first, Math.ceil(to * PEAKS_PER_SECOND) - 1))
  let peak = 0
  for (let i = first; i <= last; i++) if (props.peaks[i] > peak) peak = props.peaks[i]
  return peak / 255
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

function drawWave(ctx: CanvasRenderingContext2D, color: string, from: number, to: number) {
  const mid = height.value / 2
  ctx.fillStyle = color
  for (let x = Math.max(0, Math.floor(from)); x < Math.min(width.value, Math.ceil(to)); x++) {
    const amplitude = peakBetween(timeOf(x), timeOf(x + 1)) * mid
    ctx.fillRect(x, mid - amplitude, 1, Math.max(amplitude * 2, 1))
  }
}

function draw() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx || !width.value || !height.value) return

  const dpr = window.devicePixelRatio || 1
  canvas.value!.width = width.value * dpr
  canvas.value!.height = height.value * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  ctx.fillStyle = COLORS.background
  ctx.fillRect(0, 0, width.value, height.value)

  const waveColor = props.overview ? COLORS.waveOverview : COLORS.wave
  drawWave(ctx, waveColor, 0, width.value)

  // A-B repeat region, drawn over the wave so the looped part reads as one block
  const { loopA, loopB } = props
  if (loopA != null && loopB != null) {
    const [left, right] = [xOf(loopA), xOf(loopB)]
    ctx.fillStyle = COLORS.loopFill
    ctx.fillRect(left, 0, right - left, height.value)
    drawWave(ctx, COLORS.loop, left, right)
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
type Drag = { kind: 'seek' } | { kind: 'marker'; index: number } | { kind: 'loop'; which: 'a' | 'b' }
let drag: Drag | null = null
const pointers = new Map<number, number>() // pointerId -> x
let pinchStart: { distance: number; start: number; end: number } | null = null

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
  return { kind: 'seek' }
}

function applyDrag(x: number) {
  const seconds = clampTime(timeOf(x))
  if (drag?.kind === 'seek') emit('seek', seconds)
  if (drag?.kind === 'marker') emit('moveMarker', drag.index, seconds)
  if (drag?.kind === 'loop') emit('moveLoop', drag.which, seconds)
}

function onPointerDown(e: PointerEvent) {
  ;(e.target as Element).setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, e.clientX)
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinchStart = { distance: Math.abs(a - b), start: props.start, end: props.end }
    drag = null
    return
  }
  const rect = wrapper.value!.getBoundingClientRect()
  drag = hitTest(localX(e), e.clientY - rect.top)
  applyDrag(localX(e))
}

function onPointerMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, e.clientX)
  if (pinchStart && pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    const factor = pinchStart.distance / Math.max(Math.abs(a - b), 1)
    const centre = (pinchStart.start + pinchStart.end) / 2
    zoomTo(centre, (pinchStart.end - pinchStart.start) * factor)
    return
  }
  if (drag) applyDrag(localX(e))
}

function onPointerUp(e: PointerEvent) {
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinchStart = null
  if (pointers.size === 0) drag = null
}

function zoomTo(centre: number, newSpan: number) {
  const clamped = Math.max(2, Math.min(newSpan, props.duration))
  let start = centre - clamped / 2
  start = Math.max(0, Math.min(start, props.duration - clamped))
  emit('window', start, start + clamped)
}

function onWheel(e: WheelEvent) {
  if (props.overview) return
  e.preventDefault()
  const centre = timeOf(e.clientX - (wrapper.value?.getBoundingClientRect().left ?? 0))
  zoomTo(centre, span.value * (e.deltaY > 0 ? 1.2 : 1 / 1.2))
}

defineExpose({ zoomTo })
</script>

<template>
  <div
    ref="wrapper"
    class="waveform"
    :style="{ touchAction: overview ? 'none' : 'pan-y' }"
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
