<script setup lang="ts">
import { computed } from 'vue'
import { VTreeview, VTreeviewItem } from 'vuetify/labs/VTreeview'

//@ts-ignore
import SongListItem from '@/components/SongListItem.vue'
import { filterTree, mapTree, Treelike } from '@/helpers'
import { songCollection } from '@/plugins/firebase'
import { useVModel } from '@vueuse/core'
import { Drag, DropList } from 'vue-easy-dnd'
import { useCollection } from 'vuefire'

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
                :song="getSongByFilename(item)!"
                @remove="selectedFiles.splice(selectedFiles.indexOf(item), 1)"
                draggable
                removeable
              />
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
          <drag :data="props.title" class="item" :key="props.title" handle=".drag-handle">
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
