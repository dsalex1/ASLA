<script setup lang="ts">
import AnnotationEditor from '@/components/AnnotationEditor.vue'
import LyricsViewer from '@/components/LyricsViewer.vue'
import { flatTree, getSongInformation, mapTree } from '@/helpers'
import { createMetronome } from '@/helpers/metronome'
import { PageAnnotations, readAnnotations, StrokeOp, writeAnnotations } from '@/helpers/inkAnnotations'
import { songCollection } from '@/plugins/firebase'
import { useSheetBaseDirectory } from '@/plugins/sheetBaseDirectory'
import { CustomSetlistEntry, Song } from '@/types'
import { useSwipe, useWindowSize } from '@vueuse/core'
import { doc, updateDoc } from 'firebase/firestore'
import { ref as firebaseRef, getDownloadURL, getStorage, uploadBytes } from 'firebase/storage'
import { computed, onUnmounted, ref, watch, watchEffect } from 'vue'
import VuePdfEmbed from 'vue-pdf-embed'
import { VBtn } from 'vuetify/components'

const props = defineProps<{
  songs: (Song | CustomSetlistEntry)[]
  mode?: 'lyrics' | 'chords' | 'drums'
  annotatable?: boolean
}>()

const { pdfTree } = useSheetBaseDirectory()

const flattendPdfTree = computed(() =>
  flatTree(mapTree(pdfTree.value, (f) => ({ ...f, handle: f.handle as FileSystemFileHandle })))
)

async function resolveFileUrl(song: Song | CustomSetlistEntry) {
  if (!('pdfStorageRef' in song)) return ''
  if (props.mode == 'lyrics') return ''

  if (props.mode == 'chords') {
    if (song.pdfImageStorageRefs && song.pdfImageStorageRefs.length > 0) {
      return await Promise.all(song.pdfImageStorageRefs.map((r) => getDownloadURL(firebaseRef(getStorage(), r))))
    }
    if (song.pdfStorageRef) {
      return await getDownloadURL(firebaseRef(getStorage(), song.pdfStorageRef))
    }
  }

  if (props.mode == 'drums') {
    if (song.drumsPdfImageStorageRefs && song.drumsPdfImageStorageRefs.length > 0) {
      return await Promise.all(song.drumsPdfImageStorageRefs.map((r) => getDownloadURL(firebaseRef(getStorage(), r))))
    }
    if (song.drumsPdfStorageRef) {
      return await getDownloadURL(firebaseRef(getStorage(), song.drumsPdfStorageRef))
    }
  }

  if (song.filename) {
    const localFile = await flattendPdfTree.value.find((f) => f.name === song.filename)
    if (localFile?.handle) return URL.createObjectURL(await localFile.handle.getFile())
  }
  return ''
}

const fileContents = ref<{ urls: string[]; isPdf: boolean; dataUrl: string; name: string; pageCount?: number }[]>([])

watch(
  props,
  async () => {
    fileContents.value = await Promise.all(
      props.songs.map(async (song) => {
        const resolved = props.mode == 'lyrics' ? '' : await resolveFileUrl(song)
        const isImageArray = Array.isArray(resolved)
        return {
          pageCount: props.mode == 'lyrics' ? 1 : isImageArray ? resolved.length : 1,
          ...(fileContents.value?.find((f) => f.name === ('name' in song ? song.name : '')) ?? {}), //if already loaded overwrite pageCount
          name: 'name' in song && song.name ? song.name : 'title' in song ? song.title : 'untitled',
          dataUrl: isImageArray ? '' : (resolved as string),
          urls: isImageArray ? (resolved as string[]) : [],
          isPdf: !isImageArray,
        }
      })
    )
  },
  { immediate: true }
)

const { height, width } = useWindowSize()

const pdfHeight = computed(() => Math.min(width.value * Math.sqrt(2), height.value - 45 - 25))

const currentFileIndex = ref(0)
const currentFilePage = ref(1)

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

// --- PDF ink annotation mode ---
const annot = ref<{
  bytes: Uint8Array
  pages: PageAnnotations[]
  refPath: string
  fileIndex: number
  dirty: boolean
  saving: boolean
  undoStack: StrokeOp[]
  redoStack: StrokeOp[]
} | null>(null)
const annotLoading = ref(false)
const annotTool = ref<'pen' | 'eraser'>('pen')
const annotGray = ref(0)
const annotWidth = ref(2)
const annotColors = [0, 0.5, 1]
const annotWidths = [2, 5, 10]

const currentAnnotRefPath = computed(() => {
  const song = props.songs[currentFileIndex.value]
  if (!song || !('pdfStorageRef' in song)) return ''
  if (props.mode == 'drums') return song.drumsPdfStorageRef || ''
  if (props.mode == 'chords') return song.pdfStorageRef || ''
  return ''
})

async function startAnnotating() {
  if (annotLoading.value || annot.value) return // guard double-clicks: a second run would discard drawn strokes
  annotLoading.value = true
  try {
    const refPath = currentAnnotRefPath.value
    const url = await getDownloadURL(firebaseRef(getStorage(), refPath))
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
    const pages = await readAnnotations(bytes)
    fileContents.value[currentFileIndex.value].pageCount = pages.length
    if (currentFilePage.value > pages.length) currentFilePage.value = 1
    annot.value = {
      bytes,
      pages,
      refPath,
      fileIndex: currentFileIndex.value,
      dirty: false,
      saving: false,
      undoStack: [],
      redoStack: [],
    }
  } catch (e) {
    console.error('Failed to load PDF for annotation:', e)
    alert('Failed to load PDF for annotation')
  } finally {
    annotLoading.value = false
  }
}

function onAnnotOp(op: StrokeOp) {
  const a = annot.value!
  a.undoStack.push(op)
  a.redoStack = []
  a.dirty = true
}

// apply an op forwards (redo) or backwards (undo)
function applyAnnotOp(op: StrokeOp, reverse: boolean) {
  const strokes = annot.value!.pages[op.pageIndex].strokes
  if ((op.type === 'add') !== reverse) strokes.splice(op.index, 0, op.stroke)
  else strokes.splice(op.index, 1)
  currentFilePage.value = op.pageIndex + 1 // show the affected page
  annot.value!.dirty = true
}

function undoAnnot() {
  const op = annot.value?.undoStack.pop()
  if (!op) return
  applyAnnotOp(op, true)
  annot.value!.redoStack.push(op)
}

function redoAnnot() {
  const op = annot.value?.redoStack.pop()
  if (!op) return
  applyAnnotOp(op, false)
  annot.value!.undoStack.push(op)
}

function stopAnnotating() {
  if (annot.value?.dirty && !confirm('Discard unsaved annotations?')) return
  annot.value = null
}

async function saveAnnotations() {
  const a = annot.value
  if (!a || a.saving) return
  a.saving = true
  try {
    const newBytes = await writeAnnotations(
      a.bytes,
      a.pages.map((p) => p.strokes)
    )
    const storage = getStorage()
    await uploadBytes(firebaseRef(storage, a.refPath), newBytes, { contentType: 'application/pdf' })

    // regenerate the cached page images so they include the annotations
    const song = props.songs[a.fileIndex] as Song
    const imgRefs = props.mode == 'drums' ? song.drumsPdfImageStorageRefs : song.pdfImageStorageRefs
    if (imgRefs?.length) {
      const { generateWebPImagesFromPdf } = await import('@/helpers/pdfGenerator')
      const blobs = await generateWebPImagesFromPdf(newBytes.slice().buffer)
      await Promise.all(
        imgRefs.map((r, i) =>
          blobs[i] ? uploadBytes(firebaseRef(storage, r), blobs[i], { contentType: 'image/webp' }) : undefined
        )
      )
    }

    a.bytes = newBytes
    a.dirty = false
    // refresh the normal view with the annotated file
    const file = fileContents.value[a.fileIndex]
    if (file?.isPdf) file.dataUrl = URL.createObjectURL(new Blob([newBytes as BlobPart], { type: 'application/pdf' }))
    else file.urls = file.urls.map((u) => u.split('&_bust=')[0] + '&_bust=' + Date.now())
  } catch (e) {
    console.error('Failed to save annotations:', e)
    alert('Failed to save annotations')
  } finally {
    a.saving = false
  }
}

const swipeTarget = ref<HTMLDivElement | null>(null)
useSwipe(swipeTarget, {
  onSwipeEnd(_, direction) {
    if (direction === 'left') next()
    if (direction === 'right') prev()
  },
})

const navButtons = ref<VBtn[]>([])
watchEffect(() => {
  navButtons.value[currentFileIndex.value]?.$el.scrollIntoView({
    behavior: 'instant',
    inline: 'center',
    block: 'center',
  })
})

const shallShowLyrics = ref(props.mode == 'lyrics' ? true : false)
const showLyrics = computed(
  () =>
    shallShowLyrics.value ||
    (fileContents.value.length > 0 &&
      !(fileContents.value[currentFileIndex.value]?.dataUrl || fileContents.value[currentFileIndex.value]?.urls.length))
)
const fontSize = ref(16)

// Autoscroll for lyrics
const lyricsContainer = ref<HTMLElement | null>(null)
const autoScroll = ref(false)
let scrollAnimationFrame: number | null = null

function scrollLyricsToBottom(duration: number, offset = 0) {
  if (!lyricsContainer.value) return
  const el = lyricsContainer.value
  const start = performance.now() + offset * 1000
  const startScroll = el.scrollTop
  const endScroll = el.scrollHeight - el.clientHeight
  if (endScroll <= 0) return
  function step(now: number) {
    const elapsed = (now - start) / 1000
    const progress = Math.max(Math.min(elapsed / (duration - offset), 1), 0)
    const nextScrollPos = Math.round(startScroll + (endScroll - startScroll) * progress)
    // cancel if user scrolled more than 10px
    if (el.scrollTop - nextScrollPos > 10) {
      autoScroll.value = false
      if (scrollAnimationFrame) {
        cancelAnimationFrame(scrollAnimationFrame)
        scrollAnimationFrame = null
      }
      return
    }
    if (el.scrollTop != nextScrollPos) {
      el.scrollTop = nextScrollPos
    }
    if (progress < 1) {
      scrollAnimationFrame = requestAnimationFrame(step)
    }
  }
  if (scrollAnimationFrame) cancelAnimationFrame(scrollAnimationFrame)
  scrollAnimationFrame = requestAnimationFrame(step)
}

const currentSong = computed(() => props.songs[currentFileIndex.value])

// --- Drummer click (metronome) ---
const currentBpm = computed(() =>
  currentSong.value && 'bpm' in currentSong.value ? currentSong.value.bpm || 0 : 0
)
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

watch([currentSong, showLyrics, autoScroll], ([currentSong, showLyrics, autoScroll]) => {
  if (scrollAnimationFrame) {
    cancelAnimationFrame(scrollAnimationFrame)
    scrollAnimationFrame = null
  }
  if (autoScroll && showLyrics) {
    // Wait for DOM update
    setTimeout(() => {
      if (!currentSong || !('duration' in currentSong)) return
      scrollLyricsToBottom((currentSong.duration || 150) - 40, lyricsContainer.value?.scrollTop == 0 ? 20 : 0) // arrive 40s before the end, and start after 20s if were at the start
    }, 100)
  }
})

function formatDuration(duration?: number) {
  return duration ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : ''
}

// --- chord transposition & inline chord editing (lyrics chord view) ---
const transpose = computed(() =>
  currentSong.value && 'transpose' in currentSong.value ? currentSong.value.transpose || 0 : 0
)

function formatTranspose(n: number) {
  return n > 0 ? `+${n}` : `${n}`
}

// base rapid clicks on the last written value, not the (async) snapshot
let transposeTarget: number | null = null
watch(currentSong, () => (transposeTarget = null))

function changeTranspose(delta: number) {
  const song = currentSong.value
  if (!song || !('id' in song) || !song.id) return
  transposeTarget = Math.max(-11, Math.min(11, (transposeTarget ?? transpose.value) + delta))
  updateDoc(doc(songCollection, song.id), { transpose: transposeTarget })
}

function updateLyrics(lyrics: string) {
  const song = currentSong.value
  if (!song || !('id' in song) || !song.id) return
  updateDoc(doc(songCollection, song.id), { lyrics })
}
</script>

<template>
  <div class="d-flex flex-column h-100">
    <div class="d-flex">
      <div>
        <slot></slot>
      </div>
      <div class="d-flex ms-4" style="overflow-x: scroll; flex: 1">
        <v-btn
          ref="navButtons"
          variant="plain"
          small
          class="p-0"
          style="min-width: 0; padding-inline: 5px !important; position: relative"
          v-for="(file, i) in fileContents"
          :disabled="!!annot && i !== currentFileIndex"
          @click=";((currentFileIndex = i), (currentFilePage = 1))"
        >
          {{ file.name.length > 15 ? file.name.slice(0, 15) + '...' : file.name }}
          <div
            v-for="j in file.pageCount || 1"
            style="position: absolute; bottom: 0; top: 0; height: 100%"
            :style="{
              width: `${100 / (file.pageCount || 1)}%`,
              left: `${(j - 1) * (100 / (file.pageCount || 1))}%`,
              borderRight: j == file.pageCount ? '1px solid black' : '1px dotted grey', //i % 2 == 0 ? 'rgb(0 0 0 / 0.1)' : 'transparent',
              backgroundColor:
                i == currentFileIndex && j === currentFilePage ? 'rgba(var(--v-theme-primary), 0.2)' : 'transparent',
            }"
          ></div>
        </v-btn>
      </div>
    </div>

    <!-- annotation toolbar -->
    <div class="w-100 d-flex flex-wrap justify-center align-center ga-2 py-1" v-if="annot">
      <div>
        <v-btn
          v-for="gray in annotColors"
          :key="gray"
          density="compact"
          :variant="annotTool == 'pen' && annotGray == gray ? 'outlined' : 'text'"
          icon
          @click=";((annotGray = gray), (annotTool = 'pen'))"
        >
          <div
            :style="{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              border: '1px solid #888',
              backgroundColor: `rgb(${gray * 255},${gray * 255},${gray * 255})`,
            }"
          ></div>
        </v-btn>
      </div>
      <div>
        <v-btn
          v-for="(w, i) in annotWidths"
          :key="w"
          density="compact"
          :variant="annotTool == 'pen' && annotWidth == w ? 'outlined' : 'text'"
          icon
          @click=";((annotWidth = w), (annotTool = 'pen'))"
        >
          <div
            :style="{
              width: `${8 + i * 5}px`,
              height: `${8 + i * 5}px`,
              borderRadius: '50%',
              backgroundColor: 'currentColor',
            }"
          ></div>
        </v-btn>
      </div>
      <v-btn
        density="compact"
        :variant="annotTool == 'eraser' ? 'outlined' : 'text'"
        icon="fas fa-eraser"
        @click="annotTool = 'eraser'"
      />
      <v-divider vertical />
      <div>
        <v-btn
          density="compact"
          variant="text"
          icon="fas fa-rotate-left"
          :disabled="!annot.undoStack.length"
          @click="undoAnnot"
        />
        <v-btn
          density="compact"
          variant="text"
          icon="fas fa-rotate-right"
          :disabled="!annot.redoStack.length"
          @click="redoAnnot"
        />
      </div>
      <v-divider vertical />
      <div>
        <v-btn
          density="compact"
          variant="text"
          icon="fas fa-chevron-left"
          :disabled="currentFilePage <= 1"
          @click="currentFilePage--"
        />
        <span>{{ currentFilePage }}/{{ annot.pages.length }}</span>
        <v-btn
          density="compact"
          variant="text"
          icon="fas fa-chevron-right"
          :disabled="currentFilePage >= annot.pages.length"
          @click="currentFilePage++"
        />
      </div>
      <v-divider vertical />
      <div>
        <v-btn
          density="compact"
          variant="tonal"
          color="primary"
          prepend-icon="fas fa-floppy-disk"
          :loading="annot.saving"
          :disabled="!annot.dirty"
          @click="saveAnnotations"
        >
          Save
        </v-btn>
        <v-btn density="compact" variant="text" icon="fas fa-check-circle" @click="stopAnnotating" />
      </div>
    </div>

    <!-- song infos-->
    <div class="w-100 text-center" v-if="!annot && currentSong && 'name' in currentSong">
      <span v-html="getSongInformation(currentSong)" />
      <span v-if="currentSong?.duration">
        -
        <v-icon size="sm" icon="far fa-clock mb-1 " />
        {{ formatDuration(currentSong.duration) }}
      </span>
      <v-chip v-if="props.mode == 'chords' && !props.annotatable && transpose" class="ms-2" size="small" color="primary">
        <v-icon start size="x-small" icon="fas fa-music" />
        {{ formatTranspose(transpose) }}
      </v-chip>
      <v-btn
        v-if="currentSong?.lyrics && props.mode != 'lyrics'"
        class="ms-2"
        variant="tonal"
        density="compact"
        prepend-icon="fas fa-file-lines"
        @click="shallShowLyrics = !shallShowLyrics"
      >
        {{ shallShowLyrics ? 'Sheets' : 'Lyrics' }}
      </v-btn>
      <v-btn
        v-if="props.annotatable && currentAnnotRefPath && !showLyrics"
        class="ms-2"
        variant="tonal"
        density="compact"
        icon="fas fa-pen"
        :loading="annotLoading"
        @click="startAnnotating"
      />
      <v-btn
        v-if="props.mode == 'drums' && currentBpm"
        class="ms-2"
        variant="tonal"
        density="compact"
        :color="clicking ? 'primary' : undefined"
        :prepend-icon="clicking ? 'fas fa-pause' : 'fas fa-drum'"
        @click="toggleClick"
      >
        {{ currentBpm }} BPM
      </v-btn>
      <template v-if="showLyrics">
        <template v-if="props.annotatable && props.mode == 'chords' && !shallShowLyrics && currentSong?.lyrics">
          <v-btn
            class="ms-2"
            variant="tonal"
            density="compact"
            icon="fas fa-arrow-down"
            :disabled="transpose <= -11"
            @click="changeTranspose(-1)"
          />
          <span class="mx-2">{{ formatTranspose(transpose) }}</span>
          <v-btn
            variant="tonal"
            density="compact"
            icon="fas fa-arrow-up"
            :disabled="transpose >= 11"
            @click="changeTranspose(1)"
          />
        </template>
        <v-btn
          class="ms-2"
          variant="tonal"
          density="compact"
          icon="fas fa-minus"
          @click="fontSize = Math.max(12, fontSize - 2)"
        />
        <span class="mx-2">{{ fontSize }}</span>
        <v-btn
          class="me-2"
          variant="tonal"
          density="compact"
          icon="fas fa-plus"
          @click="fontSize = Math.min(48, fontSize + 2)"
        />
        <v-btn
          class="ms-2"
          variant="tonal"
          density="compact"
          :icon="autoScroll ? 'fas fa-pause' : 'fas fa-play'"
          @click="autoScroll = !autoScroll"
        />
      </template>
    </div>

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
      <div
        v-if="!annot"
        @click="prev()"
        style="position: absolute; top: 0; left: 0; width: 50%; height: 100%; z-index: 10"
      ></div>
      <div
        v-if="!annot"
        @click="next()"
        style="position: absolute; top: 0; right: 0; width: 50%; height: 100%; z-index: 10"
      ></div>
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
        @op="onAnnotOp"
      />
      <div
        :key="currentFileIndex"
        v-if="showLyrics && (currentSong === undefined || 'name' in currentSong)"
        class="mt-2 d-flex flex-column align-center"
        :style="{ zIndex: 20, height: '100%', overflowY: 'scroll' }"
        ref="lyricsContainer"
      >
        <div v-if="shallShowLyrics != showLyrics" class="text-center">
          No sheet file - {{ currentSong.name }} - ({{ props.mode }})
        </div>

        <div class="bg-white px-5 mb-2 w-100" v-if="currentSong?.nadine_moderation && shallShowLyrics">
          <h2 class="mb-2">Moderation</h2>
          <div style="white-space: pre-wrap" :style="{ fontSize: fontSize + 'px' }">
            {{ currentSong?.nadine_moderation }}
          </div>
        </div>

        <div class="bg-white px-5 pb-5">
          <h2 class="mb-2">{{ currentSong?.name || 'Untitled' }}</h2>
          <LyricsViewer
            v-if="currentSong?.lyrics"
            :lyrics="currentSong.lyrics"
            :mode="shallShowLyrics ? 'lyrics' : props.mode"
            :fontSize="fontSize"
            :transpose="props.mode == 'chords' ? transpose : 0"
            :editable="props.annotatable && props.mode == 'chords' && !shallShowLyrics"
            @update:lyrics="updateLyrics"
          />
          <div v-else class="text-grey">No lyrics yet</div>
        </div>
      </div>
      <div v-if="'title' in currentSong" style="width: 0px">
        <div class="text-center text-h4" style="min-width: 100px; width: 50dvw; transform: translateX(-50%)">
          {{ currentSong.title }}
          <br />
          <span class="text-h5">{{ currentSong.description }}</span>
        </div>
      </div>
      <div
        v-if="props.mode != 'lyrics' && !annot"
        v-for="(file, i) in fileContents"
        :style="{ opacity: i === currentFileIndex && !showLyrics ? 1 : 0 }"
        style="width: 0px"
      >
        <template v-if="file.isPdf">
          <vue-pdf-embed
            v-for="pageIndex in file.pageCount || 1"
            v-show="pageIndex === currentFilePage"
            :height="pdfHeight"
            :page="pageIndex"
            @loaded="({ numPages }) => (file.pageCount = numPages)"
            :source="file.dataUrl"
          />
        </template>
        <template v-else>
          <img
            style="transform: translateX(-50%)"
            v-for="(url, index) in file.urls"
            :key="index"
            v-show="index + 1 === currentFilePage"
            :src="url"
            :style="{ height: pdfHeight + 'px', objectFit: 'contain' }"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style>
.vue-pdf-embed__page {
  display: flex;
  justify-content: center;
}
</style>
