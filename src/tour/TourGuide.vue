<script setup lang="ts">
import { useAccess } from '@/composables/useAccess'
import { useElementSize, useEventListener, useWindowSize } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TourStep, TOURS, triggerOf } from './tours'
import { useTour } from './useTour'

/**
 * The guide itself: a spotlight on whatever a step is about, with a card next to it. It is
 * mounted once for the whole app and finds its targets on its own, which is also how it
 * knows when to start: the first time a guide's screen is up, that guide runs.
 */
const tour = useTour()
const { active, index, steps, step } = tour
const { profile, accessReady } = useAccess()
const route = useRoute()
const router = useRouter()
const { width: winWidth, height: winHeight } = useWindowSize()

const PAD = 6 // room around the spotlit element
const GAP = 12 // between the spotlight and the card
const CARD_WIDTH = 340
const FIND_TIMEOUT = 2500 // ms to wait for a step's target after changing page
const BEFORE_SETTLE = 600 // ms for a new page to render before a step presses anything on it

const target = ref<Element | null>(null)
const rect = ref<DOMRect | null>(null)
/** set while a step is still being looked for, so the old spotlight does not linger */
const finding = ref(false)

const resolve = (s: TourStep) => (typeof s.target === 'function' ? s.target() : s.target ? document.querySelector(s.target) : null) ?? null

const visible = (el: Element | null) => {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 || r.height > 0
}

/** wait for the element to turn up: after a change of page, that page may still be loading */
function findTarget(s: TourStep, patience: number): Promise<Element | null> {
  if (!s.target) return Promise.resolve(null)
  return new Promise((done) => {
    const began = Date.now()
    const look = () => {
      const el = resolve(s)
      if (visible(el)) return done(el)
      if (Date.now() - began >= patience) return done(null)
      setTimeout(look, 100)
    }
    look()
  })
}

let showing = 0 // guards against a later step being overtaken by an earlier, slower lookup

/** show step `at`, or the nearest one in `direction` that has something to show */
async function show(at: number, direction: 1 | -1 = 1) {
  const run = ++showing
  finding.value = true
  for (let i = at; i >= 0 && i < steps.value.length; i += direction) {
    const s = steps.value[i]
    const moving = !!s.route && route.path !== s.route
    if (moving) await router.push(s.route!)
    if (s.before) {
      // what it presses has to be on the new page before it can be pressed
      if (moving) await new Promise((done) => setTimeout(done, BEFORE_SETTLE))
      if ((await s.before()) === false) {
        if (run !== showing || !active.value) return
        continue
      }
    }
    const el = await findTarget(s, moving ? FIND_TIMEOUT : 0)
    if (run !== showing || !active.value) return
    if (s.target && !el && s.optional) continue
    index.value = i
    target.value = el
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    measure()
    finding.value = false
    return
  }
  // ran off either end: going back stays on the first step, going forward is done
  if (direction < 0) return show(0, 1)
  tour.finish()
}

const next = () => show(index.value + 1, 1)
const back = () => show(index.value - 1, -1)
const isLast = computed(() => !steps.value.slice(index.value + 1).length)

// the spotlight follows its element while it moves: a page scrolling, a panel opening
let frame = 0
function measure() {
  rect.value = target.value?.isConnected ? target.value.getBoundingClientRect() : null
}
function follow() {
  measure()
  frame = requestAnimationFrame(follow)
}
watch(
  active,
  (tourOn) => {
    cancelAnimationFrame(frame)
    target.value = null
    rect.value = null
    if (!tourOn) return
    follow()
    show(0)
  },
  { immediate: true }
)
onBeforeUnmount(() => cancelAnimationFrame(frame))

const spotlight = computed(() => {
  const r = rect.value
  if (!r) return null
  return { left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
})

// below the element when there is room, above it when there is room there, and over it
// when it fills the screen (the waveform does)
const card = ref<HTMLElement | null>(null)
const { height: cardHeight } = useElementSize(card, undefined, { box: 'border-box' })

const cardStyle = computed(() => {
  const width = Math.min(CARD_WIDTH, winWidth.value - 32)
  const s = spotlight.value
  if (!s) return { width: `${width}px`, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  const left = Math.max(16, Math.min(s.left + s.width / 2 - width / 2, winWidth.value - width - 16))
  const needed = cardHeight.value + GAP + 16
  if (winHeight.value - (s.top + s.height) >= needed) return { width: `${width}px`, left: `${left}px`, top: `${s.top + s.height + GAP}px` }
  if (s.top >= needed) return { width: `${width}px`, left: `${left}px`, top: `${s.top - GAP - cardHeight.value}px` }
  const middle = s.top + s.height / 2 - cardHeight.value / 2
  const top = Math.max(16, Math.min(middle, winHeight.value - cardHeight.value - 16))
  return { width: `${width}px`, left: `${left}px`, top: `${top}px` }
})

// --- starting by itself, once, the first time its screen comes up ---
const signedIn = computed(() => accessReady.value && !!profile.value)

function autoStart() {
  if (active.value || !signedIn.value) return
  const queued = tour.queued.value
  const due = TOURS.find(
    (t) =>
      (queued ? t.id === queued : !tour.hasSeen(t.id)) &&
      (!t.triggerRoute || route.path === t.triggerRoute) &&
      visible(triggerOf(t))
  )
  if (due) tour.start(due.id)
}

// the screens come and go without the route always changing (the audio pane is a view
// inside a setlist), so what is on the page is watched instead, and only while needed
let observer: MutationObserver | null = null
let pending = false
const anythingDue = () => !!tour.queued.value || TOURS.some((t) => !tour.hasSeen(t.id))
function watchPage() {
  observer?.disconnect()
  observer = null
  if (!signedIn.value || !anythingDue()) return
  observer = new MutationObserver(() => {
    if (pending) return
    pending = true
    setTimeout(() => ((pending = false), autoStart()), 300)
  })
  observer.observe(document.body, { childList: true, subtree: true })
  setTimeout(autoStart, 300)
}
onMounted(watchPage)
watch([signedIn, active, tour.queued, () => route.path], watchPage)
onBeforeUnmount(() => observer?.disconnect())

// --- keys: ? opens the guide for what is on screen, the arrows and Escape drive it ---
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')
  if (!active.value) {
    if (e.key === '?' && !typing && signedIn.value) tour.startHere()
    return
  }
  if (e.key === 'Escape') tour.finish()
  else if (e.key === 'ArrowRight' || e.key === 'Enter') next()
  else if (e.key === 'ArrowLeft') back()
  else return
  e.preventDefault()
  e.stopPropagation()
}, { capture: true })
</script>

<template>
  <Teleport to="body">
    <div v-if="active && step" class="tour" role="dialog" aria-modal="true" :aria-label="active.title">
      <!-- everything but the card is out of reach while the guide is up -->
      <div class="tour-blocker" :class="{ 'tour-blocker--dim': !spotlight || finding }" />
      <div
        v-if="spotlight && !finding"
        class="tour-spotlight"
        :style="{
          left: `${spotlight.left}px`,
          top: `${spotlight.top}px`,
          width: `${spotlight.width}px`,
          height: `${spotlight.height}px`,
        }"
      />
      <div v-show="!finding" ref="card" class="tour-card" :style="cardStyle">
        <div class="tour-progress">{{ active.title }} · {{ index + 1 }} / {{ steps.length }}</div>
        <div class="tour-title">{{ step.title }}</div>
        <p v-for="(line, i) in step.body" :key="i" class="tour-body">{{ line }}</p>
        <div class="tour-actions">
          <button class="tour-btn tour-btn--text" @click="tour.finish()">Skip guide</button>
          <span style="flex: 1" />
          <button v-if="index > 0" class="tour-btn" @click="back">Back</button>
          <button class="tour-btn tour-btn--primary" @click="next">{{ isLast ? 'Done' : 'Next' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tour {
  position: fixed;
  inset: 0;
  z-index: 5000;
}
.tour-blocker {
  position: absolute;
  inset: 0;
}
.tour-blocker--dim {
  background: rgba(0, 0, 0, 0.6);
}
/* the dimming is the spotlight's own shadow, so the lit element stays exactly as it is */
.tour-spotlight {
  position: fixed;
  border-radius: 8px;
  box-shadow:
    0 0 0 2px #f59e0b,
    0 0 0 9999px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  transition: all 0.2s ease;
}
.tour-card {
  position: fixed;
  padding: 14px 16px 10px;
  border-radius: 10px;
  background: #1b1b1b;
  color: #eee;
  box-shadow: 0 12px 32px rgb(0 0 0 / 55%);
  font-size: 14px;
  line-height: 1.45;
}
.tour-progress {
  font-size: 11px;
  color: #999;
  margin-bottom: 2px;
}
.tour-title {
  font-size: 16px;
  font-weight: 700;
  color: #f59e0b;
  margin-bottom: 6px;
}
.tour-body {
  margin: 0 0 6px;
}
.tour-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.tour-btn {
  height: 32px;
  padding-inline: 14px;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  background: #262626;
  color: #eee;
  font-weight: 600;
  cursor: pointer;
}
.tour-btn--primary {
  border-color: #f59e0b;
  background: #f59e0b;
  color: #111;
}
.tour-btn--text {
  padding-inline: 4px;
  border: none;
  background: none;
  color: #aaa;
  font-weight: 500;
}
</style>
