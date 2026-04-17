<script setup lang="ts">
import { lyricsHasChords } from '@/helpers/lyrics'
import { songCollection } from '@/plugins/firebase'
import { Song } from '@/types'
import { useDebounceFn } from '@vueuse/core'
import { doc, updateDoc } from 'firebase/firestore'
import { deleteObject, ref as firebaseRef, getDownloadURL, getStorage, uploadBytes } from 'firebase/storage'
import { ref } from 'vue'
import VuePdfEmbed from 'vue-pdf-embed'

defineProps<{
  song: Song
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const saveSong = useDebounceFn((song: Song) => updateDoc(doc(songCollection, song.id!), song), 500)

const strCrossProduct = <const T extends string, const U extends string>(arr1: T[], arr2: U[]): `${T}${U}`[] =>
  arr2.flatMap((b) => arr1.map((a) => `${a}${b}` as `${T}${U}`))

const currentDrumsFile = ref({
  dataURL: null as string | null,
  urls: [] as string[],
  loading: false,
  pageCount: 1,
})

async function setCurrentDrumsFile(song: Song) {
  currentDrumsFile.value.loading = true
  currentDrumsFile.value.dataURL = null
  currentDrumsFile.value.urls = []
  currentDrumsFile.value.pageCount = 1

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

  try {
    const { generateWebPImagesFromPdf } = await import('@/helpers/pdfGenerator')
    const blobs = await generateWebPImagesFromPdf(file)
    const imageRefs: string[] = []
    for (let i = 0; i < blobs.length; i++) {
      const imgRef = firebaseRef(storage, `drums_images/${song.id || file.name}_page_${i + 1}.webp`)
      await uploadBytes(imgRef, blobs[i], { contentType: 'image/webp' })
      imageRefs.push(imgRef.fullPath)
    }
    song.drumsPdfImageStorageRefs = imageRefs
  } catch (error) {
    console.error('Failed to generate drums WebP images:', error)
  }

  await saveSong(song)
  setCurrentDrumsFile(song)
}

async function deleteDrumsFile(song: Song) {
  if (!song.drumsPdfStorageRef) return
  const storage = getStorage()
  const fileRef = firebaseRef(storage, song.drumsPdfStorageRef)
  deleteObject(fileRef)
  song.drumsPdfStorageRef = ''

  if (song.drumsPdfImageStorageRefs) {
    for (const imgRef of song.drumsPdfImageStorageRefs) {
      try {
        await deleteObject(firebaseRef(storage, imgRef))
      } catch (e) {
        // ignore
      }
    }
    song.drumsPdfImageStorageRefs = []
  }

  currentDrumsFile.value.dataURL = null
  currentDrumsFile.value.urls = []
  currentDrumsFile.value.pageCount = 1
  await saveSong(song)
}

const currentSheetFile = ref({
  dataURL: null as string | null,
  urls: [] as string[],
  loading: false,
  pageCount: 1,
})

async function setCurrentSheetFile(song: Song) {
  currentSheetFile.value.loading = true
  currentSheetFile.value.dataURL = null
  currentSheetFile.value.urls = []
  currentSheetFile.value.pageCount = 1

  if (song.pdfImageStorageRefs && song.pdfImageStorageRefs.length > 0) {
    currentSheetFile.value.urls = await Promise.all(
      song.pdfImageStorageRefs.map((ref) => getDownloadURL(firebaseRef(getStorage(), ref)))
    )
    currentSheetFile.value.pageCount = currentSheetFile.value.urls.length || 1
    currentSheetFile.value.loading = false
    return
  }

  if (!song.pdfStorageRef) {
    currentSheetFile.value.loading = false
    return
  }

  currentSheetFile.value.dataURL = await getDownloadURL(firebaseRef(getStorage(), song.pdfStorageRef))
}

async function saveSheetFile(song: Song, file: File) {
  if (!file) return
  const storage = getStorage()
  const fileRef = firebaseRef(storage, `${file.name}`)
  if (song.pdfStorageRef) {
    await deleteSheetFile(song)
  }
  await uploadBytes(fileRef, file, {
    customMetadata: {
      originalFileName: file.name,
    },
  })
  song.pdfStorageRef = fileRef.fullPath

  try {
    const { generateWebPImagesFromPdf } = await import('@/helpers/pdfGenerator')
    const blobs = await generateWebPImagesFromPdf(file)
    const imageRefs: string[] = []
    for (let i = 0; i < blobs.length; i++) {
      const imgRef = firebaseRef(storage, `sheet_images/${song.id || file.name}_page_${i + 1}.webp`)
      await uploadBytes(imgRef, blobs[i], { contentType: 'image/webp' })
      imageRefs.push(imgRef.fullPath)
    }
    song.pdfImageStorageRefs = imageRefs
  } catch (error) {
    console.error('Failed to generate sheet WebP images:', error)
  }

  await saveSong(song)
  setCurrentSheetFile(song)
}

async function deleteSheetFile(song: Song) {
  if (!song.pdfStorageRef) return
  const storage = getStorage()
  const fileRef = firebaseRef(storage, song.pdfStorageRef)
  try {
    await deleteObject(fileRef)
  } catch (e) {
    console.warn('Failed to delete old file, might not exist: ', e)
  }
  song.pdfStorageRef = ''

  if (song.pdfImageStorageRefs) {
    for (const imgRef of song.pdfImageStorageRefs) {
      try {
        await deleteObject(firebaseRef(storage, imgRef))
      } catch (e) {
        // ignore
      }
    }
    song.pdfImageStorageRefs = []
  }

  currentSheetFile.value.dataURL = null
  currentSheetFile.value.urls = []
  currentSheetFile.value.pageCount = 1
  await saveSong(song)
}
</script>

<template>
  <v-card>
    <v-card-title class="d-flex justify-space-between align-center">
      <span>Edit Song - {{ song.name || song.filename }}</span>
      <v-btn icon="fas fa-times" variant="text" @click="emit('close')" />
    </v-card-title>
    <v-card-text>
      <v-text-field
        v-model="song.name"
        @input="saveSong(song)"
        label="Name"
        variant="outlined"
        density="comfortable"
        class="mb-3"
      />

      <div class="d-flex gap-2 mb-3">
        <v-autocomplete
          v-model="song.key_signature"
          :items="strCrossProduct(strCrossProduct(['C', 'D', 'E', 'F', 'G', 'A', 'B'], ['', '#', 'b']), ['', 'm'])"
          @update:model-value="saveSong(song)"
          label="Key Signature"
          variant="outlined"
          density="comfortable"
          style="flex: 1"
        />

        <v-text-field
          type="number"
          :min="0"
          :max="300"
          v-model="song.bpm"
          @update:model-value="saveSong(song)"
          label="BPM"
          variant="outlined"
          density="comfortable"
          style="flex: 1"
        />
      </div>

      <div class="d-flex gap-2 mb-3">
        <v-text-field
          :model-value="song.duration ? Math.floor(song.duration / 60) : ''"
          @update:model-value="
            (value) => {
              song.duration = (value ? parseInt(value) : 0) * 60 + (song.duration ? song.duration % 60 : 0)
              saveSong(song)
            }
          "
          :min="0"
          :max="99"
          type="number"
          label="Duration (minutes)"
          variant="outlined"
          density="comfortable"
          style="flex: 1"
        />
        <v-text-field
          :model-value="song.duration ? song.duration % 60 : ''"
          @update:model-value="
            (value) => {
              song.duration = (song.duration ? Math.floor(song.duration / 60) : 0) * 60 + (value ? parseInt(value) : 0)
              saveSong(song)
            }
          "
          :min="0"
          :max="60"
          type="number"
          label="Duration (seconds)"
          variant="outlined"
          density="comfortable"
          style="flex: 1"
        />
      </div>

      <v-select
        v-model="song.ibi_instrument"
        :items="['', 'Bass', 'E.Git', 'A.Git']"
        @update:model-value="saveSong(song)"
        label="Ibi Instrument"
        variant="outlined"
        density="comfortable"
        class="mb-3"
      />

      <v-textarea
        v-model="song.nadine_moderation"
        @input="saveSong(song)"
        rows="5"
        auto-grow
        label="Moderation"
        variant="outlined"
        density="comfortable"
        class="mb-3"
      />

      <v-textarea
        v-model="song.lyrics"
        :style="{ fontFamily: lyricsHasChords(song.lyrics) ? 'monospace' : 'inherit' }"
        @input="saveSong(song)"
        rows="5"
        auto-grow
        label="Lyrics"
        variant="outlined"
        density="comfortable"
        class="mb-3"
      />

      <v-divider class="mb-3" />

      <h4 class="mb-2">Drums PDF</h4>
      <v-file-input
        type="file"
        variant="outlined"
        density="comfortable"
        label="Select drums file"
        accept=".pdf"
        @input="(evt: InputEvent) => saveDrumsFile(song, (evt.target as HTMLInputElement).files?.[0]!)"
        class="mb-3"
      />

      <template v-if="song.drumsPdfStorageRef">
        <div
          class="d-flex flex-wrap justify-center ga-2 mb-3"
          @vue:before-mount="setCurrentDrumsFile(song)"
          @vue:before-unmount="
            ;((currentDrumsFile.dataURL = null), (currentDrumsFile.urls = []), (currentDrumsFile.pageCount = 1))
          "
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
              @loaded="({ numPages }) => ((currentDrumsFile.pageCount = numPages), (currentDrumsFile.loading = false))"
              :height="200"
              :page="page"
              :source="currentDrumsFile.dataURL"
            />
          </template>
        </div>
        <v-btn color="error" @click="deleteDrumsFile(song)" block>Remove Drums PDF</v-btn>
      </template>

      <v-divider class="mb-3" />

      <h4 class="mb-2">Sheet PDF</h4>
      <v-file-input
        type="file"
        variant="outlined"
        density="comfortable"
        label="Select sheet file"
        accept=".pdf"
        @input="(evt: InputEvent) => saveSheetFile(song, (evt.target as HTMLInputElement).files?.[0]!)"
        class="mb-3"
      />

      <template v-if="song.pdfStorageRef">
        <div
          class="d-flex flex-wrap justify-center ga-2 mb-3"
          @vue:before-mount="setCurrentSheetFile(song)"
          @vue:before-unmount="
            ;((currentSheetFile.dataURL = null), (currentSheetFile.urls = []), (currentSheetFile.pageCount = 1))
          "
        >
          <template v-if="currentSheetFile.urls.length > 0">
            <img
              class="border"
              v-for="(url, index) in currentSheetFile.urls"
              :key="url"
              :src="url"
              :alt="`Sheet page ${index + 1}`"
              style="height: 200px; object-fit: contain"
            />
          </template>
          <template v-else-if="currentSheetFile.dataURL">
            <vue-pdf-embed
              class="border"
              v-for="page in currentSheetFile.pageCount"
              :key="page"
              @loaded="({ numPages }) => ((currentSheetFile.pageCount = numPages), (currentSheetFile.loading = false))"
              :height="200"
              :page="page"
              :source="currentSheetFile.dataURL"
            />
          </template>
        </div>
        <v-btn color="error" class="mb-3" @click="deleteSheetFile(song)" block>Remove Sheet PDF</v-btn>
      </template>
    </v-card-text>
  </v-card>
</template>
