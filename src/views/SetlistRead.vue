<script setup lang="ts">
import Backbutton from '@/components/Backbutton.vue'
import FileViewer from '@/components/FileViewer.vue'
import FullscreenLayout from '@/layouts/FullscreenLayout.vue'
import { setlistCollection, songCollection } from '@/plugins/firebase'
import { HOME_ROUTE } from '@/router'
import { doc } from 'firebase/firestore'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useCollection, useDocument } from 'vuefire'

const route = useRoute()
const setlistId = route.params.id as string

const lyricsOnly = route.query.lyricsOnly

const setlistData = useDocument(doc(setlistCollection, setlistId))

const songs = useCollection(songCollection)

const selectedFiles = computed(() =>
  (setlistData.data.value?.songs || []).map((id) => songs.value.find((s) => s.id == id)!).filter((f) => f)
)
</script>

<template>
  <FullscreenLayout>
    <FileViewer :songs="selectedFiles" :disable-sheets="!!lyricsOnly">
      <h2>
        <Backbutton :to="HOME_ROUTE" />
        Setlist
      </h2>
    </FileViewer>
  </FullscreenLayout>
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
