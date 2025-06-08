<script setup lang="ts">
import Backbutton from '@/components/Backbutton.vue'
import SongListItem from '@/components/SongListItem.vue'
import { getSongInformation } from '@/helpers'
import AppLayout from '@/layouts/AppLayout.vue'
import { setlistCollection, songCollection } from '@/plugins/firebase'
import { HOME_ROUTE } from '@/router'
import { doc } from 'firebase/firestore'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useCollection, useDocument } from 'vuefire'

const route = useRoute()
const setlistId = route.params.id as string

const setlistData = useDocument(doc(setlistCollection, setlistId))

const songsCollection = useCollection(songCollection)

const songs = computed(() =>
  (setlistData.data.value?.songs || []).map((id) => songsCollection.value.find((s) => s.id == id)!).filter((f) => f)
)

function print() {
  //print with hidden iframe
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  document.body.appendChild(iframe)
  if (iframe.contentDocument)
    iframe.contentDocument.body.innerHTML = `
    <html>
      <head>
        <title>${setlistData.data.value?.name}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
          }
          h1 {
            text-align: center;
            margin-bottom: 40px;
          }
          .song-list div {
            text-align: center;
            font-size: 22px;
            line-height: 2.5;
            font-weight: bold;
          }
          .song-list {
            display: flex;
            flex-direction: column;
            flex-wrap: wrap;
            align-items: center;
          }
        </style>
      </head>
      <body>
        <div style="height: 100vh;display: flex; flex-direction: column;justify-content: center;">
          <h1>${setlistData.data.value?.name} - Setlist</h1>
          <div class="song-list" style="height:0;flex:1;">
            ${songs.value
              .map(
                (song, index) =>
                  `<div>
                      <span style="font-size: 16px;font-weight:normal">
                      ${index + 1}.
                      </span>
                      ${song.name}
                      <span style="font-size: 16px;font-weight:normal">
                        ${getSongInformation(song)}
                      </span>
                  </div>`
              )
              .join('')}
          </div>
        </div>
      </body>
    </html>
  `
  iframe.contentWindow?.print()
  document.body.removeChild(iframe)
}
</script>

<template>
  <AppLayout>
    <h2 class="d-flex justify-space-between">
      <div>
        <Backbutton :to="HOME_ROUTE" />
        {{ setlistData?.name }}
      </div>
      <div>
        <v-btn color="primary" @click="print" class="ms-2"> Print </v-btn>
      </div>
    </h2>
    <div class="w-100 d-flex justify-center">
      <v-list density="compact">
        <SongListItem v-for="(song, index) in songs" :index="index + 1" :song="song" />
      </v-list>
    </div>
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
