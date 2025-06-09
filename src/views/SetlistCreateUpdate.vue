<script setup lang="ts">
import Backbutton from '@/components/Backbutton.vue'
import FileSelector from '@/components/FileSelector.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { useSheetBaseDirectory } from '@/plugins/sheetBaseDirectory'
import { HOME_ROUTE } from '@/router'

import { ref as firebaseRef, getStorage, uploadBytes } from 'firebase/storage'

import { setlistCollection, songCollection, withoutFields } from '@/plugins/firebase'
import { Setlist } from '@/types'
import { addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { ref, watch } from 'vue'

import { flatTree } from '@/helpers'
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
    currentSongs.value = data.songs.map((songId: string) => songsDocs.value.find((doc) => doc.id == songId)!.filename)
  })

const setlist = ref<Omit<Setlist, 'songs'>>({
  id: '',
  name: '',
})

const currentSongs = ref<string[]>([])

function arbuf2hex(buffer: ArrayBuffer) {
  var hexCodes = []
  var view = new DataView(buffer)
  for (var i = 0; i < view.byteLength; i += 4) {
    // Using getUint32 reduces the number of iterations needed (we process 4 bytes each time)
    var value = view.getUint32(i)
    // toString(16) will give the hex representation of the number without padding
    var stringValue = value.toString(16)
    // We use concatenation and slice for padding
    var padding = '00000000'
    var paddedValue = (padding + stringValue).slice(-padding.length)
    hexCodes.push(paddedValue)
  }

  // Join all the hex strings into one
  return hexCodes.join('')
}

const error = ref('')
const loading = ref(false)
async function createSetlist() {
  error.value = ''
  loading.value = true
  try {
    //make sure all songs in the setlist are synced with the database before saving
    await Promise.all(
      currentSongs.value.map(async (filename) => {
        // if the song is not in the database, identified by filename
        if (!songsDocs.value.find((doc) => doc.filename == filename))
          await addDoc(songCollection, { filename: filename, name: filename })
        const songDoc = songsDocs.value.find((doc) => doc.filename == filename)!

        const fileHandle = flatTree(pdfTree.value).find((f) => f.name == filename)?.handle as FileSystemFileHandle
        const fileSha = arbuf2hex(
          await window.crypto.subtle.digest(
            'SHA-256',
            new Uint8Array(await (await fileHandle?.getFile())?.arrayBuffer())
          )
        )
        //upload file to firebase storage and save reference in the song doc
        if (fileHandle && (!songDoc.pdfStorageRef || songDoc.pdfStorageSHA != fileSha)) {
          console.log('Uploading file', filename)
          const file = await uploadFile(fileHandle)
          await updateDoc(doc(songCollection, songDoc.id!), {
            filename: filename,
            pdfStorageRef: file.fullPath,
            pdfStorageSHA: fileSha,
          })
        }
      })
    )

    const updatedSetlist = {
      ...withoutFields(setlist.value, 'id', 'songs'),
      songs: currentSongs.value.map((filename) => songsDocs.value.find((doc) => doc.filename == filename)!.id!),
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

async function uploadFile(file: FileSystemFileHandle) {
  const storage = getStorage()
  const fileRef = firebaseRef(storage, file.name) // folder + '/' +
  await uploadBytes(fileRef, await file.getFile(), {
    customMetadata: {
      originalFileName: file.name,
    },
  })
  return fileRef
}
const songs = useCollection(songCollection)
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
    <FileSelector
      v-model="currentSongs"
      :files="pdfTree.length > 0 ? pdfTree : songs.map((s) => ({ name: s.filename }))"
    />
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
