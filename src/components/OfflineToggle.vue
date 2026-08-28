<script setup lang="ts">
import { useOfflinePins } from '@/composables/useOfflinePins'
import { CustomSetlistEntry, Song } from '@/types'
import { useOnline } from '@vueuse/core'
import { computed, ref } from 'vue'

const props = defineProps<{
  setlistId: string
  songs: (Song | CustomSetlistEntry)[]
  /** the list view has room for a word, the overview has room for the whole story */
  labelled?: boolean
}>()

const { isPinned, pin, unpin, progress } = useOfflinePins()
const online = useOnline()
const error = ref('')

const pinned = computed(() => isPinned(props.setlistId))
const busy = computed(() => progress.value?.setlistId === props.setlistId)
const percent = computed(() =>
  progress.value?.total ? (progress.value.done / progress.value.total) * 100 : 0
)

const realSongs = computed(() => props.songs.filter((song): song is Song => !('title' in song)))

/**
 * On iOS everything a site stores is deleted after seven days without a visit, unless the
 * app was added to the home screen — which makes installing a precondition for this
 * feature rather than a nicety.
 */
const needsInstall = computed(() => {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))
  const installed =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return ios && !installed
})

async function run(action: () => Promise<void>) {
  error.value = ''
  try {
    await action()
  } catch (e) {
    error.value = (e as Error).message
  }
}

const download = () => run(() => pin(props.setlistId, realSongs.value))
const remove = () => run(() => unpin(props.setlistId))
</script>

<template>
  <div>
    <div class="d-flex align-center ga-1">
      <v-btn
        v-if="!pinned"
        :disabled="!online || busy"
        :loading="busy"
        color="success"
        variant="text"
        density="comfortable"
        prepend-icon="fas fa-download"
        :title="online ? 'Keep this setlist on the device' : 'Connect to download this setlist'"
        @click="download"
      >
        {{ labelled ? 'make available offline' : 'offline' }}
      </v-btn>
      <template v-else>
        <v-chip size="small" color="success" variant="tonal" prepend-icon="fas fa-circle-check">offline</v-chip>
        <v-btn
          :disabled="!online || busy"
          :loading="busy"
          variant="text"
          density="comfortable"
          icon="fas fa-rotate"
          title="Download anything that changed"
          @click="download"
        />
        <v-btn
          :disabled="busy"
          variant="text"
          density="comfortable"
          icon="fas fa-trash"
          title="Remove the offline copy"
          @click="remove"
        />
      </template>
    </div>

    <v-progress-linear v-if="busy" :model-value="percent" color="success" height="4" class="mt-1" />
    <div v-if="busy" class="text-caption text-medium-emphasis">
      {{ progress?.done }} / {{ progress?.total }} files
    </div>

    <div v-if="error" class="text-caption text-error mt-1">{{ error }}</div>
    <div v-if="pinned && needsInstall" class="text-caption text-warning mt-1">
      Add this app to your home screen, or iOS deletes the offline copy after a week.
    </div>
  </div>
</template>
