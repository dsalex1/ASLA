<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue'
import { setlistCollection, songCollection } from '@/plugins/firebase'
import { useCollection } from 'vuefire'

const setlists = useCollection(setlistCollection)
const songs = useCollection(songCollection)

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
    <h2 class="d-flex justify-space-between">
      <div>Setlists</div>
      <div class="d-flex flex-wrap justify-end">
        <RouterLink to="/settings">
          <v-btn color="secondary" class="ms-2" prepend-icon="fas fa-cog">settings</v-btn>
        </RouterLink>
        <RouterLink to="/setlist/create">
          <v-btn color="primary" class="ms-2" prepend-icon="fas fa-plus">create</v-btn>
        </RouterLink>
      </div>
    </h2>
    <v-row class="mt-2">
      <v-col
        v-for="setlist in [...setlists].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))"
        :key="setlist.id"
        cols="12"
        sm="6"
      >
        <v-card height="100%" @click.stop="$router.push(`/setlist/${setlist.id}/overview`)" class="cursor-pointer">
          <div class="d-flex justify-space-between align-center flex-wrap">
            <v-card-title style="width: 0; flex: 1">{{ setlist.name || 'Untitled' }}</v-card-title>
            <div>
              <RouterLink :to="`/setlist/${setlist.id}/edit`" @click.stop>
                <v-btn color="primary" variant="text" class="ms-2" prepend-icon="fas fa-edit">edit</v-btn>
              </RouterLink>
            </div>
          </div>
          <VCardSubtitle>
            <v-row>
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
                color="secondary"
                variant="flat"
                style="flex: 1; flex-basis: 0px"
                prepend-icon="fa fa-microphone"
                @click.stop="$router.push({ path: `/setlist/${setlist.id}`, query: { mode: 'lyrics' } })"
              >
                Lyrics
              </v-btn>
              <v-btn
                color="primary"
                variant="flat"
                style="flex: 1; flex-basis: 0px"
                prepend-icon="fas fa-file-lines"
                @click.stop="$router.push({ path: `/setlist/${setlist.id}`, query: { mode: 'chords' } })"
              >
                Chords
              </v-btn>
              <v-btn
                color="info"
                variant="flat"
                style="flex: 1; flex-basis: 0px"
                prepend-icon="fas fa-drum"
                @click.stop="$router.push({ path: `/setlist/${setlist.id}`, query: { mode: 'drums' } })"
              >
                Drums
              </v-btn>
            </v-btn-group>
            <v-chip size="small" v-for="song in setlist.songs" :key="song">
              {{
                formatSongName(songs.find((s) => s.id == song)?.name || songs.find((s) => s.id == song)?.filename || '')
              }}
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </AppLayout>
</template>
