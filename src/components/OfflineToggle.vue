<script setup lang="ts">
import { useOfflinePins } from '@/composables/useOfflinePins'
import { CustomSetlistEntry, Song } from '@/types'
import { useOnline } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useDisplay } from 'vuetify'

const props = defineProps<{
  setlistId: string
  songs: (Song | CustomSetlistEntry)[]
  /** the overview has room to spell it out; the cards do not */
  labelled?: boolean
}>()

const { isPinned, pin, unpin, progress } = useOfflinePins()
const online = useOnline()
const { mobile } = useDisplay()
const error = ref('')

const pinned = computed(() => isPinned(props.setlistId))
const busy = computed(() => progress.value?.setlistId === props.setlistId)
const percent = computed(() => (progress.value?.total ? (progress.value.done / progress.value.total) * 100 : 0))
// a phone has no room for a word next to the title, which is what gets squeezed out first
const showText = computed(() => props.labelled && !mobile.value)

const realSongs = computed(() => props.songs.filter((song): song is Song => !('title' in song)))

/**
 * On iOS everything a site stores is deleted after seven days without a visit, unless the
 * app was added to the home screen — which makes installing a precondition for this
 * feature rather than a nicety.
 */
const needsInstall = computed(() => {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))
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
    <v-btn
      v-if="!pinned"
      :disabled="!online || busy"
      :loading="busy"
      color="success"
      variant="text"
      density="comfortable"
      :icon="showText ? undefined : 'fas fa-download'"
      :prepend-icon="showText ? 'fas fa-download' : undefined"
      :title="online ? 'Keep this setlist on the device' : 'Connect to download this setlist'"
      @click="download"
    >
      <template v-if="showText">make available offline</template>
    </v-btn>

    <!-- once it is on the device the state is the point, so the actions live behind it -->
    <v-menu v-else>
      <template #activator="{ props: activator }">
        <v-chip
          v-bind="activator"
          size="small"
          color="success"
          variant="tonal"
          class="cursor-pointer"
          prepend-icon="fas fa-circle-check"
          append-icon="fas fa-caret-down"
          :title="busy ? 'Working…' : 'Offline copy options'"
        >
          offline
        </v-chip>
      </template>
      <v-list density="compact">
        <v-list-item
          :disabled="!online || busy"
          prepend-icon="fas fa-rotate"
          title="Refresh"
          subtitle="Download anything that changed"
          @click="download"
        />
        <v-list-item
          :disabled="busy"
          prepend-icon="fas fa-trash"
          title="Remove"
          subtitle="Free the space it uses"
          @click="remove"
        />
      </v-list>
    </v-menu>

    <v-progress-linear v-if="busy" :model-value="percent" color="success" height="4" class="mt-1" />
    <div v-if="busy" class="text-caption text-medium-emphasis">{{ progress?.done }} / {{ progress?.total }} files</div>

    <div v-if="error" class="text-caption text-error mt-1">{{ error }}</div>
    <div v-if="pinned && needsInstall" class="text-caption text-warning mt-1">
      Add this app to your home screen, or iOS deletes the offline copy after a week.
    </div>
  </div>
</template>
