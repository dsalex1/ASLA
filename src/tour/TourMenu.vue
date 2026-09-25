<script setup lang="ts">
import { ref } from 'vue'
import { AUDIO_TOUR, APP_TOUR } from './tours'
import { useTour } from './useTour'

/** the ? in the top bar: where either guide can be had again */
const tour = useTour()
const notice = ref(false)

/** the player's guide needs the player: off it, it waits for the next song opened in audio */
function audioGuide() {
  if (document.querySelector(AUDIO_TOUR.trigger)) return tour.start(AUDIO_TOUR.id)
  tour.startNextTime(AUDIO_TOUR.id)
  notice.value = true
}
</script>

<template>
  <v-menu>
    <template #activator="{ props: menu }">
      <v-btn v-bind="menu" icon="fas fa-circle-question" color="white" variant="text" density="comfortable" aria-label="Help" title="Help" />
    </template>
    <v-list density="compact">
      <v-list-item prepend-icon="fas fa-compass" :title="APP_TOUR.title" @click="tour.start(APP_TOUR.id)" />
      <v-list-item prepend-icon="fas fa-headphones" :title="AUDIO_TOUR.title" @click="audioGuide" />
    </v-list>
  </v-menu>
  <v-snackbar v-model="notice" :timeout="5000">
    The audio guide will start when you next open a song in Audio mode.
  </v-snackbar>
</template>
