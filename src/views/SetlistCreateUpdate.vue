<script setup lang="ts">
import Backbutton from '@/components/Backbutton.vue'
import FileSelector from '@/components/FileSelector.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { useSheetBaseDirectory } from '@/plugins/sheetBaseDirectory'
import { HOME_ROUTE } from '@/router'

import { ref as firebaseRef, getStorage } from 'firebase/storage'

import { folderCollection, setlistCollection, songCollection, withoutFields } from '@/plugins/firebase'
import { CustomSetlistEntry, Setlist, Song } from '@/types'
import { addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { computed, ref, watch } from 'vue'

import { flatTree } from '@/helpers'
import { sha, uploadHashed } from '@/helpers/contentHash'
import { pruneHashes } from '@/helpers/songRefs'
import { useRoute, useRouter } from 'vue-router'
import { useCollection, useDocument } from 'vuefire'

const songsDocs = useCollection(songCollection)

const route = useRoute()
const router = useRouter()
const setlistId = route.params.id as string
const formMode = setlistId ? 'edit' : 'create'

const setlistDocRef = setlistId ? doc(setlistCollection, setlistId) : null
const setlistData = setlistId ? useDocument(setlistDocRef) : null

if (setlistData)
  watch(setlistData, (data) => {
    if (!data) return
    setlist.value = data
    currentSongs.value = data.songs.map((song) =>
      typeof song === 'string' ? songsDocs.value.find((doc) => doc.id == song)!.filename : song
    )
  })

const setlist = ref<Omit<Setlist, 'songs'>>({
  id: '',
  name: '',
})

const currentSongs = ref<(string | CustomSetlistEntry)[]>([])

const error = ref('')
const loading = ref(false)
async function createSetlist() {
  error.value = ''
  loading.value = true
  try {
    //make sure all songs in the setlist are synced with the database before saving
    await Promise.all(
      currentSongs.value.map(async (filename) => {
        if (typeof filename !== 'string') return // skip custom entries
        // if the song is not in the database, identified by filename
        if (!songsDocs.value.find((doc) => doc.filename == filename))
          await addDoc(songCollection, { filename: filename, name: filename })
        const songDoc = songsDocs.value.find((doc) => doc.filename == filename)!

        const fileHandle = flatTree(pdfTree.value).find((f) => f.name == filename)?.handle as FileSystemFileHandle
        const fileSha = await sha(new Uint8Array(await (await fileHandle?.getFile())?.arrayBuffer()), 64)
        //upload file to firebase storage and save reference in the song doc
        if (fileHandle && (!songDoc.pdfStorageRef || songDoc.pdfStorageSHA != fileSha)) {
          console.log('Uploading file', filename)
          const fileToUpload = await fileHandle.getFile()
          const { fileRef, hash } = await uploadFile(fileHandle, fileToUpload)
          const hashes: Record<string, string> = { [fileRef.fullPath]: hash }

          // Generate WebP Images
          const imageRefs: string[] = []
          try {
            const { generateWebPImagesFromPdf } = await import('@/helpers/pdfGenerator')
            const blobs = await generateWebPImagesFromPdf(fileToUpload)
            const storage = getStorage()
            for (let i = 0; i < blobs.length; i++) {
              const imgRef = firebaseRef(storage, `sheet_images/${songDoc.id || fileToUpload.name}_page_${i + 1}.webp`)
              hashes[imgRef.fullPath] = await uploadHashed(imgRef, blobs[i], { contentType: 'image/webp' })
              imageRefs.push(imgRef.fullPath)
            }
          } catch (err) {
            console.error('Failed to generate WebP for local file:', err)
          }

          const updated = {
            filename: filename,
            pdfStorageRef: fileRef.fullPath,
            pdfStorageSHA: fileSha,
            pdfImageStorageRefs: imageRefs,
            hashes: { ...songDoc.hashes, ...hashes },
          }
          // drop hashes of pages this pdf no longer has
          const merged = { ...songDoc, ...updated } as Song
          pruneHashes(merged)
          await updateDoc(doc(songCollection, songDoc.id!), { ...updated, hashes: merged.hashes })
        }
      })
    )

    const updatedSetlist = {
      ...withoutFields(setlist.value, 'id', 'songs'),
      songs: currentSongs.value.map((filenameOrCustom) =>
        typeof filenameOrCustom === 'string'
          ? songsDocs.value.find((doc) => doc.filename == filenameOrCustom)!.id!
          : filenameOrCustom
      ),
      updatedAt: new Date().toISOString(),
    }

    if (formMode == 'create') await addDoc(setlistCollection, updatedSetlist)
    else await updateDoc(setlistDocRef!, updatedSetlist)

    router.push(`/setlist`)
  } catch (e) {
    console.error(e)
    error.value = 'An unknown error occurred.'
  }
  loading.value = false
}

async function deleteSetlist() {
  if (!setlistId) return

  if (!window.confirm(`Are you sure you want to delete the setlist "${setlist.value.name || 'Untitled'}"?`)) return

  error.value = ''
  loading.value = true
  try {
    await deleteDoc(setlistDocRef!)
    router.push(`/setlist`)
  } catch (e) {
    console.error(e)
    error.value = 'An unknown error occurred.'
  }
  loading.value = false
}

const { pdfTree } = useSheetBaseDirectory()

async function uploadFile(fileHandle: FileSystemFileHandle, fileData?: File) {
  const storage = getStorage()
  const fileRef = firebaseRef(storage, fileHandle.name) // folder + '/' +
  const actualFile = fileData || (await fileHandle.getFile())
  const hash = await uploadHashed(fileRef, actualFile, { customMetadata: { originalFileName: actualFile.name } })
  return { fileRef, hash }
}
const songs = useCollection(songCollection)
const folders = useCollection(folderCollection)

// folder tree for the picker when no local sheet directory is selected:
// folders (alphabetical) with their songs (alphabetical), then loose songs (alphabetical)
const folderTree = computed(() => {
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
  const songsIn = (folderId: string | null) =>
    songs.value
      .filter((s) => (s.folderId ?? null) === folderId)
      .map((s) => ({ name: s.filename }))
      .sort(byName)
  return [
    ...[...folders.value]
      .sort(byName)
      .map((f) => ({ name: f.name, children: songsIn(f.id!) }))
      .filter((f) => f.children.length > 0),
    ...songsIn(null),
  ]
})
</script>

<template>
  <AppLayout>
    <h2 class="d-flex">
      <Backbutton :to="HOME_ROUTE" />
      <div style="flex: 1">{{ formMode == 'create' ? 'Create' : 'Update' }} Setlist</div>
      <div class="d-flex flex-wrap justify-end ga-3">
        <v-btn v-if="formMode == 'edit'" @click="deleteSetlist" color="error" class="ms-2" prepend-icon="fas fa-trash">
          Delete
        </v-btn>
        <v-btn :loading="loading" color="primary" @click="createSetlist" prepend-icon="fas fa-save" class="ms-2 mb-2">
          {{ formMode == 'create' ? 'Create' : 'Update' }}
        </v-btn>
      </div>
    </h2>
    <v-text-field v-model="setlist.name" label="Name" />
    <FileSelector v-model="currentSongs" :files="pdfTree.length > 0 ? pdfTree : folderTree" :open-all="pdfTree.length === 0" />
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
