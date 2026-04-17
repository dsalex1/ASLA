<script setup lang="ts">
import Backbutton from '@/components/Backbutton.vue'
import SongCreate from '@/components/SongCreate.vue'
import { lyricsHasChords } from '@/helpers/lyrics'
import AppLayout from '@/layouts/AppLayout.vue'
import { setlistCollection, songCollection } from '@/plugins/firebase'
import { useSheetBaseDirectory } from '@/plugins/sheetBaseDirectory'
import { HOME_ROUTE } from '@/router'
import { Song } from '@/types'
import { useDebounceFn } from '@vueuse/core'
import { doc, getDocs, updateDoc } from 'firebase/firestore'
import { deleteObject, ref as firebaseRef, getDownloadURL, getStorage, uploadBytes } from 'firebase/storage'
import { computed, ref } from 'vue'
import VuePdfEmbed from 'vue-pdf-embed'
import { useCollection } from 'vuefire'

const { baseDirectory, chooseNewSheetBaseDirectory } = useSheetBaseDirectory()

const songs = useCollection(songCollection)
const songSearch = ref('')

const setlists = useCollection(setlistCollection)
const setlistFilter = ref<string | null>(null)

const saveSong = useDebounceFn((song: Song) => updateDoc(doc(songCollection, song.id!), song), 500)

const filteredSongs = computed(() => {
  if (!setlistFilter.value) return songs.value
  const setlist = setlists.value.find((s) => s.id === setlistFilter.value)
  if (!setlist) return []
  return setlist.songs.map((songId) => songs.value.find((s) => s.id === songId)!).filter(Boolean)
})

const strCrossProduct = <const T extends string, const U extends string>(arr1: T[], arr2: U[]): `${T}${U}`[] =>
  arr2.flatMap((b) => arr1.map((a) => `${a}${b}` as `${T}${U}`))

function createDrumsPreviewState() {
  return {
    dataURL: null as string | null,
    urls: [] as string[],
    loading: false,
    pageCount: 1,
  }
}

const currentDrumsFile = ref(createDrumsPreviewState())

function resetCurrentDrumsFile() {
  currentDrumsFile.value = createDrumsPreviewState()
}

async function setCurrentDrumsFile(song: Song) {
  resetCurrentDrumsFile()
  currentDrumsFile.value.loading = true

  if (song.drumsPdfImageStorageRefs && song.drumsPdfImageStorageRefs.length > 0) {
    currentDrumsFile.value.urls = await Promise.all(
      song.drumsPdfImageStorageRefs.map((ref) => getDownloadURL(firebaseRef(getStorage(), ref)))
    )
    currentDrumsFile.value.pageCount = currentDrumsFile.value.urls.length || 1
    currentDrumsFile.value.loading = false
    return
  }

  if (!song.drumsPdfStorageRef) {
    currentDrumsFile.value.loading = false
    return
  }

  currentDrumsFile.value.dataURL = await getDownloadURL(firebaseRef(getStorage(), song.drumsPdfStorageRef))
}

async function saveDrumsFile(song: Song, file: File) {
  if (!file) return
  const storage = getStorage()
  const fileRef = firebaseRef(storage, `drums/${file.name}`)
  deleteDrumsFile(song) // Remove old file if exists
  await uploadBytes(fileRef, file, {
    customMetadata: {
      originalFileName: file.name,
    },
  })
  song.drumsPdfStorageRef = fileRef.fullPath
  song.drumsPdfImageStorageRefs = []
  await saveSong(song)
  setCurrentDrumsFile(song)
}

async function deleteDrumsFile(song: Song) {
  if (!song.drumsPdfStorageRef) return
  const storage = getStorage()
  const fileRef = firebaseRef(storage, song.drumsPdfStorageRef)
  deleteObject(fileRef)
  song.drumsPdfStorageRef = ''
  resetCurrentDrumsFile()

  if (song.drumsPdfImageStorageRefs) {
    for (const imgRef of song.drumsPdfImageStorageRefs) {
      try {
        await deleteObject(firebaseRef(storage, imgRef))
      } catch (e) {
        console.warn(`Failed to delete old drums image ${imgRef}:`, e)
      }
    }
    song.drumsPdfImageStorageRefs = []
  }

  await saveSong(song)
}

const isMigrating = ref(false)
const migrationProgress = ref({ done: 0, total: 0 })

async function migratePdfsToWebp() {
  if (
    !confirm(
      'This will download all PDFs and convert them to WebP images, saving them back to storage (can take a while). Proceed?'
    )
  )
    return

  isMigrating.value = true
  const storage = getStorage()

  try {
    const allSongs = await getDocs(songCollection)
    const songsToMigrate = allSongs.docs.filter((d) => {
      const data = d.data()
      return (
        (data.pdfStorageRef && (!data.pdfImageStorageRefs || data.pdfImageStorageRefs.length === 0)) ||
        (data.drumsPdfStorageRef && (!data.drumsPdfImageStorageRefs || data.drumsPdfImageStorageRefs.length === 0))
      )
    })

    migrationProgress.value.total = songsToMigrate.length
    migrationProgress.value.done = 0

    const { generateWebPImagesFromPdf } = await import('@/helpers/pdfGenerator')

    for (const docSnap of songsToMigrate) {
      const song = docSnap.data()
      let updated = false

      if (song.pdfStorageRef && (!song.pdfImageStorageRefs || song.pdfImageStorageRefs.length === 0)) {
        try {
          const url = await getDownloadURL(firebaseRef(storage, song.pdfStorageRef))
          const res = await fetch(url)
          const blob = await res.blob()
          const blobs = await generateWebPImagesFromPdf(blob)
          const imageRefs: string[] = []
          for (let i = 0; i < blobs.length; i++) {
            const imgRef = firebaseRef(storage, `sheet_images/${docSnap.id}_page_${i + 1}.webp`)
            await uploadBytes(imgRef, blobs[i], { contentType: 'image/webp' })
            imageRefs.push(imgRef.fullPath)
          }
          song.pdfImageStorageRefs = imageRefs
          updated = true
        } catch (e) {
          console.error('Failed sheet migration for', docSnap.id, e)
        }
      }

      if (song.drumsPdfStorageRef && (!song.drumsPdfImageStorageRefs || song.drumsPdfImageStorageRefs.length === 0)) {
        try {
          const url = await getDownloadURL(firebaseRef(storage, song.drumsPdfStorageRef))
          const res = await fetch(url)
          const blob = await res.blob()
          const blobs = await generateWebPImagesFromPdf(blob)
          const imageRefs: string[] = []
          for (let i = 0; i < blobs.length; i++) {
            const imgRef = firebaseRef(storage, `drums_images/${docSnap.id}_page_${i + 1}.webp`)
            await uploadBytes(imgRef, blobs[i], { contentType: 'image/webp' })
            imageRefs.push(imgRef.fullPath)
          }
          song.drumsPdfImageStorageRefs = imageRefs
          updated = true
        } catch (e) {
          console.error('Failed drums migration for', docSnap.id, e)
        }
      }

      if (updated) {
        await updateDoc(doc(songCollection, docSnap.id), song)
      }
      migrationProgress.value.done++
    }
    alert('Migration complete! All missing WebP caches have been generated.')
  } catch (error) {
    console.error('Migration failed:', error)
    alert('Migration failed. Check console for details.')
  } finally {
    isMigrating.value = false
  }
}
</script>

<template>
  <AppLayout>
    <h2>
      <Backbutton :to="HOME_ROUTE" />
      Settings
    </h2>
    <div class="d-flex align-center">
      <div class="mr-2">current sheet path: {{ baseDirectory ? '/' + baseDirectory.name : 'none' }}</div>
      <v-btn @click="chooseNewSheetBaseDirectory" color="primary">Select new path</v-btn>
    </div>

    <v-card class="mt-4 mb-4" variant="outlined">
      <v-card-text>
        <div class="d-flex justify-space-between align-center">
          <div>
            <h3 class="mb-1">WebP Image Cache Migration</h3>
            <div class="text-caption text-grey">
              Generate missing high-res images for fast loading of old PDF files.
            </div>
          </div>
          <v-btn :loading="isMigrating" @click="migratePdfsToWebp" color="warning" prepend-icon="fas fa-file-image">
            Force Migration
            <span v-if="isMigrating" class="ml-2">({{ migrationProgress.done }}/{{ migrationProgress.total }})</span>
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <h3 class="mt-3"></h3>
    <v-card title="Song Details" flat>
      <template v-slot:append>
        <SongCreate />
      </template>
      <template #text>
        <div class="mb-2 d-flex flex-wrap align-center gap-2">
          <v-chip
            v-for="setlist in [{ name: 'All', id: null }, ...setlists]"
            :key="setlist.id || 'null'"
            :color="setlistFilter === setlist.id ? 'primary' : ''"
            :variant="setlistFilter === setlist.id ? 'flat' : 'tonal'"
            class="me-1 mb-1"
            @click="setlistFilter = setlist.id ?? null"
            :active="setlistFilter === setlist.id"
          >
            {{ setlist.name || 'Untitled' }}
          </v-chip>
        </div>
        <v-text-field
          v-model="songSearch"
          label="Search"
          prepend-inner-icon="fas fa-search"
          hide-details
          single-line
        ></v-text-field>
      </template>

      <v-data-table
        :items="filteredSongs"
        :search="songSearch"
        :headers="[
          { key: 'filename', title: 'File', fixed: true },
          { key: 'name', title: 'Name' },
          { key: 'key_signature', title: 'Key' },
          { key: 'bpm', title: 'BPM' },
          { key: 'duration', title: 'Duration' },
          { key: 'ibi_instrument', title: 'Ibi Instrument' },
          { key: 'drumsPdfStorageRef', title: 'Drums PDF' },
          { key: 'lyrics', title: 'Lyrics' },
          { key: 'nadine_moderation', title: 'Moderation' },
        ]"
      >
        <template #item.filename="{ item }">
          <span
            :title="item.filename"
            style="
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              display: inline-block;
              max-width: 100px;
            "
          >
            {{ item.filename }}
          </span>
        </template>
        <template #item.name="{ item }">
          <v-text-field
            v-model="item.name"
            @input="saveSong(item)"
            width="250px"
            variant="outlined"
            density="compact"
            hide-details
          />
        </template>
        <template #item.key_signature="{ item }">
          <v-autocomplete
            v-model="item.key_signature"
            :items="strCrossProduct(strCrossProduct(['C', 'D', 'E', 'F', 'G', 'A', 'B'], ['', '#', 'b']), ['', 'm'])"
            @update:model-value="saveSong(item)"
            width="100px"
            variant="outlined"
            density="compact"
            hide-details
          />
        </template>
        <template #item.bpm="{ item }">
          <v-text-field
            type="number"
            :min="0"
            :max="300"
            v-model="item.bpm"
            @update:model-value="saveSong(item)"
            width="85px"
            variant="outlined"
            density="compact"
            hide-details
          />
        </template>
        <template #item.duration="{ item }">
          <div class="d-flex align-center">
            <v-text-field
              :model-value="item.duration ? Math.floor(item.duration / 60) : ''"
              @update:model-value="
                (value) => {
                  item.duration = (value ? parseInt(value) : 0) * 60 + (item.duration ? item.duration % 60 : 0)
                  saveSong(item)
                }
              "
              :min="0"
              :max="99"
              type="number"
              width="70px"
              variant="outlined"
              density="compact"
              hide-details
            />
            :
            <v-text-field
              :model-value="item.duration ? item.duration % 60 : ''"
              @update:model-value="
                (value) => {
                  item.duration =
                    (item.duration ? Math.floor(item.duration / 60) : 0) * 60 + (value ? parseInt(value) : 0)
                  saveSong(item)
                }
              "
              :min="0"
              :max="60"
              type="number"
              width="70px"
              variant="outlined"
              density="compact"
              hide-details
            />
          </div>
        </template>
        <template #item.ibi_instrument="{ item }">
          <!--select with Bass A.Git and E.Git-->
          <v-select
            v-model="item.ibi_instrument"
            :items="['', 'Bass', 'E.Git', 'A.Git']"
            @update:model-value="saveSong(item)"
            width="150px"
            variant="outlined"
            density="compact"
            hide-details
          />
        </template>
        <template #item.drumsPdfStorageRef="{ item }">
          <v-dialog max-width="600px" max-height="80dvh" close-on-back>
            <template #activator="{ props }">
              <div class="d-flex flex-row align-center ga-2">
                <v-btn v-bind="props" color="info" variant="tonal">Edit Drums</v-btn>
                <span v-if="item.drumsPdfStorageRef">🥁</span>
              </div>
            </template>
            <v-card>
              <v-card-title>Edit Drums - {{ item.name || item.filename }}</v-card-title>
              <v-card-text>
                <v-file-input
                  type="file"
                  variant="outlined"
                  density="compact"
                  label="Select new drums file"
                  hide-details
                  accept=".pdf"
                  @input="(evt: InputEvent) => saveDrumsFile(item, (evt.target as HTMLInputElement).files?.[0]!)"
                />

                <template v-if="item.drumsPdfStorageRef">
                  <h4 class="mt-4">Current Drums PDF:</h4>
                  <div
                    class="d-flex flex-wrap justify-center ga-2"
                    @vue:before-mount="setCurrentDrumsFile(item)"
                    @vue:before-unmount="resetCurrentDrumsFile()"
                  >
                    <template v-if="currentDrumsFile.urls.length > 0">
                      <img
                        class="border"
                        v-for="(url, index) in currentDrumsFile.urls"
                        :key="url"
                        :src="url"
                        :alt="`Drums page ${index + 1}`"
                        style="height: 200px; object-fit: contain"
                      />
                    </template>
                    <template v-else-if="currentDrumsFile.dataURL">
                      <vue-pdf-embed
                        class="border"
                        v-for="page in currentDrumsFile.pageCount"
                        :key="page"
                        @loaded="
                          ({ numPages }) => ((currentDrumsFile.pageCount = numPages), (currentDrumsFile.loading = false))
                        "
                        :height="200"
                        :page="page"
                        :source="currentDrumsFile.dataURL"
                      />
                    </template>
                  </div>
                  <v-btn color="error" @click="deleteDrumsFile(item)" class="mt-2">Remove Drums PDF</v-btn>
                </template>
              </v-card-text>
            </v-card>
          </v-dialog>
        </template>
        <template #item.lyrics="{ item }">
          <v-dialog max-width="600px" max-height="80dvh" close-on-back>
            <template #activator="{ props }">
              <div class="d-flex flex-row align-center ga-2">
                <v-btn v-bind="props" color="primary" variant="tonal">Edit Lyrics</v-btn>
                <span v-if="item.lyrics">🎤</span>
              </div>
            </template>
            <v-card>
              <v-card-title>Edit Lyrics - {{ item.name || item.filename }}</v-card-title>
              <v-card-text>
                <v-textarea
                  v-model="item.lyrics"
                  :style="{ fontFamily: lyricsHasChords(item.lyrics) ? 'roboto-mono, monospace' : 'inherit' }"
                  @input="saveSong(item)"
                  rows="15"
                  auto-grow
                  label="Lyrics"
                  hide-details
                />
              </v-card-text>
            </v-card>
          </v-dialog>
        </template>
        <template #item.nadine_moderation="{ item }">
          <v-dialog max-width="600px" max-height="80dvh" close-on-back>
            <template #activator="{ props }">
              <div class="d-flex flex-row align-center ga-2">
                <v-btn v-bind="props" color="primary" variant="tonal">Edit Moderation</v-btn>
                <span v-if="item.nadine_moderation" style="margin-left: 4px">💬</span>
              </div>
            </template>
            <v-card>
              <v-card-title>Edit Moderation - {{ item.name || item.filename }}</v-card-title>
              <v-card-text>
                <v-textarea
                  v-model="item.nadine_moderation"
                  @input="saveSong(item)"
                  rows="15"
                  auto-grow
                  label="Moderation"
                  hide-details
                />
              </v-card-text>
            </v-card>
          </v-dialog>
        </template>
      </v-data-table>
    </v-card>
  </AppLayout>
</template>

<style scoped lang="scss">
.disable-active-underlay {
  .v-list-item {
    --v-activated-opacity: 0;
  }
}
</style>

<style>
.DragFeedback {
  display: none;
}
</style>
