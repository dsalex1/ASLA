<script setup lang="ts">
import { ref } from 'vue'
import { APP_TOUR, AUDIO_TOUR, SHEETS_TOUR, Tour, triggerOf } from './tours'
import { useTour } from './useTour'

/** the ? in the top bar: where every guide can be had again */
const tour = useTour()
const notice = ref('')

/** the player's and the sheets' guides need their screen: off it, they wait for it to open */
function screenGuide(guide: Tour, where: string) {
  if (triggerOf(guide)) return tour.start(guide.id)
  tour.startNextTime(guide.id)
  notice.value = `The guide will start when you next open a setlist in ${where}.`
}
</script>

<template>
  <v-menu>
    <template #activator="{ props: menu }">
      <v-btn v-bind="menu" icon="fas fa-circle-question" color="white" variant="text" density="comfortable" aria-label="Help" title="Help" />
    </template>
    <v-list density="compact">
      <v-list-item prepend-icon="fas fa-compass" :title="APP_TOUR.title" @click="tour.start(APP_TOUR.id)" />
      <v-list-item prepend-icon="fas fa-file-lines" :title="SHEETS_TOUR.title" @click="screenGuide(SHEETS_TOUR, 'Lyrics, Chords or Drums')" />
      <v-list-item prepend-icon="fas fa-headphones" :title="AUDIO_TOUR.title" @click="screenGuide(AUDIO_TOUR, 'Audio mode')" />
    </v-list>
  </v-menu>
  <v-snackbar :model-value="!!notice" :timeout="5000" @update:model-value="(open) => open || (notice = '')">
    {{ notice }}
  </v-snackbar>
</template>
