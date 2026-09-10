<script setup lang="ts">
import { getSongInformation } from '@/helpers'
import { CustomSetlistEntry, Song } from '@/types'

defineProps<{
  index: number
  song: Song | CustomSetlistEntry
  draggable?: boolean
  removeable?: boolean
  /** false marks a song the pinned offline copy does not cover; undefined shows nothing */
  offline?: boolean
}>()

defineEmits<{
  (e: 'remove'): void
}>()

function formatDuration(duration?: number) {
  return duration ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : ''
}
</script>

<template>
  <v-list-item color="primary" class="song-list-item">
    <div class="d-flex align-center" v-if="song && 'name' in song">
      <v-chip style="width: 32px" class="justify-center me-2 flex-shrink-0">{{ index }}</v-chip>
      <div class="song-details d-inline-flex flex-wrap">
        <div class="me-1">{{ song?.name }}</div>
        <div class="song-information text-grey me-2" v-html="getSongInformation(song)" />
        <span v-if="song.duration" class="song-duration d-sm-none bg-grey text-white rounded px-1">{{ formatDuration(song.duration) }}</span>
      </div>
    </div>
    <slot>
      <div class="d-flex align-center" v-if="song && 'title' in song">
        <v-chip style="width: 32px" class="justify-center me-2">{{ index }}</v-chip>
        <div class="d-inline-flex flex-wrap">
          <div class="me-1">{{ song?.title }}</div>
          <div class="text-grey me-2">{{ song?.description }}</div>
        </div>
      </div>
    </slot>
    <template v-slot:append>
      <v-icon
        v-if="offline === false"
        icon="fas fa-cloud-arrow-down"
        size="x-small"
        color="warning"
        class="me-2 d-none d-sm-inline-flex"
        title="Not available offline"
      />
      <span v-if="song && 'name' in song && song.duration" class="d-none d-sm-inline-block bg-grey text-white rounded px-1">
        <v-icon size="sm" icon="far fa-clock mb-1 " />
        {{ formatDuration(song.duration) }}
      </span>
      <v-btn
        v-if="removeable"
        class="me-n3"
        @click="$emit('remove')"
        icon="fas fa-close"
        variant="plain"
        style="height: 32px"
      />
      <v-btn v-if="draggable" class="drag-handle me-n3" icon="fas fa-grip" variant="plain" style="height: 32px" />
    </template>
  </v-list-item>
</template>

<style scoped>
.song-details {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.song-duration {
  white-space: nowrap;
  align-self: center;
}
@media (max-width: 599px) {
  .song-details { display: grid !important; grid-template-columns: minmax(0, 1fr) auto; column-gap: 4px; }
  .song-information { grid-column: 1 / -1; grid-row: 2; }
  .song-duration { grid-column: 2; grid-row: 1; align-self: start; }
  .song-list-item { padding-inline: 8px; }
  .song-list-item :deep(.v-list-item__spacer) { width: 4px; }
  .song-list-item :deep(.v-btn) { width: 36px; margin-inline-end: 0 !important; }
}
</style>
