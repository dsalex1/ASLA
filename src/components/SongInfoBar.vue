<script setup lang="ts">
import { formatDuration, getSongInformation } from '@/helpers'
import { Song, ViewMode } from '@/types'

const props = defineProps<{
  song: Song
  mode?: ViewMode
  annotatable?: boolean
  transpose: number
  showLyrics: boolean
  canAnnotate: boolean
  annotLoading?: boolean
  bpm: number
  clicking: boolean
}>()

const shallShowLyrics = defineModel<boolean>('shallShowLyrics', { required: true })
const fontSize = defineModel<number>('fontSize', { required: true })
const autoScroll = defineModel<boolean>('autoScroll', { required: true })

defineEmits<{
  (e: 'annotate'): void
  (e: 'toggleClick'): void
  (e: 'transpose', delta: number): void
}>()

const formatTranspose = (n: number) => (n > 0 ? `+${n}` : `${n}`)
// chords can only be edited on the chord view of an annotatable song
const editingChords = () => props.annotatable && props.mode == 'chords' && !shallShowLyrics.value && props.song.lyrics
</script>

<template>
  <div class="w-100 text-center">
    <span v-html="getSongInformation(song)" />
    <span v-if="song.duration">
      -
      <v-icon size="sm" icon="far fa-clock mb-1 " />
      {{ formatDuration(song.duration) }}
    </span>
    <v-chip v-if="mode == 'chords' && !annotatable && transpose" class="ms-2" size="small" color="primary">
      <v-icon start size="x-small" icon="fas fa-music" />
      {{ formatTranspose(transpose) }}
    </v-chip>
    <v-btn
      v-if="song.lyrics && mode != 'lyrics'"
      class="ms-2"
      variant="tonal"
      density="compact"
      prepend-icon="fas fa-file-lines"
      @click="shallShowLyrics = !shallShowLyrics"
    >
      {{ shallShowLyrics ? 'Sheets' : 'Lyrics' }}
    </v-btn>
    <v-btn
      v-if="annotatable && canAnnotate && !showLyrics"
      class="ms-2"
      variant="tonal"
      density="compact"
      icon="fas fa-pen"
      :loading="annotLoading"
      @click="$emit('annotate')"
    />
    <v-btn
      v-if="mode == 'drums' && bpm"
      class="ms-2"
      variant="tonal"
      density="compact"
      :color="clicking ? 'primary' : undefined"
      :prepend-icon="clicking ? 'fas fa-pause' : 'fas fa-drum'"
      @click="$emit('toggleClick')"
    >
      {{ bpm }} BPM
    </v-btn>
    <template v-if="showLyrics">
      <template v-if="editingChords()">
        <v-btn
          class="ms-2"
          variant="tonal"
          density="compact"
          icon="fas fa-arrow-down"
          :disabled="transpose <= -11"
          @click="$emit('transpose', -1)"
        />
        <span class="mx-2">{{ formatTranspose(transpose) }}</span>
        <v-btn
          variant="tonal"
          density="compact"
          icon="fas fa-arrow-up"
          :disabled="transpose >= 11"
          @click="$emit('transpose', 1)"
        />
      </template>
      <v-btn class="ms-2" variant="tonal" density="compact" icon="fas fa-minus" @click="fontSize = Math.max(12, fontSize - 2)" />
      <span class="mx-2">{{ fontSize }}</span>
      <v-btn class="me-2" variant="tonal" density="compact" icon="fas fa-plus" @click="fontSize = Math.min(48, fontSize + 2)" />
      <v-btn
        v-if="mode != 'audio'"
        class="ms-2"
        variant="tonal"
        density="compact"
        :icon="autoScroll ? 'fas fa-pause' : 'fas fa-play'"
        @click="autoScroll = !autoScroll"
      />
    </template>
  </div>
</template>
