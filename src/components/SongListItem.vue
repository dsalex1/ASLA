<script setup lang="ts">
import { getSongInformation } from '@/helpers'
import { CustomSetlistEntry, Song } from '@/types'

defineProps<{
  index: number
  song: Song | CustomSetlistEntry
  draggable?: boolean
  removeable?: boolean
}>()

defineEmits<{
  (e: 'remove'): void
}>()

function formatDuration(duration?: number) {
  return duration ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : ''
}
</script>

<template>
  <v-list-item color="primary">
    <div class="d-flex align-center" v-if="song && 'name' in song">
      <v-chip style="width: 32px" class="justify-center me-2">{{ index }}</v-chip>
      <div class="d-inline-flex flex-wrap">
        <div class="me-1">{{ song?.name }}</div>
        <div class="text-grey me-2" v-html="getSongInformation(song)" />
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
      <span v-if="song && 'name' in song && song.duration" class="bg-grey text-white rounded px-1">
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
