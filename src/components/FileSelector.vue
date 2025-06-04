<script setup lang="ts">
import { computed } from 'vue'
import { VTreeview, VTreeviewItem } from 'vuetify/labs/VTreeview'

const props = defineProps<{
  files: Treelike<{ name: string }>
  modelValue: string[]
}>()
const emit = defineEmits(['update:modelValue'])

const selectedFiles = useVModel(props, 'modelValue', emit)

function onInsert(event: any) {
  selectedFiles.value.splice(event.index, 0, event.data)
}

const mappedTree = computed(() => mapTree(props.files, (e) => ({ title: e.name })))
const filteredTree = computed(() => {
  return filterTree(mappedTree.value, (e) => !selectedFiles.value.includes(e.title))
})

const songsDocs = useCollection(songCollection)

function getSongByFilename(filename: string) {
  return songsDocs.value.find((doc) => doc.filename === filename)
}
function getSongDuration(filename: string) {
  const song = getSongByFilename(filename)
  return song?.duration ? `${Math.floor(song?.duration / 60)}:${(song?.duration % 60).toString().padStart(2, '0')}` : ''
}
//@ts-ignore
import { Drag, DropList } from 'vue-easy-dnd'
import { useVModel } from '@vueuse/core'
import { filterTree, mapTree, Treelike } from '@/helpers'
import { useCollection } from 'vuefire'
import { songCollection } from '@/plugins/firebase'
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
            <drag :key="item">
              <v-list-item color="primary" :active="reorder">
                <v-chip>{{ index + 1 }}</v-chip> {{ getSongByFilename(item)?.name || item }}
                <span v-if="getSongByFilename(item)?.key_signature" class="text-grey">
                  ({{ getSongByFilename(item)?.key_signature }})
                </span>
                <span v-if="getSongByFilename(item)?.bpm" class="text-grey me-3">
                  - {{ getSongByFilename(item)?.bpm }} bpm
                </span>
                <template v-slot:append>
                  <span v-if="getSongDuration(item)" class="bg-grey text-white rounded px-1">
                    <v-icon size="sm" icon="far fa-clock mb-1 " /> {{ getSongDuration(item) }}
                  </span>
                  <v-btn
                    @click="selectedFiles.splice(selectedFiles.indexOf(item), 1)"
                    icon="fas fa-close"
                    variant="plain"
                    style="height: 32px"
                  />
                </template>
              </v-list-item>
            </drag>
          </template>
          <template v-slot:feedback="{ data }">
            <v-list-item color="primary" active :key="data">
              {{ data }}
              <template v-slot:append>
                <v-btn icon="fas fa-close" variant="plain" style="height: 32px" />
              </template>
            </v-list-item>
          </template>
        </drop-list>
      </v-list>
    </v-col>
    <v-col cols="12" sm="6" orderSm="1">
      <h3>Available files</h3>
      <v-treeview :items="filteredTree" density="compact" class="disable-active-underlay">
        <template v-slot:item="{ props }">
          <drag :data="props.title" class="item" :key="props.title">
            <v-treeview-item
              :title="props.title"
              @click="selectedFiles.push(props.title)"
              prepend-icon="fas fa-file-pdf"
            />
          </drag>
        </template>
      </v-treeview>
    </v-col>
  </v-row>
</template>
