<script setup lang="ts">
import LyricsViewer from '@/components/LyricsViewer.vue'
import { Song } from '@/types'
import { onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  song?: Song
  lyricsMode: 'lyrics' | 'chords' | 'drums'
  showModeration?: boolean
  noSheetHint?: string
  fontSize: number
  transpose?: number
  editable?: boolean
  autoScroll?: boolean
  /** audio playhead in seconds; when given it drives the scroll instead of the timer */
  position?: number | null
}>()

const emit = defineEmits<{
  (e: 'update:lyrics', lyrics: string): void
  (e: 'update:autoScroll', on: boolean): void
}>()

const container = ref<HTMLElement | null>(null)

// Where the scroll was last put from here. Anything else means the reader moved it, in
// either direction — scrolling back to re-read stops the following just as reading ahead
// does. Cleared whenever following is switched on, since that first jump is asked for.
let placed: number | null = null
watch([() => props.autoScroll, () => props.song], () => (placed = null))

// scroll so the lyrics start moving `offset` seconds in and arrive 40s before the song ends
const START_OFFSET = 20
const END_MARGIN = 40
const songLength = () => props.song?.duration || 150

function progressAt(seconds: number, offset: number) {
  const end = songLength() - END_MARGIN
  return Math.max(0, Math.min((seconds - offset) / Math.max(end - offset, 1), 1))
}

/**
 * Scrolls to where the song is, and returns false only if the reader has scrolled away —
 * words that fit on screen have nothing to scroll, which is not a reason to give up.
 */
function applyProgress(progress: number, startScroll: number) {
  const el = container.value
  if (!el) return true
  const endScroll = el.scrollHeight - el.clientHeight
  if (endScroll <= 0) return true
  if (placed != null && Math.abs(el.scrollTop - placed) > 10) return false // scrolled by hand
  const next = Math.round(startScroll + (endScroll - startScroll) * progress)
  if (el.scrollTop != next) el.scrollTop = next
  placed = next
  return true
}

let frame: number | null = null
function cancelScroll() {
  if (frame) cancelAnimationFrame(frame)
  frame = null
}
onUnmounted(cancelScroll)

function runTimerScroll() {
  const offset = container.value?.scrollTop == 0 ? START_OFFSET : 0
  const startScroll = container.value?.scrollTop ?? 0
  const startedAt = performance.now()
  const step = (now: number) => {
    const progress = progressAt((now - startedAt) / 1000 + offset, offset)
    if (!applyProgress(progress, startScroll)) return emit('update:autoScroll', false)
    if (progress < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}

// timer-driven autoscroll (no audio track)
watch(
  () => [props.song, props.autoScroll, props.position != null] as const,
  () => {
    cancelScroll()
    if (!props.autoScroll || props.position != null) return
    setTimeout(() => props.autoScroll && runTimerScroll(), 100) // wait for the DOM to settle
  },
  { immediate: true }
)

// Audio-driven autoscroll. The playhead maps straight onto a scroll position rather than
// advancing one, so it follows a seek backwards as readily as ordinary playback, and does
// so while paused too. Scrolling away by hand turns it off, the same as the timer does.
watch(
  () => [props.position, props.autoScroll] as const,
  ([position, on]) => {
    if (position == null || !on) return
    if (!applyProgress(progressAt(position, START_OFFSET), 0)) emit('update:autoScroll', false)
  },
  { immediate: true }
)
</script>

<template>
  <div
    class="mt-2 d-flex flex-column align-center"
    :style="{ zIndex: 20, height: '100%', overflowY: 'scroll' }"
    ref="container"
  >
    <div v-if="noSheetHint" class="text-center">{{ noSheetHint }}</div>

    <div class="bg-white px-5 mb-2 w-100" v-if="song?.nadine_moderation && showModeration">
      <h2 class="mb-2">Moderation</h2>
      <div style="white-space: pre-wrap" :style="{ fontSize: fontSize + 'px' }">{{ song.nadine_moderation }}</div>
    </div>

    <div class="bg-white px-5 pb-5">
      <h2 class="mb-2">{{ song?.name || 'Untitled' }}</h2>
      <LyricsViewer
        v-if="song?.lyrics"
        :lyrics="song.lyrics"
        :mode="lyricsMode"
        :fontSize="fontSize"
        :transpose="transpose ?? 0"
        :editable="editable"
        @update:lyrics="(l) => emit('update:lyrics', l)"
      />
      <div v-else class="text-grey">No lyrics yet</div>
    </div>
  </div>
</template>
