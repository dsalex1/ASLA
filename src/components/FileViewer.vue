<script setup lang="ts">
import { flatTree, getSongInformation, mapTree } from '@/helpers'
import { useSheetBaseDirectory } from '@/plugins/sheetBaseDirectory'
import { Song } from '@/types'
import { useSwipe, useWindowSize } from '@vueuse/core'
import { ref as firebaseRef, getDownloadURL, getStorage } from 'firebase/storage'
import { computed, ref, watch, watchEffect } from 'vue'
import VuePdfEmbed from 'vue-pdf-embed'
import { VBtn } from 'vuetify/components'

const props = defineProps<{
  songs: Song[]
  mode?: 'lyrics' | 'chords' | 'drums'
}>()

const { pdfTree } = useSheetBaseDirectory()

const flattendPdfTree = computed(() =>
  flatTree(mapTree(pdfTree.value, (f) => ({ ...f, handle: f.handle as FileSystemFileHandle })))
)

async function resolveFileUrl(song: Song) {
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
        ...(fileContents.value?.find((f) => f.name === song.name) ?? {}), //if already loaded overwrite pageCount
        name: song.name || 'untitled',
        dataUrl: props.mode == 'lyrics' ? '' : await resolveFileUrl(song),
      }))
    )
  },
  { immediate: true }
)

const { height } = useWindowSize()

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
    <div class="w-100 text-center">
      {{ getSongInformation(songs[currentFileIndex]) }}
      <span v-if="songs[currentFileIndex]?.duration">
        - <v-icon size="sm" icon="far fa-clock mb-1 " /> {{ formatDuration(songs[currentFileIndex].duration) }}
      </span>
      <v-btn
        v-if="songs[currentFileIndex]?.lyrics && props.mode != 'lyrics'"
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
          v-if="showLyrics"
        />
        <span v-if="showLyrics" class="mx-2">{{ fontSize }}</span>
        <v-btn
          class="me-2"
          variant="tonal"
          density="compact"
          icon="fas fa-plus"
          @click="fontSize = Math.min(48, fontSize + 2)"
          v-if="showLyrics"
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
        v-if="showLyrics"
        class="mt-2 d-flex flex-column align-center"
        :style="{ zIndex: 20, height: '100%', overflowY: 'scroll' }"
      >
        <div class="bg-white px-5 mb-2 w-100" v-if="songs[currentFileIndex]?.nadine_moderation">
          <h2 class="mb-2">Moderation</h2>
          <div style="white-space: pre-wrap" :style="{ fontSize: fontSize + 'px' }">
            {{ songs[currentFileIndex]?.nadine_moderation }}
          </div>
        </div>

        <div class="bg-white px-5 pb-5">
          <h2 class="mb-2">{{ songs[currentFileIndex]?.name || 'Untitled' }}</h2>
          <div
            style="white-space: pre-wrap"
            v-if="songs[currentFileIndex]?.lyrics"
            :style="{ fontSize: fontSize + 'px' }"
          >
            {{ songs[currentFileIndex].lyrics }}
          </div>
          <div v-else class="text-grey">No lyrics yet</div>
        </div>
      </div>
      <div
        v-if="props.mode != 'lyrics'"
        v-for="(file, i) in fileContents"
        :style="{ opacity: i === currentFileIndex && !showLyrics ? 1 : 0 }"
        style="width: 0px"
      >
        <vue-pdf-embed
          v-for="pageIndex in file.pageCount || 1"
          v-show="pageIndex === currentFilePage"
          :height="height - 45 - 25"
          :page="pageIndex"
          @loaded="({ numPages }) => (file.pageCount = numPages)"
          :source="file.dataUrl"
        />
        <div
          v-if="!file.dataUrl"
          class="text-center"
          style="min-width: 100px; width: 50vw; transform: translateX(-50%)"
        >
          No file - {{ file.name }} ({{ props.mode }})
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
