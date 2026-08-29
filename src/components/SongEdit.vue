<script setup lang="ts">
import StemSplitDialog from '@/components/StemSplitDialog.vue'
import UltimateGuitarImport, { UgImportData } from '@/components/UltimateGuitarImport.vue'
import YouTubeAudioImport from '@/components/YouTubeAudioImport.vue'
import { AUDIO_ACCEPT, deleteAudioTrack, isPlayableAudio, uploadAudioTrack } from '@/helpers/audioTracks'
import { uploadHashed } from '@/helpers/contentHash'
import { audioTrackRefs, pruneHashes } from '@/helpers/songRefs'
import { lyricsHasChords } from '@/helpers/lyrics'
import { clearJob, failJob, isStale, removeStems, splitTrack, stemIcon, stemLabel } from '@/helpers/stems'
import { formatDuration } from '@/helpers'
import { folderCollection, setlistCollection, songCollection } from '@/plugins/firebase'
import { AudioTrack, Song, StemJob } from '@/types'
import { useDebounceFn } from '@vueuse/core'
import { arrayRemove, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { deleteObject, ref as firebaseRef, getDownloadURL, getStorage } from 'firebase/storage'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useCollection } from 'vuefire'

const props = defineProps<{
  song: Song
  /** opened to get audio onto a song that has none: start at the import */
  focus?: 'youtube'
}>()

const youtubeSection = ref<HTMLElement | null>(null)
onMounted(async () => {
  if (props.focus !== 'youtube') return
  await nextTick()
  youtubeSection.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'deleted'): void
}>()

const saveSong = useDebounceFn((song: Song) => updateDoc(doc(songCollection, song.id!), song), 500)

const folders = useCollection(folderCollection)
const folderItems = computed(() =>
  [...folders.value].sort((a, b) => a.name.localeCompare(b.name)).map((f) => ({ title: f.name, value: f.id }))
)

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
  const hashes: Record<string, string> = {}
  hashes[fileRef.fullPath] = await uploadHashed(fileRef, file, { customMetadata: { originalFileName: file.name } })
  song.drumsPdfStorageRef = fileRef.fullPath

  try {
    const { generateWebPImagesFromPdf } = await import('@/helpers/pdfGenerator')
    const blobs = await generateWebPImagesFromPdf(file)
    const imageRefs: string[] = []
    for (let i = 0; i < blobs.length; i++) {
      const imgRef = firebaseRef(storage, `drums_images/${song.id || file.name}_page_${i + 1}.webp`)
      hashes[imgRef.fullPath] = await uploadHashed(imgRef, blobs[i], { contentType: 'image/webp' })
      imageRefs.push(imgRef.fullPath)
    }
    song.drumsPdfImageStorageRefs = imageRefs
  } catch (error) {
    console.error('Failed to generate drums WebP images:', error)
  }

  song.hashes = { ...song.hashes, ...hashes }
  pruneHashes(song)
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
  const hashes: Record<string, string> = {}
  hashes[fileRef.fullPath] = await uploadHashed(fileRef, file, { customMetadata: { originalFileName: file.name } })
  song.pdfStorageRef = fileRef.fullPath

  try {
    const { generateWebPImagesFromPdf } = await import('@/helpers/pdfGenerator')
    const blobs = await generateWebPImagesFromPdf(file)
    const imageRefs: string[] = []
    for (let i = 0; i < blobs.length; i++) {
      const imgRef = firebaseRef(storage, `sheet_images/${song.id || file.name}_page_${i + 1}.webp`)
      hashes[imgRef.fullPath] = await uploadHashed(imgRef, blobs[i], { contentType: 'image/webp' })
      imageRefs.push(imgRef.fullPath)
    }
    song.pdfImageStorageRefs = imageRefs
  } catch (error) {
    console.error('Failed to generate sheet WebP images:', error)
  }

  song.hashes = { ...song.hashes, ...hashes }
  pruneHashes(song)
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

// --- audio tracks ---
const audioUploading = ref(false)

// --- stems ---
const splitIndex = ref<number | null>(null)
const splitting = ref<number | null>(null)
const splitDialog = computed({
  get: () => splitIndex.value !== null,
  set: (open: boolean) => (splitIndex.value = open ? splitIndex.value : null),
})

/**
 * The separation runs for minutes, so this only starts it and lets the job on the track
 * report the rest - which is also what shows it to everyone else's device.
 */
async function startSplit(song: Song, index: number, requested: string[], job?: StemJob) {
  splitting.value = index
  try {
    await splitTrack(song, index, requested, job)
  } catch (e) {
    console.error('Stem separation failed:', e)
    await failJob(song, index, String((e as Error).message ?? e))
    alert(`Splitting failed: ${(e as Error).message ?? e}`)
  }
  splitting.value = null
}

const stemsOf = (track: AudioTrack) => (track.stems ?? []).map((s) => s.name)

async function addAudioTrack(song: Song, file?: File) {
  if (!file) return
  if (!isPlayableAudio(file)) return alert(`${file.name} is not a playable compressed audio format (${AUDIO_ACCEPT}).`)
  audioUploading.value = true
  try {
    const { track, hashes } = await uploadAudioTrack(song, file)
    song.audioTracks = [...(song.audioTracks ?? []), track]
    song.hashes = { ...song.hashes, ...hashes }
    await saveSong(song)
  } catch (e) {
    console.error('Failed to add audio track:', e)
    alert('Failed to add audio track - could the file not be decoded?')
  }
  audioUploading.value = false
}

async function dropStems(song: Song, index: number) {
  if (!confirm('Remove the separated stems from this track? The track itself stays.')) return
  await removeStems(song, index)
}

/** A track pulled off YouTube is an ordinary track; only where the bytes came from differs. */
async function addYouTubeTrack(
  song: Song,
  { track, hashes, split }: { track: AudioTrack; hashes: Record<string, string>; split: boolean }
) {
  song.audioTracks = [...(song.audioTracks ?? []), track]
  song.hashes = { ...song.hashes, ...hashes }
  await saveSong(song)
  if (!split) return
  const requested = JSON.parse(localStorage.getItem('stemDefaults') ?? '["vocals","guitars","bass","drums"]')
  await startSplit(song, song.audioTracks.length - 1, requested)
}

async function removeAudioTrack(song: Song, index: number) {
  const track = song.audioTracks?.[index]
  if (!track || !confirm(`Remove the audio track "${track.name}"?`)) return
  song.audioTracks = song.audioTracks!.filter((_, i) => i !== index)
  await saveSong(song)
  await deleteAudioTrack(track)
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
      ...audioTrackRefs(song),
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

      <v-select
        v-model="song.folderId"
        :items="folderItems"
        @update:model-value="saveSong(song)"
        label="Folder"
        placeholder="No folder"
        variant="outlined"
        density="comfortable"
        clearable
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

      <h4 class="mb-2">Audio Tracks</h4>
      <v-file-input
        type="file"
        variant="outlined"
        density="comfortable"
        label="Add audio track"
        :accept="AUDIO_ACCEPT"
        :loading="audioUploading"
        :disabled="audioUploading"
        @input="(evt: InputEvent) => addAudioTrack(song, (evt.target as HTMLInputElement).files?.[0])"
        class="mb-3"
      />

      <div ref="youtubeSection" class="mb-3">
        <YouTubeAudioImport :song="song" :query="song.name || ''" @imported="(p) => addYouTubeTrack(song, p)" />
      </div>

      <v-list v-if="song.audioTracks?.length" density="compact" class="mb-3">
        <v-list-item v-for="(track, index) in song.audioTracks" :key="track.storageRef">
          <v-text-field
            v-model="track.name"
            @input="saveSong(song)"
            label="Track name"
            variant="outlined"
            density="compact"
            hide-details
          >
            <template #append-inner>
              <span class="text-caption text-grey">{{ formatDuration(Math.round(track.duration)) }}</span>
            </template>
          </v-text-field>

          <!-- what this track has been split into, and what it was found to be in -->
          <div class="d-flex flex-wrap align-center ga-1 mt-2">
            <v-chip
              v-for="name in stemsOf(track)"
              :key="name"
              size="small"
              variant="tonal"
              :prepend-icon="stemIcon(name)"
            >
              {{ stemLabel(name) }}
            </v-chip>

            <template v-if="track.stemJob">
              <v-chip size="small" variant="tonal" color="primary" prepend-icon="fas fa-circle-notch fa-spin">
                {{ track.stemJob.phase === 'storing' ? 'Storing stems' : 'Separating' }}...
              </v-chip>
              <span class="text-caption text-grey">{{ track.stemJob.requested.join(', ') }} - {{ track.stemJob.by }}</span>
              <!-- whoever started it closed their tab: anyone can pick the same task up -->
              <v-btn
                v-if="isStale(track.stemJob) && splitting !== index"
                size="small"
                variant="text"
                text="Resume"
                @click="startSplit(song, index, track.stemJob.requested, track.stemJob)"
              />
              <v-btn v-if="isStale(track.stemJob)" size="small" variant="text" text="Give up" @click="clearJob(song, index)" />
            </template>

            <v-btn
              v-else
              size="small"
              variant="text"
              :prepend-icon="track.stems?.length ? 'fas fa-plus' : 'fas fa-wave-square'"
              :text="track.stems?.length ? 'Add stems' : 'Split into stems'"
              :loading="splitting === index"
              @click="splitIndex = index"
            />
            <v-btn
              v-if="track.stems?.length && !track.stemJob"
              size="small"
              variant="text"
              color="error"
              text="Drop stems"
              @click="dropStems(song, index)"
            />

            <v-spacer />
            <span v-if="track.analysis?.bpm || track.analysis?.key" class="text-caption text-grey">
              recording:
              <template v-if="track.analysis.bpm">{{ Math.round(track.analysis.bpm) }} BPM</template>
              <template v-if="track.analysis.bpm && track.analysis.key"> - </template>
              {{ track.analysis.key }}
            </span>
          </div>

          <v-alert v-if="track.stemJob?.error" type="error" density="compact" variant="tonal" class="mt-2">
            {{ track.stemJob.error }}
          </v-alert>

          <template #append>
            <v-btn icon="fas fa-trash" variant="text" color="error" density="comfortable" @click="removeAudioTrack(song, index)" />
          </template>
        </v-list-item>
      </v-list>

      <StemSplitDialog
        v-if="splitIndex !== null && song.audioTracks?.[splitIndex]"
        v-model="splitDialog"
        :track="song.audioTracks[splitIndex]"
        @split="(requested) => startSplit(song, splitIndex!, requested)"
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
