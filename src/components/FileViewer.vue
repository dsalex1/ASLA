<script setup lang="ts">
import AnnotationEditor from '@/components/AnnotationEditor.vue'
import AnnotationToolbar from '@/components/AnnotationToolbar.vue'
import AudioPane from '@/components/AudioPane.vue'
import FileNavStrip from '@/components/FileNavStrip.vue'
import LyricsPane from '@/components/LyricsPane.vue'
import SheetPane from '@/components/SheetPane.vue'
import SongEdit from '@/components/SongEdit.vue'
import SongInfoBar from '@/components/SongInfoBar.vue'
import { useAnnotations } from '@/composables/useAnnotations'
import { useOnline } from '@vueuse/core'
import { useFileContents } from '@/composables/useFileContents'
import { createMetronome } from '@/helpers/metronome'
import { PANE_VIEW_MISSING, sheetModeOfView, shownView, viewOfMode } from '@/helpers/paneViews'
import { songCollection } from '@/plugins/firebase'
import { CustomSetlistEntry, PaneView, Song, ViewMode } from '@/types'
import { useElementSize, useSwipe, useWindowSize } from '@vueuse/core'
import { doc, updateDoc } from 'firebase/firestore'
import { computed, onUnmounted, ref, toRef, watch } from 'vue'

const props = defineProps<{
  songs: (Song | CustomSetlistEntry)[]
  mode?: ViewMode
  annotatable?: boolean
}>()

const emit = defineEmits<{ (e: 'songDeleted'): void }>()

const currentFileIndex = ref(0)
const currentFilePage = ref(1)

const currentSong = computed(() => props.songs[currentFileIndex.value])
// a plain song, as opposed to a custom setlist entry
const song = computed(() => (currentSong.value && 'name' in currentSong.value ? currentSong.value : undefined))

// --- what the big pane is showing ---
// The route mode only picks the view a song opens on. From there the switch in the audio
// pane and the dropdown in the info bar move between all of them, and a view the current
// song has nothing for falls back to the next best one without being given up, so
// stepping over a song and back returns to the view you were in.
const view = ref<PaneView>(viewOfMode(props.mode))

// Which pdf the sheet panes resolve. It follows only the sheet views, so switching to the
// lyrics and back does not throw the loaded file away, and a setlist opened on the audio
// does not fetch a pdf until one is actually asked for.
const sheetMode = ref<ViewMode>('lyrics')

const { fileContents, sheetSources } = useFileContents(toRef(props, 'songs'), sheetMode)

const available = computed<Record<PaneView, boolean>>(() => ({
  waveform: !!song.value?.audioTracks?.length,
  sheet: !!sheetSources.value[currentFileIndex.value]?.sheet,
  drums: !!sheetSources.value[currentFileIndex.value]?.drums,
  lyrics: !!song.value?.lyrics,
  chords: !!song.value?.lyrics,
}))

const shown = computed(() => shownView(view.value, available.value))
const showsSheet = computed(() => shown.value == 'sheet' || shown.value == 'drums')
const showsLyrics = computed(() => shown.value == 'lyrics' || shown.value == 'chords')
// the transport stays put while the setlist is in audio mode, so switching to the lyrics
// or the sheet there does not cost you the controls
const showsTransport = computed(() => !!song.value && (props.mode == 'audio' || shown.value == 'waveform'))

watch(
  shown,
  (v) => {
    if (v == 'sheet') sheetMode.value = 'chords'
    else if (v == 'drums') sheetMode.value = 'drums'
  },
  { immediate: true }
)

const online = useOnline()

const annotations = useAnnotations({
  songs: toRef(props, 'songs'),
  mode: computed(() => sheetModeOfView(shown.value)),
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
const { width: boxWidth, height: boxHeight } = useElementSize(swipeTarget)
useSwipe(swipeTarget, {
  onSwipeEnd(_, direction) {
    if (shown.value == 'waveform') return // a sideways drag there scrubs the waveform
    if (direction === 'left') next()
    if (direction === 'right') prev()
  },
})

const annotTool = ref<'pen' | 'eraser'>('pen')
const annotGray = ref(0)
const annotWidth = ref(2)

// --- quick edit of the current song ---
const editDialogOpen = ref(false)
/** set when the dialog was opened to add audio, so it can start where that is done */
const editFocus = ref<'youtube' | undefined>()
const editableSong = computed(() => (song.value?.id ? song.value : undefined))

function goToSong(delta: number) {
  const target = currentFileIndex.value + delta
  if (target < 0 || target >= fileContents.value.length) return
  currentFileIndex.value = target
  currentFilePage.value = 1
}

const fontSize = ref(16)
const autoScroll = ref(false)

// --- Drummer click (metronome) ---
const currentBpm = computed(() => song.value?.bpm || 0)
const clicking = ref(false)
// headset/lock-screen play & pause drive the same click (AirPods, car stereo, ...)
const metronome = createMetronome(() => currentBpm.value, (play) => setClick(play))

function setClick(on: boolean) {
  if (on && !currentBpm.value) return
  clicking.value = on
  on ? metronome.start() : metronome.stop()
}

function toggleClick() {
  setClick(!clicking.value)
}

// stop the click when leaving the song or if it loses its bpm
watch([currentSong, currentBpm], () => {
  if (clicking.value) {
    metronome.stop()
    clicking.value = false
  }
})
onUnmounted(() => metronome.release())

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

// the pane fell back to the words because the song has nothing for the view that was asked for
const noSheetHint = computed(() =>
  showsLyrics.value && shown.value != view.value
    ? `No ${PANE_VIEW_MISSING[view.value]} file - ${song.value?.name} - (${props.mode})`
    : undefined
)
</script>

<template>
  <div class="d-flex flex-column h-100">
    <div class="d-flex">
      <div>
        <slot></slot>
      </div>
      <v-btn v-if="editableSong" icon="fas fa-pen" size="small" variant="text" @click=";((editFocus = undefined), (editDialogOpen = true))" />
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
      :shown="shown"
      :available="available"
      :canAnnotate="!!annotations.refPath.value"
      :annotateOffline="!online"
      :annotLoading="annotations.loading.value"
      :bpm="currentBpm"
      :clicking="clicking"
      v-model:view="view"
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
      <template v-if="!annot && !showsTransport && shown != 'waveform'">
        <div class="page-half" style="left: 0" @click="prev()"></div>
        <div class="page-half" style="right: 0" @click="next()"></div>
      </template>

      <AudioPane
        v-if="showsTransport && song"
        :key="currentFileIndex"
        class="w-100"
        style="position: absolute; inset: 0; z-index: 20"
        :song="song"
        :hasPrev="currentFileIndex > 0"
        :hasNext="currentFileIndex < fileContents.length - 1"
        :shown="shown"
        :available="available"
        v-model:view="view"
        @prevSong="goToSong(-1)"
        @nextSong="goToSong(1)"
        @addAudio=";((editFocus = 'youtube'), (editDialogOpen = true))"
      >
        <template #view="{ position, playing, height: paneHeight }">
          <!-- the same page turn as everywhere else: without it the second page of a
               sheet is out of reach while the transport is on screen. Only over a sheet,
               though: the words are scrolled by hand here while the audio plays. -->
          <template v-if="!annot && showsSheet">
            <div class="page-half" style="left: 0" @click="prev()"></div>
            <div class="page-half" style="right: 0" @click="next()"></div>
          </template>
          <SheetPane
            v-if="showsSheet"
            :files="fileContents"
            :fileIndex="currentFileIndex"
            :page="currentFilePage"
            :height="Math.min(pdfHeight, paneHeight || pdfHeight)"
          />
          <LyricsPane
            v-else
            :song="song"
            :lyricsMode="shown == 'chords' ? 'chords' : 'lyrics'"
            showModeration
            :noSheetHint="noSheetHint"
            :fontSize="fontSize"
            :transpose="shown == 'chords' ? transpose : 0"
            :position="position"
            :autoScroll="playing"
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
        :boxWidth="boxWidth"
        :boxHeight="boxHeight"
        :tool="annotTool"
        :gray="annotGray"
        :strokeWidth="annotWidth"
        @op="annotations.onOp"
      />

      <LyricsPane
        v-if="!showsTransport && showsLyrics && (currentSong === undefined || 'name' in currentSong)"
        :key="currentFileIndex"
        :song="song"
        :lyricsMode="shown == 'chords' ? 'chords' : 'lyrics'"
        :showModeration="shown == 'lyrics'"
        :noSheetHint="noSheetHint"
        :fontSize="fontSize"
        :transpose="shown == 'chords' ? transpose : 0"
        :editable="annotatable && shown == 'chords'"
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

      <!-- kept mounted once a sheet has been resolved, so switching away and back does
           not make the pdf renderer start over -->
      <SheetPane
        v-if="!showsTransport && sheetMode != 'lyrics' && !annot"
        :files="fileContents"
        :fileIndex="currentFileIndex"
        :page="currentFilePage"
        :height="pdfHeight"
        :hidden="!showsSheet"
      />
    </div>

    <v-dialog v-model="editDialogOpen" max-width="800px" scrollable>
      <SongEdit
        v-if="editableSong"
        :song="editableSong"
        :focus="editFocus"
        @close="editDialogOpen = false"
        @deleted=";((editDialogOpen = false), emit('songDeleted'))"
      />
    </v-dialog>
  </div>
</template>

<style scoped>
/* tap either side to turn the page, whether the sheet stands alone or sits in the audio pane */
.page-half {
  position: absolute;
  top: 0;
  width: 50%;
  height: 100%;
  z-index: 10;
}
</style>
