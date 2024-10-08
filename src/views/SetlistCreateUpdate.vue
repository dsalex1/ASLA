<script setup lang="ts">
import Backbutton from '@/components/Backbutton.vue'
import FileSelector from '@/components/FileSelector.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { useSheetBaseDirectory } from '@/plugins/sheetBaseDirectory'
import { HOME_ROUTE } from '@/router'

import { getStorage, ref as firebaseRef, uploadBytes } from 'firebase/storage'

import { setlistCollection, songCollection, withoutFields } from '@/plugins/firebase'
import { Setlist } from '@/types'
import { addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { ref, watch } from 'vue'

import { useRoute, useRouter } from 'vue-router'
import { useCollection, useDocument } from 'vuefire'
import { flatTree } from '@/helpers'

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

        //upload file to firebase storage and save reference in the song doc
        if (!songDoc.pdfStorageRef) {
          const file = await uploadFile(
            flatTree(pdfTree.value).find((f) => f.name == filename)!.handle as FileSystemFileHandle,
            songDoc.id!
          )
          await updateDoc(doc(songCollection, songDoc.id!), { filename: filename, pdfStorageRef: file.fullPath })
        }
      })
    )

    const updatedSetlist = {
      ...withoutFields(setlist.value, 'id', 'songs'),
      songs: currentSongs.value.map((filename) => songsDocs.value.find((doc) => doc.filename == filename)!.id!),
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

async function uploadFile(file: FileSystemFileHandle, folder: string) {
  const storage = getStorage()
  const fileRef = firebaseRef(storage, folder + '/' + file.name)
  await uploadBytes(fileRef, await file.getFile(), {
    customMetadata: {
      originalFileName: file.name,
    },
  })
  return fileRef
}
</script>

<template>
  <AppLayout>
    <h2 class="d-flex justify-space-between">
      <div>
        <Backbutton :to="HOME_ROUTE" />
        {{ formMode == 'create' ? 'Create' : 'Update' }} Setlist
      </div>
      <div>
        <v-btn v-if="formMode == 'edit'" @click="deleteSetlist" color="error" class="ms-2" prepend-icon="fas fa-trash">
          Delete
        </v-btn>
        <v-btn :loading="loading" color="primary" @click="createSetlist" class="ms-2">
          {{ formMode == 'create' ? 'Create' : 'Update' }}
        </v-btn>
      </div>
    </h2>
    <v-text-field v-model="setlist.name" label="Name" />
    <FileSelector v-model="currentSongs" :files="pdfTree" />
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
