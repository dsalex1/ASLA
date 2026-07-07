<script setup lang="ts">
import Backbutton from '@/components/Backbutton.vue'
import FileViewer from '@/components/FileViewer.vue'
import FullscreenLayout from '@/layouts/FullscreenLayout.vue'
import { songCollection } from '@/plugins/firebase'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useCollection } from 'vuefire'

const route = useRoute()

const songId = computed(() => route.params.id as string)
const displayMode = route.query.mode as 'lyrics' | 'chords' | 'drums'

const songsCollection = useCollection(songCollection)

const currentSong = computed(() => songsCollection.value.find((s) => s.id === songId.value))

const songs = computed(() => (currentSong.value ? [currentSong.value] : []))
</script>

<template>
  <FullscreenLayout>
    <FileViewer :songs="songs" :mode="displayMode" annotatable>
      <h2>
        <Backbutton to="/song" />
        Song
      </h2>
    </FileViewer>
  </FullscreenLayout>
</template>
