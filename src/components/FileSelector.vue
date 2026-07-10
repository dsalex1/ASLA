<script setup lang="ts">
import { computed, ref } from 'vue'
import { VTreeview, VTreeviewItem } from 'vuetify/labs/VTreeview'

import SongListItem from '@/components/SongListItem.vue'
import { filterTree, mapTree, Treelike } from '@/helpers'
import { songCollection } from '@/plugins/firebase'
import { useVModel } from '@vueuse/core'
//@ts-ignore
import { Drag, DropList } from 'vue-easy-dnd'
import { useCollection } from 'vuefire'
import { CustomSetlistEntry } from '@/types'

const props = defineProps<{
  files: Treelike<{ name: string }>
  modelValue: (string | CustomSetlistEntry)[]
  openAll?: boolean
}>()
const emit = defineEmits(['update:modelValue'])

const selectedFiles = useVModel(props, 'modelValue', emit)

function onInsert(event: any) {
  selectedFiles.value.splice(event.index, 0, event.data)
}

const mappedTree = computed(() => mapTree(props.files, (e) => ({ title: e.name })))

// titles of non-leaf nodes (directories/folders) — those only expand, they are not selectable songs
const folderTitles = computed(() => {
  const titles = new Set<string>()
  const walk = (nodes: Treelike<{ title: string }>) =>
    nodes.forEach((n) => {
      if (n.children) {
        titles.add(n.title)
        walk(n.children)
      }
    })
  walk(mappedTree.value)
  return titles
})

const searchQuery = ref('')

const filteredTree = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return filterTree(
    mappedTree.value,
    (e) => !selectedFiles.value.includes(e.title) && (!query || e.title.toLowerCase().includes(query))
  )
})

const songsDocs = useCollection(songCollection)

function getSongByFilename(filename: string) {
  return songsDocs.value.find((doc) => doc.filename === filename)
}
</script>

<template>
  <v-row>
    <v-col cols="12" sm="6" orderSm="2">
      <h3>Selected files</h3>
      <v-list density="compact">
        <drop-list :items="selectedFiles" class="list" @insert="onInsert" @reorder="$event.apply(selectedFiles)">
          <template v-slot:empty>
            <v-list-item color="primary">No files selected</v-list-item>
          </template>
          <template v-slot:item="{ item, index, reorder }">
            <drag :key="item" handle=".drag-handle">
              <SongListItem
                :active="reorder"
                :index="index + 1"
                :song="typeof item === 'string' ? getSongByFilename(item) : item"
                @remove="selectedFiles.splice(selectedFiles.indexOf(item), 1)"
                :class="{ 'custom-entry': typeof item !== 'string' }"
                draggable
                removeable
              >
                <div class="d-flex align-center pt-2" v-if="typeof item !== 'string'">
                  <v-text-field variant="outlined" density="compact" hide-details v-model="item.title" label="Title" />
                  <v-text-field
                    variant="outlined"
                    density="compact"
                    hide-details
                    v-model="item.description"
                    label="Description"
                  />
                </div>
              </SongListItem>
            </drag>
          </template>
          <template v-slot:feedback="{ data }">
            <v-list-item color="primary" active :key="data">
              {{ typeof data === 'string' ? data : 'Custom Entry' }}
              <template v-slot:append>
                <v-btn icon="fas fa-close" variant="plain" style="height: 32px" />
              </template>
            </v-list-item>
          </template>
        </drop-list>
      </v-list>
    </v-col>
    <v-col cols="12" sm="6" orderSm="1">
      <div @click="selectedFiles.push({ title: '', description: '' })" class="mb-2">
        <drag :data="{ title: '', description: '' }" class="item d-flex align-center" handle=".drag-handle">
          <div>Custom Entry</div>
          <v-btn class="drag-handle me-n6" icon="fas fa-grip" variant="plain" style="height: 32px" />
        </drag>
      </div>
      <h3>Available files</h3>
      <v-text-field
        v-model="searchQuery"
        label="Search songs"
        placeholder="Search songs"
        prepend-inner-icon="fas fa-magnifying-glass"
        variant="outlined"
        density="compact"
        hide-details
        clearable
        class="mb-2"
      />
      <v-treeview
        :items="filteredTree"
        :open-all="!!searchQuery || openAll"
        density="compact"
        class="disable-active-underlay"
      >
        <template v-slot:item="{ props }">
          <v-treeview-item
            v-if="folderTitles.has(props.title)"
            :title="props.title"
            prepend-icon="fas fa-folder"
          />
          <drag v-else :data="props.title" class="item" :key="props.title" handle=".drag-handle">
            <v-treeview-item
              :title="props.title"
              @click="selectedFiles.push(props.title)"
              prepend-icon="fas fa-file-pdf"
            >
              <template #append>
                <v-btn class="drag-handle me-n6" icon="fas fa-grip" variant="plain" style="height: 32px" />
              </template>
            </v-treeview-item>
          </drag>
        </template>
      </v-treeview>
    </v-col>
  </v-row>
</template>
