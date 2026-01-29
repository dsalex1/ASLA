<script setup lang="ts">
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
  loading: false,
  pageCount: 1,
})

async function setCurrentDrumsFile(song: Song) {
  currentDrumsFile.value.loading = true
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
  await saveSong(song)
  setCurrentDrumsFile(song)
}

async function deleteDrumsFile(song: Song) {
  if (!song.drumsPdfStorageRef) return
  const storage = getStorage()
  const fileRef = firebaseRef(storage, song.drumsPdfStorageRef)
  deleteObject(fileRef)
  song.drumsPdfStorageRef = ''
  currentDrumsFile.value.dataURL = null
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
        v-model="song.lyrics"
        @input="saveSong(song)"
        rows="5"
        auto-grow
        label="Lyrics"
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
        <div class="d-flex flex-wrap justify-center ga-2 mb-3">
          <vue-pdf-embed
            class="border"
            v-for="page in currentDrumsFile.pageCount"
            :key="page"
            @vue:before-mount="setCurrentDrumsFile(song)"
            @vue:before-unmount="currentDrumsFile.dataURL = null"
            @loaded="({ numPages }) => ((currentDrumsFile.pageCount = numPages), (currentDrumsFile.loading = false))"
            :height="200"
            :page="page"
            :source="currentDrumsFile.dataURL"
          />
        </div>
        <v-btn color="error" @click="deleteDrumsFile(song)" block>Remove Drums PDF</v-btn>
      </template>
    </v-card-text>
  </v-card>
</template>
