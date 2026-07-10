<script setup lang="ts">
import { PageAnnotations, Stroke, StrokeOp } from '@/helpers/inkAnnotations'
import * as pdfjsLib from 'pdfjs-dist'
import { computed, ref, shallowRef, watch, watchEffect } from 'vue'

const props = defineProps<{
  bytes: Uint8Array
  page: number // 1-based
  pages: PageAnnotations[] // mutated in place when drawing/erasing
  displayHeight: number
  boxWidth: number // available screen area — the editor fills it so zooming can too
  boxHeight: number
  tool: 'pen' | 'eraser'
  gray: number
  strokeWidth: number
}>()

const emit = defineEmits<{ (e: 'op', op: StrokeOp): void }>()

const root = ref<HTMLDivElement | null>(null)
const bgCanvas = ref<HTMLCanvasElement | null>(null)
const inkCanvas = ref<HTMLCanvasElement | null>(null)

const pageData = computed(() => props.pages[props.page - 1])
// page height at zoom 1: the requested display height, capped to what actually fits the box
const pageHeight = computed(() => Math.min(props.displayHeight, props.boxHeight || props.displayHeight))
const scale = computed(() => pageHeight.value / (pageData.value?.height || 842))
const cssWidth = computed(() => (pageData.value?.width || 595) * scale.value)
const dpr = window.devicePixelRatio || 1

// --- zoom & pan (transform-origin 0 0 on the inner wrapper) ---
const zoom = ref(1)
const tx = ref(0)
const ty = ref(0)
const renderZoom = ref(1) // canvas resolution multiplier, updated when a gesture ends

// per axis: center the page while it fits the box, otherwise clamp panning to its edges
function clampAxis(t: number, content: number, box: number) {
  const scaled = content * zoom.value
  return scaled <= box ? (box - scaled) / 2 : Math.min(0, Math.max(box - scaled, t))
}

function clampTransform() {
  zoom.value = Math.min(8, Math.max(1, zoom.value))
  tx.value = clampAxis(tx.value, cssWidth.value, props.boxWidth)
  ty.value = clampAxis(ty.value, pageHeight.value, props.boxHeight)
}

// zoom towards a point given in the outer (untransformed) frame
function zoomAt(px: number, py: number, newZoom: number) {
  newZoom = Math.min(8, Math.max(1, newZoom))
  tx.value = px - ((px - tx.value) / zoom.value) * newZoom
  ty.value = py - ((py - ty.value) / zoom.value) * newZoom
  zoom.value = newZoom
  clampTransform()
}

function toLocal(e: { clientX: number; clientY: number }) {
  const r = root.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

function onWheel(e: WheelEvent) {
  const p = toLocal(e)
  zoomAt(p.x, p.y, zoom.value * (e.deltaY < 0 ? 1.2 : 1 / 1.2))
  renderZoom.value = Math.min(4, zoom.value)
}

watch(
  [() => props.page, cssWidth, () => props.boxWidth, () => props.boxHeight],
  () => {
    zoom.value = 1
    renderZoom.value = 1
    clampTransform() // centers the page in the box
  },
  { immediate: true }
)

// --- pdf background ---
const pdfDoc = shallowRef<pdfjsLib.PDFDocumentProxy | null>(null)
watch(
  () => props.bytes,
  async (bytes) => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
    // slice: pdf.js transfers the buffer to its worker, which would detach our copy
    pdfDoc.value = await pdfjsLib.getDocument({ data: bytes.slice() }).promise
  },
  { immediate: true }
)

// render pristine page (annotations hidden — the overlay draws them) as background
let renderToken = 0
watchEffect(async () => {
  const doc = pdfDoc.value
  const canvas = bgCanvas.value
  if (!doc || !canvas || !pageData.value) return
  const token = ++renderToken
  const page = await doc.getPage(props.page)
  const viewport = page.getViewport({ scale: scale.value * dpr * renderZoom.value })
  if (token !== renderToken) return
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({
    canvasContext: canvas.getContext('2d')!,
    viewport,
    annotationMode: pdfjsLib.AnnotationMode.DISABLE,
  }).promise
})

// --- stroke drawing ---
const grayToCss = (g: number) => `rgb(${g * 255},${g * 255},${g * 255})`

const currentStroke = ref<Stroke | null>(null)

function drawStrokes() {
  const canvas = inkCanvas.value
  if (!canvas || !pageData.value) return
  const s = scale.value * dpr * renderZoom.value
  canvas.width = cssWidth.value * dpr * renderZoom.value
  canvas.height = pageHeight.value * dpr * renderZoom.value
  const ctx = canvas.getContext('2d')!
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const h = pageData.value.height
  for (const stroke of [...pageData.value.strokes, ...(currentStroke.value ? [currentStroke.value] : [])]) {
    ctx.strokeStyle = grayToCss(stroke.gray)
    ctx.lineWidth = stroke.width * s
    ctx.beginPath()
    stroke.points.forEach((p, i) => {
      const x = p.x * s
      const y = (h - p.y) * s
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()
  }
}
watchEffect(drawStrokes)
watch([() => props.page, pageData], drawStrokes, { deep: true })

// pointer position in PDF user space (rect reflects the CSS transform, so this works at any zoom)
function toPdf(e: PointerEvent) {
  const rect = inkCanvas.value!.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * pageData.value.width,
    y: pageData.value.height * (1 - (e.clientY - rect.top) / rect.height),
  }
}

const distToSegment = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  const t = lenSq ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function eraseAt(p: { x: number; y: number }) {
  const strokes = pageData.value.strokes
  const threshold = 8 / (scale.value * zoom.value) // ~8 screen px
  for (let i = strokes.length - 1; i >= 0; i--) {
    const pts = strokes[i].points
    const hitDist = strokes[i].width / 2 + threshold
    const hit =
      pts.length === 1
        ? Math.hypot(p.x - pts[0].x, p.y - pts[0].y) <= hitDist
        : pts.some((pt, j) => j > 0 && distToSegment(p, pts[j - 1], pt) <= hitDist)
    if (hit) {
      const [stroke] = strokes.splice(i, 1)
      emit('op', { type: 'erase', pageIndex: props.page - 1, index: i, stroke })
      drawStrokes()
    }
  }
}

// --- pointer handling (1 pointer = draw/erase, 2 pointers = pinch zoom / pan) ---
const pointers = new Map<number, { x: number; y: number }>()
let gesture: { dist: number; mid: { x: number; y: number }; tx: number; ty: number; zoom: number } | null = null

function gestureState() {
  const [p1, p2] = [...pointers.values()]
  return {
    dist: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1,
    mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
  }
}

function onPointerDown(e: PointerEvent) {
  if (!pageData.value) return
  try {
    inkCanvas.value!.setPointerCapture(e.pointerId)
  } catch {} // synthetic/expired pointers can't be captured; drawing still works
  pointers.set(e.pointerId, toLocal(e))
  if (pointers.size === 2) {
    currentStroke.value = null // second finger down: this is a gesture, not a stroke
    drawStrokes()
    gesture = { ...gestureState(), tx: tx.value, ty: ty.value, zoom: zoom.value }
    return
  }
  const p = toPdf(e)
  if (props.tool === 'eraser') eraseAt(p)
  else currentStroke.value = { gray: props.gray, width: props.strokeWidth, points: [p] }
}

function onPointerMove(e: PointerEvent) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, toLocal(e))
  if (gesture && pointers.size === 2) {
    const { dist, mid } = gestureState()
    const newZoom = Math.min(8, Math.max(1, gesture.zoom * (dist / gesture.dist)))
    // keep the page point that was under the initial midpoint under the current midpoint
    tx.value = mid.x - ((gesture.mid.x - gesture.tx) / gesture.zoom) * newZoom
    ty.value = mid.y - ((gesture.mid.y - gesture.ty) / gesture.zoom) * newZoom
    zoom.value = newZoom
    clampTransform()
    return
  }
  if (e.buttons === 0 || pointers.size > 1) return
  const p = toPdf(e)
  if (props.tool === 'eraser') return eraseAt(p)
  const stroke = currentStroke.value
  if (!stroke) return
  const last = stroke.points[stroke.points.length - 1]
  if (Math.hypot(p.x - last.x, p.y - last.y) * scale.value * zoom.value < 2) return // ~2px min segment
  stroke.points.push(p)
  drawStrokes()
}

function onPointerUp(e: PointerEvent) {
  pointers.delete(e.pointerId)
  if (gesture) {
    if (pointers.size < 2) {
      gesture = null
      renderZoom.value = Math.min(4, zoom.value) // re-render sharp at the new zoom
    }
    return
  }
  const stroke = currentStroke.value
  if (!stroke) return
  currentStroke.value = null
  if (stroke.points.length < 2) return
  pageData.value.strokes.push(stroke)
  emit('op', { type: 'add', pageIndex: props.page - 1, index: pageData.value.strokes.length - 1, stroke })
  drawStrokes()
}
</script>

<template>
  <div
    ref="root"
    class="annotation-editor"
    :style="{ height: boxHeight + 'px', width: boxWidth + 'px' }"
    @wheel.prevent="onWheel"
  >
    <div
      class="annotation-transform"
      :style="{
        transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
        width: cssWidth + 'px',
        height: pageHeight + 'px',
      }"
    >
      <canvas ref="bgCanvas" />
      <canvas
        ref="inkCanvas"
        :style="{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      />
    </div>
  </div>
</template>

<style scoped>
.annotation-editor {
  position: relative;
  overflow: hidden;
  touch-action: none;
}
.annotation-transform {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  background: white;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
}
.annotation-transform canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}
</style>
