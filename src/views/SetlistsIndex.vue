<script setup lang="ts">
import OfflineToggle from '@/components/OfflineToggle.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { setlistCollection, songCollection } from '@/plugins/firebase'
import { Setlist } from '@/types'
import { useCollection } from 'vuefire'
import { useDisplay } from 'vuetify'

const { mobile } = useDisplay()

const modes = [
  { mode: 'lyrics', label: 'Lyrics', icon: 'fa fa-microphone', color: 'secondary' },
  { mode: 'chords', label: 'Chords', icon: 'fas fa-file-lines', color: 'primary' },
  { mode: 'drums', label: 'Drums', icon: 'fas fa-drum', color: 'info' },
  { mode: 'audio', label: 'Audio', icon: 'fas fa-headphones', color: 'warning' },
] as const

const setlists = useCollection(setlistCollection)
const songs = useCollection(songCollection)

const songsOf = (setlist: Setlist) =>
  setlist.songs.map((s) => (typeof s === 'string' ? songs.value.find((x) => x.id == s) : s)).filter((s) => !!s)

function formatSongName(song: string) {
  return song.replace(/.pdf$/, '').length > 16
    ? song.replace(/.pdf$/, '').substring(0, 13) + '...'
    : song.replace(/.pdf$/, '')
}

function formatDuration(duration?: number) {
  return duration ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : ''
}
</script>

<template>
  <AppLayout>
    <div class="d-flex align-center justify-end flex-wrap ga-2 mb-2">
      <h2 class="mb-0" style="flex-grow: 1">Setlists</h2>
      <div class="order-2 order-sm-1">
        <RouterLink to="/song" class="me-2">
          <v-btn color="info" prepend-icon="fas fa-music">songs</v-btn>
        </RouterLink>
        <RouterLink to="/settings">
          <v-btn color="secondary" prepend-icon="fas fa-cog">settings</v-btn>
        </RouterLink>
      </div>
      <RouterLink to="/setlist/create" style="margin-left: auto" class="order-1 order-sm-2">
        <v-btn color="primary" prepend-icon="fas fa-plus">create</v-btn>
      </RouterLink>
    </div>
    <v-row class="mt-2">
      <v-col
        v-for="setlist in [...setlists].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))"
        :key="setlist.id"
        cols="12"
        sm="6"
      >
        <v-card height="100%">
          <div class="d-flex justify-space-between align-center flex-wrap">
            <v-card-title
              style="min-width: 0; flex: 1"
              @click="$router.push(`/setlist/${setlist.id}/overview`)"
              class="cursor-pointer setlist-title"
            >
              {{ setlist.name || 'Untitled' }}
            </v-card-title>
            <div class="d-flex align-center flex-shrink-0">
              <OfflineToggle :setlist-id="setlist.id!" :songs="songsOf(setlist)" />
              <RouterLink :to="`/setlist/${setlist.id}/edit`">
                <v-btn
                  color="primary"
                  variant="text"
                  density="comfortable"
                  class="ms-1"
                  title="Edit setlist"
                  :icon="mobile ? 'fas fa-edit' : undefined"
                  :prepend-icon="mobile ? undefined : 'fas fa-edit'"
                >
                  <template v-if="!mobile">edit</template>
                </v-btn>
              </RouterLink>
            </div>
          </div>
          <VCardSubtitle>
            <v-row @click="$router.push(`/setlist/${setlist.id}/overview`)" class="cursor-pointer">
              <v-col cols="6">
                <v-icon class="me-2">fas fa-music</v-icon>
                {{ setlist.songs.length }} song{{ setlist.songs.length > 1 ? 's' : '' }}
              </v-col>
              <v-col cols="6">
                <v-icon class="me-2">fas fa-clock</v-icon>
                {{
                  formatDuration(
                    setlist.songs
                      .map((song) => songs.find((s) => s.id == song)?.duration || 0)
                      .reduce((a, b) => a + b, 0)
                  )
                }}
                min
                <span v-if="setlist.songs.filter((song) => !songs.find((s) => s.id == song)?.duration).length > 0">
                  (+{{ setlist.songs.filter((song) => !songs.find((s) => s.id == song)?.duration).length }})
                </span>
              </v-col>
            </v-row>
          </VCardSubtitle>
          <v-card-text>
            <v-btn-group class="w-100 mb-2">
              <v-btn
                v-for="m in modes"
                :key="m.mode"
                :color="m.color"
                variant="flat"
                class="mode-btn"
                style="flex: 1; flex-basis: 0px; min-width: 0"
                :prepend-icon="m.icon"
                @click="$router.push({ path: `/setlist/${setlist.id}`, query: { mode: m.mode } })"
              >
                {{ m.label }}
              </v-btn>
            </v-btn-group>
            <v-chip size="small" v-for="song in setlist.songs" :key="JSON.stringify(song)">
              {{
                typeof song === 'string'
                  ? formatSongName(
                      songs.find((s) => s.id == song)?.name || songs.find((s) => s.id == song)?.filename || ''
                    )
                  : song.title || 'Custom Entry'
              }}
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </AppLayout>
</template>

<style scoped>
/* v-card-title never wraps, so a long name ellipsed away instead of using the space it has */
.setlist-title {
  white-space: normal;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* trim the chrome so the label keeps as many characters as possible before clipping */
.mode-btn {
  padding-inline: 8px !important;
}
.mode-btn :deep(.v-btn__prepend) {
  margin-inline: 0 4px;
}
.mode-btn :deep(.v-btn__content) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
</style>
