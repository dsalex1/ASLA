<script setup lang="ts">
import Backbutton from '@/components/Backbutton.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { songCollection } from '@/plugins/firebase'
import { useSheetBaseDirectory } from '@/plugins/sheetBaseDirectory'
import { HOME_ROUTE } from '@/router'
import { Song } from '@/types'
import { useDebounceFn } from '@vueuse/core'
import { doc, updateDoc } from 'firebase/firestore'
import { ref } from 'vue'
import { useCollection } from 'vuefire'

const { baseDirectory, chooseNewSheetBaseDirectory } = useSheetBaseDirectory()

const songs = useCollection(songCollection)

const songSearch = ref('')

const saveSong = useDebounceFn((song: Song) => updateDoc(doc(songCollection, song.id!), song), 500)

const strCrossProduct = <const T extends string, const U extends string>(arr1: T[], arr2: U[]): `${T}${U}`[] =>
  arr2.flatMap((b) => arr1.map((a) => `${a}${b}` as `${T}${U}`))
</script>

<template>
  <AppLayout>
    <h2>
      <Backbutton :to="HOME_ROUTE" />
      Settings
    </h2>
    <div class="d-flex align-center">
      <div class="mr-2">current sheet path: {{ baseDirectory ? '/' + baseDirectory.name : 'none' }}</div>
      <v-btn @click="chooseNewSheetBaseDirectory" color="primary">Select new path</v-btn>
    </div>

    <h3 class="mt-3"></h3>
    <v-card title="Song Details" flat>
      <template #text>
        <v-text-field
          v-model="songSearch"
          label="Search"
          prepend-inner-icon="fas fa-search"
          hide-details
          single-line
        ></v-text-field>
      </template>

      <v-data-table
        :items="songs"
        :search="songSearch"
        :headers="[
          { key: 'filename', title: 'File' },
          { key: 'name', title: 'Name' },
          { key: 'key_signature', title: 'Key' },
          { key: 'bpm', title: 'BPM' },
          { key: 'duration', title: 'Duration' },
          { key: 'lyrics', title: 'Lyrics' },
        ]"
      >
        <template #item.filename="{ item }">
          <span
            :title="item.filename"
            style="
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              display: inline-block;
              max-width: 100px;
            "
          >
            {{ item.filename }}
          </span>
        </template>
        <template #item.name="{ item }">
          <v-text-field
            v-model="item.name"
            @input="saveSong(item)"
            width="250px"
            variant="outlined"
            density="compact"
            hide-details
          />
        </template>
        <template #item.key_signature="{ item }">
          <v-autocomplete
            v-model="item.key_signature"
            :items="strCrossProduct(strCrossProduct(['C', 'D', 'E', 'F', 'G', 'A', 'B'], ['', '#', 'b']), ['', 'm'])"
            @update:model-value="saveSong(item)"
            width="100px"
            variant="outlined"
            density="compact"
            hide-details
          />
        </template>
        <template #item.bpm="{ item }">
          <v-text-field
            type="number"
            :min="0"
            :max="300"
            v-model="item.bpm"
            @update:model-value="saveSong(item)"
            width="85px"
            variant="outlined"
            density="compact"
            hide-details
          />
        </template>
        <template #item.duration="{ item }">
          <div class="d-flex align-center">
            <v-text-field
              :model-value="item.duration ? Math.floor(item.duration / 60) : ''"
              @update:model-value="
                (value) => {
                  item.duration = (value ? parseInt(value) : 0) * 60 + (item.duration ? item.duration % 60 : 0)
                  saveSong(item)
                }
              "
              :min="0"
              :max="99"
              type="number"
              width="60px"
              variant="outlined"
              density="compact"
              hide-details
            />:<v-text-field
              :model-value="item.duration ? item.duration % 60 : ''"
              @update:model-value="
                (value) => {
                  item.duration =
                    (item.duration ? Math.floor(item.duration / 60) : 0) * 60 + (value ? parseInt(value) : 0)
                  saveSong(item)
                }
              "
              :min="0"
              :max="60"
              type="number"
              width="60px"
              variant="outlined"
              density="compact"
              hide-details
            />
          </div>
        </template>
        <template #item.lyrics="{ item }">
          <v-dialog max-width="600px">
            <template #activator="{ props }">
              <v-btn v-bind="props" color="primary" variant="text">Edit Lyrics</v-btn>
            </template>
            <v-card>
              <v-card-title>Edit Lyrics</v-card-title>
              <v-card-text>
                <v-textarea
                  v-model="item.lyrics"
                  @input="saveSong(item)"
                  rows="15"
                  auto-grow
                  label="Lyrics"
                  hide-details
                />
              </v-card-text>
            </v-card>
          </v-dialog>
        </template>
      </v-data-table>
    </v-card>
  </AppLayout>
</template>

<style scoped lang="scss">
.disable-active-underlay {
  .v-list-item {
    --v-activated-opacity: 0;
  }
}
</style>

<style>
.DragFeedback {
  display: none;
}
</style>
