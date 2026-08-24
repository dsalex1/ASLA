<script setup lang="ts">
import Backbutton from '@/components/Backbutton.vue'
import SongCreate from '@/components/SongCreate.vue'
import SongEdit from '@/components/SongEdit.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { setlistCollection, songCollection } from '@/plugins/firebase'
import { HOME_ROUTE } from '@/router'
import { Song, ViewMode } from '@/types'
import { useRecentSearches } from '@/composables/useRecentSearches'
import { computed, ref } from 'vue'
import { useCollection } from 'vuefire'
import { useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { lyricsHasChords } from '@/helpers/lyrics'

const router = useRouter()
const { smAndDown } = useDisplay()

const songs = useCollection(songCollection)
const setlists = useCollection(setlistCollection)
const setlistFilter = ref<string | null>(null)
const songSearch = ref('')
const { recentSearches, addSearch, removeSearch, clearSearches } = useRecentSearches()

const editDialogOpen = ref(false)
const selectedSong = ref<Song | null>(null)

const filteredSongs = computed(() => {
  if (!setlistFilter.value) return songs.value
  const setlist = setlists.value.find((s) => s.id === setlistFilter.value)
  if (!setlist) return []
  return setlist.songs.map((songId) => songs.value.find((s) => s.id === songId)!).filter(Boolean)
})

function formatDuration(duration?: number) {
  return duration ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : ''
}

function viewSong(song: Song, mode?: ViewMode) {
  // Save current search to recent searches when user interacts with results
  if (songSearch.value && songSearch.value.trim().length >= 2) {
    addSearch(songSearch.value)
  }
  const query = mode ? `?mode=${mode}` : ''
  router.push(`/song/${song.id}${query}`)
}

function useRecentSearch(search: string) {
  songSearch.value = search
}

function editSong(song: Song) {
  selectedSong.value = song
  editDialogOpen.value = true
}
</script>

<template>
  <AppLayout>
    <h2 class="d-flex justify-space-between align-center">
      <div>
        <Backbutton :to="HOME_ROUTE" />
        Songs
      </div>
      <SongCreate />
    </h2>

    <!-- Filter chips -->
    <div class="mb-2 d-flex flex-wrap align-center gap-2">
      <v-chip
        v-for="setlist in [{ name: 'All', id: null }, ...setlists]"
        :key="setlist.id || 'null'"
        :color="setlistFilter === setlist.id ? 'primary' : ''"
        :variant="setlistFilter === setlist.id ? 'flat' : 'tonal'"
        class="me-1 mb-1"
        @click="setlistFilter = setlist.id ?? null"
        :active="setlistFilter === setlist.id"
      >
        {{ setlist.name || 'Untitled' }}
      </v-chip>
    </div>

    <!-- Search field -->
    <v-text-field
      v-model="songSearch"
      label="Search songs"
      prepend-inner-icon="fas fa-search"
      clearable
      hide-details
      single-line
      class="mb-3"
    />

    <!-- Recent searches -->
    <div v-if="recentSearches.length > 0" class="mb-3">
      <div class="text-caption text-grey mb-1 d-flex align-center">
        Recent searches
        <v-btn
          icon="fas fa-times"
          variant="text"
          size="x-small"
          class="ml-2"
          @click="clearSearches"
          title="Clear recent searches"
        />
      </div>
      <div class="d-flex flex-wrap gap-1">
        <v-chip
          v-for="search in recentSearches"
          :key="search"
          size="small"
          variant="outlined"
          closable
          @click="useRecentSearch(search)"
          @click:close="removeSearch(search)"
        >
          {{ search }}
        </v-chip>
      </div>
    </div>

    <!-- Desktop table view -->
    <v-data-table
      v-if="!smAndDown"
      :items="filteredSongs"
      :search="songSearch"
      :headers="[
        { key: 'name', title: 'Name', sortable: true },
        { key: 'key_signature', title: 'Key', sortable: true },
        { key: 'bpm', title: 'BPM', sortable: true },
        { key: 'duration', title: 'Duration', sortable: true },
        { key: 'ibi_instrument', title: 'Ibi Instrument', sortable: true },
        { key: 'content', title: 'Content', sortable: false },
        { key: 'actions', title: 'Actions', sortable: false },
        { key: 'edit', title: 'Edit', sortable: false, width: '60px' },
      ]"
      :items-per-page="25"
      class="elevation-1"
    >
      <template #item.edit="{ item }">
        <v-btn icon="fas fa-edit" size="small" variant="text" color="primary" @click="editSong(item)" />
      </template>

      <template #item.name="{ item }">
        <div class="font-weight-medium cursor-pointer" @click="viewSong(item)">
          {{ item.name || item.filename }}
        </div>
      </template>

      <template #item.duration="{ item }">
        <span v-if="item.duration">{{ formatDuration(item.duration) }}</span>
      </template>

      <template #item.content="{ item }">
        <div class="d-flex gap-1">
          <v-tooltip text="Sheet available" v-if="item.pdfStorageRef">
            <template #activator="{ props }">
              <span v-bind="props">🎼</span>
            </template>
          </v-tooltip>
          <v-tooltip text="Chords available" v-else-if="item.lyrics && lyricsHasChords(item.lyrics)">
            <template #activator="{ props }">
              <span v-bind="props">🎹</span>
            </template>
          </v-tooltip>
          <v-tooltip text="Lyrics available" v-if="item.lyrics">
            <template #activator="{ props }">
              <span v-bind="props">🎤</span>
            </template>
          </v-tooltip>
          <v-tooltip text="Drums available" v-if="item.drumsPdfStorageRef">
            <template #activator="{ props }">
              <span v-bind="props">🥁</span>
            </template>
          </v-tooltip>
          <v-tooltip text="Audio track available" v-if="item.audioTracks?.length">
            <template #activator="{ props }">
              <span v-bind="props">🎧</span>
            </template>
          </v-tooltip>
          <v-tooltip text="Moderation available" v-if="item.nadine_moderation">
            <template #activator="{ props }">
              <span v-bind="props">💬</span>
            </template>
          </v-tooltip>
        </div>
      </template>

      <template #item.actions="{ item }">
        <div class="d-flex gap-1">
          <v-btn
            v-if="item.filename || item.pdfStorageRef"
            size="small"
            color="primary"
            variant="tonal"
            @click="viewSong(item, 'chords')"
          >
            Sheet
          </v-btn>
          <v-btn v-if="item.lyrics" size="small" color="secondary" variant="tonal" @click="viewSong(item, 'lyrics')">
            Lyrics
          </v-btn>
          <v-btn
            v-if="item.drumsPdfStorageRef"
            size="small"
            color="info"
            variant="tonal"
            @click="viewSong(item, 'drums')"
          >
            Drums
          </v-btn>
          <v-btn
            v-if="item.audioTracks?.length"
            size="small"
            color="warning"
            variant="tonal"
            @click="viewSong(item, 'audio')"
          >
            Audio
          </v-btn>
        </div>
      </template>
    </v-data-table>

    <!-- Mobile card view -->
    <div v-else class="songs-grid">
      <v-card
        v-for="song in filteredSongs.filter(
          (s) => !songSearch || s.name?.toLowerCase().includes(songSearch.toLowerCase())
        )"
        :key="song.id"
        class="mb-3"
      >
        <v-card-title class="d-flex align-start">
          <div class="flex-grow-1 text-truncate" style="min-width: 0">
            {{ song.name || song.filename }}
          </div>
          <div class="d-flex align-center" style="flex-shrink: 0">
            <div class="d-flex gap-1 me-1">
              <span v-if="song.filename || song.pdfStorageRef">🎼</span>
              <span v-if="song.lyrics">🎤</span>
              <span v-if="song.drumsPdfStorageRef">🥁</span>
              <span v-if="song.audioTracks?.length">🎧</span>
              <span v-if="song.nadine_moderation">💬</span>
            </div>
            <v-btn
              style="margin-right: -20px; margin-top: -10px"
              icon="fas fa-edit"
              color="primary"
              variant="text"
              @click.stop="editSong(song)"
              title="Edit song"
            />
          </div>
        </v-card-title>

        <v-card-text>
          <div class="d-flex flex-wrap gap-2 mb-2">
            <v-chip v-if="song.key_signature" size="small" color="primary" variant="tonal">
              {{ song.key_signature }}
            </v-chip>
            <v-chip v-if="song.bpm" size="small" color="secondary" variant="tonal">{{ song.bpm }} BPM</v-chip>
            <v-chip v-if="song.duration" size="small" variant="tonal">
              <v-icon size="small" icon="far fa-clock" class="mr-1" />
              {{ formatDuration(song.duration) }}
            </v-chip>
            <v-chip v-if="song.ibi_instrument" size="small" color="info" variant="tonal">
              Ibi {{ song.ibi_instrument }}
            </v-chip>
          </div>

          <div class="d-flex gap-2 flex-wrap">
            <v-btn
              v-if="song.filename || song.pdfStorageRef"
              size="small"
              color="primary"
              variant="tonal"
              @click.stop="viewSong(song, 'chords')"
            >
              <v-icon size="small" icon="fas fa-music" class="mr-1" />
              Sheet
            </v-btn>
            <v-btn
              v-if="song.lyrics"
              size="small"
              color="secondary"
              variant="tonal"
              @click.stop="viewSong(song, 'lyrics')"
            >
              <v-icon size="small" icon="fas fa-microphone" class="mr-1" />
              Lyrics
            </v-btn>
            <v-btn
              v-if="song.drumsPdfStorageRef"
              size="small"
              color="info"
              variant="tonal"
              @click.stop="viewSong(song, 'drums')"
            >
              <v-icon size="small" icon="fas fa-drum" class="mr-1" />
              Drums
            </v-btn>
            <v-btn
              v-if="song.audioTracks?.length"
              size="small"
              color="warning"
              variant="tonal"
              @click.stop="viewSong(song, 'audio')"
            >
              <v-icon size="small" icon="fas fa-headphones" class="mr-1" />
              Audio
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <div v-if="filteredSongs.length === 0" class="text-center text-grey py-8">No songs found</div>
    </div>

    <!-- Edit Dialog -->
    <v-dialog v-model="editDialogOpen" max-width="800px" scrollable>
      <SongEdit v-if="selectedSong" :song="selectedSong" @close="editDialogOpen = false" />
    </v-dialog>
  </AppLayout>
</template>

<style scoped lang="scss">
.cursor-pointer {
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
}

.songs-grid {
  width: 100%;
}
</style>
