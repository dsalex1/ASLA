<script setup lang="ts">
import { flatTree, getSongInformation, mapTree } from '@/helpers'
import { useSheetBaseDirectory } from '@/plugins/sheetBaseDirectory'
import { CustomSetlistEntry, Song } from '@/types'
import { useSwipe, useWindowSize } from '@vueuse/core'
import { ref as firebaseRef, getDownloadURL, getStorage } from 'firebase/storage'
import { computed, ref, watch, watchEffect } from 'vue'
import VuePdfEmbed from 'vue-pdf-embed'
import { VBtn } from 'vuetify/components'

const props = defineProps<{
  songs: (Song | CustomSetlistEntry)[]
  mode?: 'lyrics' | 'chords' | 'drums'
}>()

const { pdfTree } = useSheetBaseDirectory()

const flattendPdfTree = computed(() =>
  flatTree(mapTree(pdfTree.value, (f) => ({ ...f, handle: f.handle as FileSystemFileHandle })))
)

async function resolveFileUrl(song: Song | CustomSetlistEntry) {
  if (!('pdfStorageRef' in song)) return ''
  if (props.mode == 'lyrics') return ''
  if (props.mode == 'chords' && song.pdfStorageRef)
    return await getDownloadURL(firebaseRef(getStorage(), song.pdfStorageRef))
  if (props.mode == 'drums' && song.drumsPdfStorageRef)
    return await getDownloadURL(firebaseRef(getStorage(), song.drumsPdfStorageRef))

  if (song.filename) {
    const localFile = await flattendPdfTree.value.find((f) => f.name === song.filename)
    if (localFile?.handle) return URL.createObjectURL(await localFile.handle.getFile())
  }
  return ''
}

const fileContents = ref<{ dataUrl: string; name: string; pageCount?: number }[]>([])

watch(
  props,
  async () => {
    fileContents.value = await Promise.all(
      props.songs.map(async (song) => ({
        pageCount: props.mode == 'lyrics' ? 1 : undefined,
        ...(fileContents.value?.find((f) => f.name === ('name' in song ? song.name : '')) ?? {}), //if already loaded overwrite pageCount
        name: 'name' in song && song.name ? song.name : 'title' in song ? song.title : 'untitled',
        dataUrl: props.mode == 'lyrics' ? '' : await resolveFileUrl(song),
      }))
    )
  },
  { immediate: true }
)

const { height, width } = useWindowSize()

const pdfHeight = computed(() => Math.min(width.value * Math.sqrt(2), height.value - 45 - 25))

const currentFileIndex = ref(0)
const currentFilePage = ref(1)

function next() {
  if (currentFilePage.value < fileContents.value[currentFileIndex.value].pageCount!) currentFilePage.value++
  else if (currentFileIndex.value < fileContents.value.length - 1) {
    currentFileIndex.value++
    currentFilePage.value = 1
  }
}
function prev() {
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

const navButtons = ref<VBtn[]>([])
watchEffect(() => {
  navButtons.value[currentFileIndex.value]?.$el.scrollIntoView({
    behavior: 'instant',
    inline: 'center',
    block: 'center',
  })
})

const showLyrics = ref(props.mode == 'lyrics' ? true : false)
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
          @click=";(currentFileIndex = i), (currentFilePage = 1)"
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

    <!-- song infos-->
    <div class="w-100 text-center" v-if="currentSong && 'name' in currentSong">
      <span v-html="getSongInformation(currentSong)" />
      <span v-if="currentSong?.duration">
        -
        <v-icon size="sm" icon="far fa-clock mb-1 " />
        {{ formatDuration(currentSong.duration) }}
      </span>
      <v-btn
        v-if="currentSong?.lyrics && props.mode != 'lyrics'"
        class="ms-2"
        variant="tonal"
        density="compact"
        prepend-icon="fas fa-file-lines"
        @click="showLyrics = !showLyrics"
      >
        {{ showLyrics ? 'Sheets' : 'Lyrics' }}
      </v-btn>
      <template v-if="showLyrics">
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
      <div @click="prev()" style="position: absolute; top: 0; left: 0; width: 50%; height: 100%; z-index: 10"></div>
      <div @click="next()" style="position: absolute; top: 0; right: 0; width: 50%; height: 100%; z-index: 10"></div>
      <div
        :key="currentFileIndex"
        v-if="showLyrics && (currentSong === undefined || 'name' in currentSong)"
        class="mt-2 d-flex flex-column align-center"
        :style="{ zIndex: 20, height: '100%', overflowY: 'scroll' }"
        ref="lyricsContainer"
      >
        <div class="bg-white px-5 mb-2 w-100" v-if="currentSong?.nadine_moderation">
          <h2 class="mb-2">Moderation</h2>
          <div style="white-space: pre-wrap" :style="{ fontSize: fontSize + 'px' }">
            {{ currentSong?.nadine_moderation }}
          </div>
        </div>

        <div class="bg-white px-5 pb-5">
          <h2 class="mb-2">{{ currentSong?.name || 'Untitled' }}</h2>
          <div style="white-space: pre-wrap" v-if="currentSong?.lyrics" :style="{ fontSize: fontSize + 'px' }">
            {{ currentSong?.lyrics }}
          </div>
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
        v-if="props.mode != 'lyrics' && 'name' in currentSong"
        v-for="(file, i) in fileContents"
        :style="{ opacity: i === currentFileIndex && !showLyrics ? 1 : 0 }"
        style="width: 0px"
      >
        <vue-pdf-embed
          v-for="pageIndex in file.pageCount || 1"
          v-show="pageIndex === currentFilePage"
          :height="pdfHeight"
          :page="pageIndex"
          @loaded="({ numPages }) => (file.pageCount = numPages)"
          :source="file.dataUrl"
        />
        <div
          v-if="!file.dataUrl"
          class="text-center"
          style="min-width: 100px; width: 50dvw; transform: translateX(-50%)"
        >
          No file - {{ file.name }} - ({{ props.mode }})
        </div>
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
