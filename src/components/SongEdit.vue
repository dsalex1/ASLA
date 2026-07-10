<script setup lang="ts">
import UltimateGuitarImport, { UgImportData } from '@/components/UltimateGuitarImport.vue'
import { lyricsHasChords } from '@/helpers/lyrics'
import { setlistCollection, songCollection } from '@/plugins/firebase'
import { Song } from '@/types'
import { useDebounceFn } from '@vueuse/core'
import { arrayRemove, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { deleteObject, ref as firebaseRef, getDownloadURL, getStorage, uploadBytes } from 'firebase/storage'
import { ref } from 'vue'

defineProps<{
  song: Song
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'deleted'): void
}>()

const saveSong = useDebounceFn((song: Song) => updateDoc(doc(songCollection, song.id!), song), 500)

function applyImport(song: Song, data: UgImportData) {
  if (song.lyrics && !confirm('Overwrite existing lyrics?')) return
  song.lyrics = data.lyrics
  if (data.bpm && !song.bpm) song.bpm = data.bpm
  if (data.duration && !song.duration) song.duration = data.duration
  if (data.key_signature && !song.key_signature) song.key_signature = data.key_signature
  saveSong(song)
}

const strCrossProduct = <const T extends string, const U extends string>(arr1: T[], arr2: U[]): `${T}${U}`[] =>
  arr2.flatMap((b) => arr1.map((a) => `${a}${b}` as `${T}${U}`))

function createPdfPreviewState() {
  return {
    urls: [] as string[],
  }
}

const currentDrumsFile = ref(createPdfPreviewState())

function resetCurrentDrumsFile() {
  currentDrumsFile.value = createPdfPreviewState()
}

async function setCurrentDrumsFile(song: Song) {
  resetCurrentDrumsFile()

  if (song.drumsPdfImageStorageRefs && song.drumsPdfImageStorageRefs.length > 0) {
    currentDrumsFile.value.urls = await Promise.all(
      song.drumsPdfImageStorageRefs.map((ref) => getDownloadURL(firebaseRef(getStorage(), ref)))
    )
  }
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

  resetCurrentDrumsFile()
  await saveSong(song)
}

const currentSheetFile = ref(createPdfPreviewState())

function resetCurrentSheetFile() {
  currentSheetFile.value = createPdfPreviewState()
}

async function setCurrentSheetFile(song: Song) {
  resetCurrentSheetFile()

  if (song.pdfImageStorageRefs && song.pdfImageStorageRefs.length > 0) {
    currentSheetFile.value.urls = await Promise.all(
      song.pdfImageStorageRefs.map((ref) => getDownloadURL(firebaseRef(getStorage(), ref)))
    )
  }
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

  resetCurrentSheetFile()
  await saveSong(song)
}

function confirmDeleteDrumsFile(song: Song) {
  if (confirm('Delete the drums PDF?')) deleteDrumsFile(song)
}

function confirmDeleteSheetFile(song: Song) {
  if (confirm('Delete the sheet PDF?')) deleteSheetFile(song)
}

const deleting = ref(false)

async function deleteSong(song: Song) {
  const usedIn = await getDocs(query(setlistCollection, where('songs', 'array-contains', song.id)))
  const setlistNames = usedIn.docs.map((d) => d.data().name || 'Untitled')
  const warning =
    setlistNames.length > 0
      ? `\n\nWarning: it is used in ${setlistNames.length} setlist(s): ${setlistNames.join(', ')}.`
      : ''
  if (
    !window.confirm(
      `Are you sure you want to delete the song "${song.name || song.filename}"? This will also delete all its files.${warning}`
    )
  )
    return

  deleting.value = true
  try {
    const storage = getStorage()
    const storageRefs = [
      song.pdfStorageRef,
      ...(song.pdfImageStorageRefs ?? []),
      song.drumsPdfStorageRef,
      ...(song.drumsPdfImageStorageRefs ?? []),
    ].filter((ref): ref is string => !!ref)
    await Promise.all(
      storageRefs.map((storageRef) =>
        deleteObject(firebaseRef(storage, storageRef)).catch((e) =>
          console.warn('Failed to delete file, might not exist: ', e)
        )
      )
    )
    await Promise.all(usedIn.docs.map((setlistDoc) => updateDoc(setlistDoc.ref, { songs: arrayRemove(song.id) })))
    await deleteDoc(doc(songCollection, song.id!))
    emit('deleted')
    emit('close')
  } catch (e) {
    console.error('Failed to delete song:', e)
  }
  deleting.value = false
}
</script>

<template>
  <v-card>
    <v-card-title class="d-flex justify-space-between align-center">
      <span class="text-truncate" style="min-width: 0">Edit Song - {{ song.name || song.filename }}</span>
      <v-btn class="flex-shrink-0" icon="fas fa-times" variant="text" @click="emit('close')" />
    </v-card-title>
    <v-card-text>
      <v-text-field
        v-model="song.name"
        @input="saveSong(song)"
        label="Name"
        variant="outlined"
        density="comfortable"
      />

      <UltimateGuitarImport :query="song.name || ''" class="mb-3" @import="(data) => applyImport(song, data)" />

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
          <div v-else class="text-grey text-caption">No cached preview images available for this file yet.</div>
        </div>
        <v-btn color="error" prepend-icon="fas fa-trash" @click="confirmDeleteDrumsFile(song)" block>
          Remove Drums PDF
        </v-btn>
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
          @vue:before-unmount="resetCurrentSheetFile()"
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
          <div v-else class="text-grey text-caption">No cached preview images available for this file yet.</div>
        </div>
        <v-btn color="error" class="mb-3" prepend-icon="fas fa-trash" @click="confirmDeleteSheetFile(song)" block>
          Remove Sheet PDF
        </v-btn>
      </template>

      <v-divider class="mb-3" />

      <v-btn color="error" :loading="deleting" @click="deleteSong(song)" block prepend-icon="fas fa-trash">
        Delete Song
      </v-btn>
    </v-card-text>
  </v-card>
</template>
