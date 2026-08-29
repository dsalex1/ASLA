<script setup lang="ts">
import { formatDuration, getSongInformation } from '@/helpers'
import { transposeChord } from '@/helpers/lyrics'
import { PANE_VIEW_ICONS, PANE_VIEW_LABELS, PANE_VIEWS } from '@/helpers/paneViews'
import { PaneView, Song, ViewMode } from '@/types'
import { computed } from 'vue'

const props = defineProps<{
  song: Song
  mode?: ViewMode
  annotatable?: boolean
  transpose: number
  /** the view actually on screen, which is the chosen one unless it fell back */
  shown: PaneView
  available: Record<PaneView, boolean>
  canAnnotate: boolean
  /** saving an annotation uploads, which cannot be queued, so offline it is refused up front */
  annotateOffline?: boolean
  annotLoading?: boolean
  bpm: number
  clicking: boolean
}>()

/** this device's own offset on top of the song's transpose; see useCapo */
const capo = defineModel<number>('capo', { required: true })

const view = defineModel<PaneView>('view', { required: true })
const fontSize = defineModel<number>('fontSize', { required: true })
const autoScroll = defineModel<boolean>('autoScroll', { required: true })

const showLyrics = computed(() => props.shown == 'lyrics' || props.shown == 'chords')

// a short list reads at a glance, so the views this song has nothing for are left out
// rather than shown greyed; the switch in the audio pane keeps them in place, where the
// buttons are fixed positions you learn by muscle memory
const offered = computed(() => PANE_VIEWS.filter((v) => props.available[v]))
// the button keeps naming the view you picked, so it agrees with the switch in the audio
// pane; that the song had nothing for it is what the fallback's own hint is for

defineEmits<{
  (e: 'annotate'): void
  (e: 'toggleClick'): void
  (e: 'transpose', delta: number): void
}>()

const formatTranspose = (n: number) => (n > 0 ? `+${n}` : `${n}`)
// the transpose belongs to the song, so it can be changed wherever the chords are read;
// editing the chords themselves still needs the annotatable single-song view
const showingChords = () => props.shown == 'chords' && props.song.lyrics

/** what the chords come out in once both the song's transpose and this capo are applied */
const playedKey = computed(() =>
  props.song.key_signature ? transposeChord(props.song.key_signature, props.transpose - capo.value) : ''
)
</script>

<template>
  <div class="w-100 text-center">
    <span v-html="getSongInformation(song, false)" />
    <span v-if="song.duration">
      <template v-if="getSongInformation(song, false)">-</template>
      <v-icon size="sm" icon="far fa-clock mb-1 " />
      {{ formatDuration(song.duration) }}
    </span>
    <v-menu>
      <template #activator="{ props: menu }">
        <v-btn
          v-bind="menu"
          class="ms-2"
          variant="tonal"
          density="compact"
          :prepend-icon="PANE_VIEW_ICONS[view]"
          append-icon="fas fa-caret-down"
        >
          {{ PANE_VIEW_LABELS[view] }}
        </v-btn>
      </template>
      <v-list density="compact">
        <v-list-item
          v-for="v in offered"
          :key="v"
          :active="view == v"
          :prepend-icon="PANE_VIEW_ICONS[v]"
          :title="PANE_VIEW_LABELS[v]"
          @click="view = v"
        />
      </v-list>
    </v-menu>
    <v-btn
      v-if="annotatable && canAnnotate && !showLyrics"
      class="ms-2"
      variant="tonal"
      density="compact"
      icon="fas fa-pen"
      :loading="annotLoading"
      :disabled="annotateOffline"
      :title="annotateOffline ? 'Annotating needs a connection' : 'Annotate'"
      @click="$emit('annotate')"
    />
    <v-btn
      v-if="bpm"
      class="ms-2"
      :class="{ 'bpm-blink': clicking }"
      :style="clicking ? { animationDuration: 60 / bpm + 's' } : {}"
      variant="tonal"
      density="compact"
      :color="clicking ? 'primary' : undefined"
      :prepend-icon="clicking ? 'fas fa-pause' : 'fas fa-drum'"
      @click="$emit('toggleClick')"
    >
      {{ bpm }} BPM
    </v-btn>
    <template v-if="showLyrics">
      <!-- the song's key, shared with the band -->
      <template v-if="showingChords()">
        <v-btn
          class="ms-2"
          variant="tonal"
          density="compact"
          icon="fas fa-arrow-down"
          title="Transpose the song down, for everyone"
          :disabled="transpose <= -11"
          @click="$emit('transpose', -1)"
        />
        <span class="mx-2" title="The song's transpose, shared with the band">{{ formatTranspose(transpose) }}</span>
        <v-btn
          variant="tonal"
          density="compact"
          icon="fas fa-arrow-up"
          title="Transpose the song up, for everyone"
          :disabled="transpose >= 11"
          @click="$emit('transpose', 1)"
        />

        <!-- and this device's own capo on top of it, which nobody else sees -->
        <v-chip class="ms-2" size="small" :color="capo ? 'primary' : undefined" :variant="capo ? 'flat' : 'outlined'">
          <v-icon start size="x-small" icon="fas fa-minus" title="Capo down a fret" @click.stop="capo = capo - 1" />
          Capo {{ capo }}
          <v-icon end size="x-small" icon="fas fa-plus" title="Capo up a fret" @click.stop="capo = capo + 1" />
          <template v-if="playedKey">
            <span class="mx-1">-</span>
            {{ playedKey }}
          </template>
        </v-chip>
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

<style>
@keyframes bpm-blink {
  0% {
    opacity: 0.3;
  }
  40%,
  100% {
    opacity: 1;
  }
}
.bpm-blink {
  animation: bpm-blink 0.5s infinite;
}
</style>
