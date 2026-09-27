<script setup lang="ts">
import { useAccess } from '@/composables/useAccess'
import { setlistCollection, songCollection } from '@/plugins/firebase'
import { ViewMode } from '@/types'
import { getDocs } from 'firebase/firestore'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { APP_TOUR, AUDIO_TOUR, SHEETS_TOUR, Tour, triggerOf } from './tours'
import { useTour } from './useTour'

/** the ? in the top bar: where every guide can be had again */
const tour = useTour()
const router = useRouter()
const { canSeeSetlist } = useAccess()
const notice = ref('')

/** the player's and the sheets' guides need their screen: off it, a setlist is opened in that
 * view and the guide starts once it is up */
async function screenGuide(guide: Tour, mode: ViewMode) {
  if (triggerOf(guide)) return tour.start(guide.id)
  const setlists = (await getDocs(setlistCollection)).docs.filter((d) => canSeeSetlist(d.id))
  // the player needs a track to show: open a set whose first song has one, if there is such a set
  const withAudio =
    mode === 'audio'
      ? new Set((await getDocs(songCollection)).docs.filter((d) => d.data().audioTracks?.length).map((d) => d.id))
      : null
  const setlist = setlists.find((d) => !withAudio || withAudio.has(d.data().songs[0] as string)) ?? setlists[0]
  if (!setlist) return (notice.value = 'There is no setlist to show this guide on yet.')
  tour.startNextTime(guide.id)
  router.push({ path: `/setlist/${setlist.id}`, query: { mode } })
}
</script>

<template>
  <v-menu>
    <template #activator="{ props: menu }">
      <v-btn v-bind="menu" icon="fas fa-circle-question" color="white" variant="text" density="comfortable" aria-label="Help" title="Help" />
    </template>
    <v-list density="compact">
      <v-list-item prepend-icon="fas fa-compass" :title="APP_TOUR.title" @click="tour.start(APP_TOUR.id)" />
      <v-list-item prepend-icon="fas fa-file-lines" :title="SHEETS_TOUR.title" @click="screenGuide(SHEETS_TOUR, 'lyrics')" />
      <v-list-item prepend-icon="fas fa-headphones" :title="AUDIO_TOUR.title" @click="screenGuide(AUDIO_TOUR, 'audio')" />
    </v-list>
  </v-menu>
  <v-snackbar :model-value="!!notice" :timeout="5000" @update:model-value="(open) => open || (notice = '')">
    {{ notice }}
  </v-snackbar>
</template>
