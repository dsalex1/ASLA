<script setup lang="ts">
import Backbutton from '@/components/Backbutton.vue'
import OfflineToggle from '@/components/OfflineToggle.vue'
import { useAccess } from '@/composables/useAccess'
import SongListItem from '@/components/SongListItem.vue'
import { isSongCached, useOfflinePins } from '@/composables/useOfflinePins'
import { getSongInformation } from '@/helpers'
import AppLayout from '@/layouts/AppLayout.vue'
import { setlistCollection, songCollection } from '@/plugins/firebase'
import { HOME_ROUTE } from '@/router'
import { doc } from 'firebase/firestore'
import { computed, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useCollection, useDocument } from 'vuefire'

const route = useRoute()
const setlistId = route.params.id as string

const setlistData = useDocument(doc(setlistCollection, setlistId))

const songsCollection = useCollection(songCollection)

const songs = computed(() =>
  (setlistData.data.value?.songs || [])
    .map((entry) => (typeof entry === 'string' ? songsCollection.value.find((s) => s.id == entry)! : entry))
    .filter((f) => f)
)

const { isAdmin } = useAccess()

// only once it has loaded: until then it is not empty, it is unknown
const empty = computed(() => !!setlistData.data.value && !setlistData.data.value.songs?.length)

const { isPinned } = useOfflinePins()

// only the gaps are worth showing, and only once the setlist is meant to be on the device
const availability = ref<boolean[]>([])
watchEffect(async () => {
  const pinned = isPinned(setlistId)
  const entries = songs.value
  availability.value = pinned ? await Promise.all(entries.map((s) => 'title' in s || isSongCached(s))) : []
})

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
        <div style="height: 100%;display: flex; flex-direction: column;justify-content: center;">
          <h1>${setlistData.data.value?.name} - Setlist</h1>
          <div class="song-list" style="height:0;flex:1;">
            ${songs.value
              .map(
                (song, index) =>
                  `<div>
                      <span style="font-size: 16px;font-weight:normal">
                      ${index + 1}.
                      </span>
                      ${'name' in song ? song.name : 'title' in song ? song.title : ''}
                      <span style="font-size: 16px;font-weight:normal">
                        ${'name' in song ? getSongInformation(song) : 'title' in song ? song.description : ''}
                      </span>
                  </div>`
              )
              .join('')}
          </div>
        </div>
      </body>
    </html>
  `

  iframe.contentWindow?.focus()
  iframe.contentWindow?.print()
}
</script>

<template>
  <AppLayout>
    <h2 class="d-flex flex-wrap align-center ga-2">
      <div>
        <Backbutton :to="HOME_ROUTE" />
      </div>
      <div style="flex: 1; min-width: 0">
        {{ setlistData?.name }}
      </div>
      <div class="d-flex align-center flex-wrap justify-end ga-2">
        <OfflineToggle v-if="!empty" :setlist-id="setlistId" :songs="songs" labelled />
        <v-btn v-if="!empty" color="primary" prepend-icon="fas fa-print" @click="print">Print</v-btn>
        <v-btn v-if="isAdmin" :to="`/setlist/${setlistId}/edit`" color="primary" variant="tonal" prepend-icon="fas fa-edit">
          Edit
        </v-btn>
      </div>
    </h2>
    <div v-if="empty" class="empty-setlist">
      <v-icon icon="fas fa-music" size="48" class="mb-4" />
      <div class="text-h6 mb-1">No songs yet</div>
      <template v-if="isAdmin">
        <div class="text-body-2 mb-4">Edit the setlist to add songs to it.</div>
        <v-btn :to="`/setlist/${setlistId}/edit`" color="primary" prepend-icon="fas fa-plus">Add songs</v-btn>
      </template>
      <div v-else class="text-body-2">An admin has not added any songs to this setlist yet.</div>
    </div>
    <div v-else class="w-100 d-flex justify-center">
      <v-list density="compact">
        <template v-for="(song, index) in songs">
          <SongListItem :index="index + 1" :song="song" :offline="availability[index]" />
        </template>
      </v-list>
    </div>
  </AppLayout>
</template>

<style scoped lang="scss">
.empty-setlist {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 64px auto;
  max-width: 360px;
  text-align: center;
  color: rgba(0, 0, 0, 0.6);
}
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
