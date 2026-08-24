<script setup lang="ts">
import AnnotationEditor from '@/components/AnnotationEditor.vue'
import AnnotationToolbar from '@/components/AnnotationToolbar.vue'
import AudioPane from '@/components/AudioPane.vue'
import FileNavStrip from '@/components/FileNavStrip.vue'
import LyricsPane from '@/components/LyricsPane.vue'
import SheetPane from '@/components/SheetPane.vue'
import SongInfoBar from '@/components/SongInfoBar.vue'
import { useAnnotations } from '@/composables/useAnnotations'
import { useFileContents } from '@/composables/useFileContents'
import { createMetronome } from '@/helpers/metronome'
import { songCollection } from '@/plugins/firebase'
import { CustomSetlistEntry, Song, ViewMode } from '@/types'
import { useSwipe, useWindowSize } from '@vueuse/core'
import { doc, updateDoc } from 'firebase/firestore'
import { computed, onUnmounted, ref, toRef, watch } from 'vue'

const props = defineProps<{
  songs: (Song | CustomSetlistEntry)[]
  mode?: ViewMode
  annotatable?: boolean
}>()

const currentFileIndex = ref(0)
const currentFilePage = ref(1)

const { fileContents } = useFileContents(toRef(props, 'songs'), toRef(props, 'mode'))

const annotations = useAnnotations({
  songs: toRef(props, 'songs'),
  mode: toRef(props, 'mode'),
  fileContents,
  fileIndex: currentFileIndex,
  page: currentFilePage,
})
const annot = annotations.annot

const { height, width } = useWindowSize()
const pdfHeight = computed(() => Math.min(width.value * Math.sqrt(2), height.value - 45 - 25))

function next() {
  if (annot.value) return
  if (currentFilePage.value < fileContents.value[currentFileIndex.value].pageCount!) currentFilePage.value++
  else if (currentFileIndex.value < fileContents.value.length - 1) {
    currentFileIndex.value++
    currentFilePage.value = 1
  }
}
function prev() {
  if (annot.value) return
  if (currentFilePage.value > 1) currentFilePage.value--
  else if (currentFileIndex.value > 0) {
    currentFileIndex.value--
    currentFilePage.value = fileContents.value[currentFileIndex.value].pageCount!
  }
}

const swipeTarget = ref<HTMLDivElement | null>(null)
useSwipe(swipeTarget, {
  onSwipeEnd(_, direction) {
    if (direction === 'left') next()
    if (direction === 'right') prev()
  },
})

const annotTool = ref<'pen' | 'eraser'>('pen')
const annotGray = ref(0)
const annotWidth = ref(2)

const currentSong = computed(() => props.songs[currentFileIndex.value])
// a plain song, as opposed to a custom setlist entry
const song = computed(() => (currentSong.value && 'name' in currentSong.value ? currentSong.value : undefined))

// audio mode swaps the big area between the waveform and the lyrics/chords panes
const audioView = ref<'waveform' | 'lyrics' | 'chords'>('waveform')
const isAudio = computed(() => props.mode == 'audio')

function goToSong(delta: number) {
  const target = currentFileIndex.value + delta
  if (target < 0 || target >= fileContents.value.length) return
  currentFileIndex.value = target
  currentFilePage.value = 1
}

const shallShowLyrics = ref(props.mode == 'lyrics')
const hasSheet = computed(() => {
  const file = fileContents.value[currentFileIndex.value]
  return !!(file?.dataUrl || file?.urls.length)
})
const showLyrics = computed(
  () => !isAudio.value && (shallShowLyrics.value || (fileContents.value.length > 0 && !hasSheet.value))
)
// the lyrics pane is on screen either way, so the font/autoscroll controls stay useful
const lyricsOnScreen = computed(() => showLyrics.value || (isAudio.value && audioView.value != 'waveform'))
const fontSize = ref(16)
const autoScroll = ref(false)

// --- Drummer click (metronome) ---
const currentBpm = computed(() => song.value?.bpm || 0)
const clicking = ref(false)
const metronome = createMetronome(() => currentBpm.value)

function toggleClick() {
  clicking.value = !clicking.value
  clicking.value ? metronome.start() : metronome.stop()
}

// stop the click when leaving the song or if it loses its bpm
watch([currentSong, currentBpm], () => {
  if (clicking.value) {
    metronome.stop()
    clicking.value = false
  }
})
onUnmounted(() => metronome.stop())

// --- chord transposition & inline chord editing (lyrics chord view) ---
const transpose = computed(() => song.value?.transpose || 0)

// base rapid clicks on the last written value, not the (async) snapshot
let transposeTarget: number | null = null
watch(currentSong, () => (transposeTarget = null))

function saveSong(fields: Partial<Song>) {
  if (!song.value?.id) return
  updateDoc(doc(songCollection, song.value.id), fields)
}

function changeTranspose(delta: number) {
  if (!song.value?.id) return
  transposeTarget = Math.max(-11, Math.min(11, (transposeTarget ?? transpose.value) + delta))
  saveSong({ transpose: transposeTarget })
}
</script>

<template>
  <div class="d-flex flex-column h-100">
    <div class="d-flex">
      <div>
        <slot></slot>
      </div>
      <FileNavStrip
        :files="fileContents"
        :fileIndex="currentFileIndex"
        :page="currentFilePage"
        :lockedTo="annot ? currentFileIndex : null"
        @select="
          (i) => {
            currentFileIndex = i
            currentFilePage = 1
          }
        "
      />
    </div>

    <AnnotationToolbar
      v-if="annot"
      v-model:tool="annotTool"
      v-model:gray="annotGray"
      v-model:width="annotWidth"
      v-model:page="currentFilePage"
      :pageCount="annot.pages.length"
      :canUndo="!!annot.undoStack.length"
      :canRedo="!!annot.redoStack.length"
      :dirty="annot.dirty"
      :saving="annot.saving"
      @undo="annotations.undo"
      @redo="annotations.redo"
      @save="annotations.save"
      @done="annotations.stop"
    />

    <SongInfoBar
      v-if="!annot && song"
      :song="song"
      :mode="mode"
      :annotatable="annotatable"
      :transpose="transpose"
      :showLyrics="lyricsOnScreen"
      :canAnnotate="!!annotations.refPath.value"
      :annotLoading="annotations.loading.value"
      :bpm="currentBpm"
      :clicking="clicking"
      v-model:shallShowLyrics="shallShowLyrics"
      v-model:fontSize="fontSize"
      v-model:autoScroll="autoScroll"
      @annotate="annotations.start"
      @toggleClick="toggleClick"
      @transpose="changeTranspose"
    />

    <div
      style="
        position: relative;
        flex-basis: 0;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      "
      ref="swipeTarget"
    >
      <template v-if="!annot && !isAudio">
        <div @click="prev()" style="position: absolute; top: 0; left: 0; width: 50%; height: 100%; z-index: 10"></div>
        <div @click="next()" style="position: absolute; top: 0; right: 0; width: 50%; height: 100%; z-index: 10"></div>
      </template>

      <AudioPane
        v-if="isAudio && song"
        :key="currentFileIndex"
        class="w-100"
        style="position: absolute; inset: 0; z-index: 20"
        :song="song"
        :hasPrev="currentFileIndex > 0"
        :hasNext="currentFileIndex < fileContents.length - 1"
        v-model:view="audioView"
        @prevSong="goToSong(-1)"
        @nextSong="goToSong(1)"
      >
        <template #view="{ position }">
          <LyricsPane
            :song="song"
            :lyricsMode="audioView == 'chords' ? 'chords' : 'lyrics'"
            showModeration
            :fontSize="fontSize"
            :transpose="audioView == 'chords' ? transpose : 0"
            :position="position"
            v-model:autoScroll="autoScroll"
            @update:lyrics="(lyrics) => saveSong({ lyrics })"
          />
        </template>
      </AudioPane>

      <AnnotationEditor
        v-if="annot"
        style="z-index: 30"
        :bytes="annot.bytes"
        :pages="annot.pages"
        :page="currentFilePage"
        :displayHeight="pdfHeight"
        :tool="annotTool"
        :gray="annotGray"
        :strokeWidth="annotWidth"
        @op="annotations.onOp"
      />

      <LyricsPane
        v-if="showLyrics && (currentSong === undefined || 'name' in currentSong)"
        :key="currentFileIndex"
        :song="song"
        :lyricsMode="shallShowLyrics || !mode || mode == 'audio' ? 'lyrics' : mode"
        :showModeration="shallShowLyrics"
        :noSheetHint="shallShowLyrics != showLyrics ? `No sheet file - ${song?.name} - (${mode})` : undefined"
        :fontSize="fontSize"
        :transpose="mode == 'chords' ? transpose : 0"
        :editable="annotatable && mode == 'chords' && !shallShowLyrics"
        v-model:autoScroll="autoScroll"
        @update:lyrics="(lyrics) => saveSong({ lyrics })"
      />

      <div v-if="currentSong && 'title' in currentSong" style="width: 0px">
        <div class="text-center text-h4" style="min-width: 100px; width: 50dvw; transform: translateX(-50%)">
          {{ currentSong.title }}
          <br />
          <span class="text-h5">{{ currentSong.description }}</span>
        </div>
      </div>

      <SheetPane
        v-if="mode != 'lyrics' && !annot"
        :files="fileContents"
        :fileIndex="currentFileIndex"
        :page="currentFilePage"
        :height="pdfHeight"
        :hidden="showLyrics"
      />
    </div>
  </div>
</template>
