<script setup lang="ts">
import Backbutton from '@/components/Backbutton.vue'
import FileViewer from '@/components/FileViewer.vue'
import SongEdit from '@/components/SongEdit.vue'
import FullscreenLayout from '@/layouts/FullscreenLayout.vue'
import { songCollection } from '@/plugins/firebase'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCollection } from 'vuefire'

const route = useRoute()
const router = useRouter()
const editDialogOpen = ref(false)

const songId = computed(() => route.params.id as string)
const displayMode = route.query.mode as 'lyrics' | 'chords' | 'drums'

const songsCollection = useCollection(songCollection)

const currentSong = computed(() => songsCollection.value.find((s) => s.id === songId.value))

const songs = computed(() => (currentSong.value ? [currentSong.value] : []))
</script>

<template>
  <FullscreenLayout>
    <FileViewer :songs="songs" :mode="displayMode">
      <h2>
        <Backbutton to="/song" />
        Song
        <v-btn
          v-if="currentSong"
          icon="fas fa-pen"
          size="small"
          variant="text"
          @click="editDialogOpen = true"
        />
      </h2>
    </FileViewer>
    <v-dialog v-model="editDialogOpen" max-width="800px" scrollable>
      <SongEdit v-if="currentSong" :song="currentSong" @close="editDialogOpen = false" @deleted="router.push('/song')" />
    </v-dialog>
  </FullscreenLayout>
</template>
