<script setup lang="ts">
import Backbutton from '@/components/Backbutton.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { folderCollection, songCollection } from '@/plugins/firebase'
import { Song } from '@/types'
import { addDoc, deleteField, doc, updateDoc, writeBatch } from 'firebase/firestore'
import { computed, ref } from 'vue'
//@ts-ignore
import { Drag, Drop } from 'vue-easy-dnd'
import { useCollection } from 'vuefire'
import { db } from '@/plugins/firebase'

const folders = useCollection(folderCollection)
const songs = useCollection(songCollection)

const songTitle = (s: Song) => s.name || s.filename
const byTitle = (a: Song, b: Song) => songTitle(a).localeCompare(songTitle(b))

// folders alphabetically, then the virtual "No folder" section for loose songs
const sections = computed(() => [
  ...[...folders.value].sort((a, b) => a.name.localeCompare(b.name)).map((f) => ({ id: f.id!, name: f.name })),
  { id: null as string | null, name: 'No folder' },
])

const songsIn = (folderId: string | null) =>
  songs.value.filter((s) => (s.folderId ?? null) === folderId).sort(byTitle)

const newFolderName = ref('')
const error = ref('')

function validateName(name: string, excludeId?: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  if (folders.value.some((f) => f.id !== excludeId && f.name.toLowerCase() === trimmed.toLowerCase())) {
    error.value = `A folder named "${trimmed}" already exists.`
    return null
  }
  return trimmed
}

async function createFolder() {
  error.value = ''
  const name = validateName(newFolderName.value)
  if (!name) return
  await addDoc(folderCollection, { name })
  newFolderName.value = ''
}

// inline rename (window.prompt is a silent no-op in some embedded browsers)
const renamingId = ref<string | null>(null)
const renameText = ref('')

function startRename(folderId: string, currentName: string) {
  error.value = ''
  renamingId.value = folderId
  renameText.value = currentName
}

async function commitRename() {
  const folderId = renamingId.value
  if (!folderId) return
  renamingId.value = null
  const name = validateName(renameText.value, folderId)
  if (!name || name === folders.value.find((f) => f.id === folderId)?.name) return
  await updateDoc(doc(folderCollection, folderId), { name })
}

async function deleteFolder(folderId: string, name: string) {
  if (!window.confirm(`Delete folder "${name}"? Its songs will be moved out of the folder.`)) return
  const batch = writeBatch(db)
  songs.value
    .filter((s) => s.folderId === folderId)
    .forEach((s) => batch.update(doc(songCollection, s.id!), { folderId: deleteField() }))
  batch.delete(doc(folderCollection, folderId))
  await batch.commit()
}

async function moveSong(songId: string, folderId: string | null) {
  await updateDoc(doc(songCollection, songId), { folderId: folderId ?? deleteField() })
}
</script>

<template>
  <AppLayout>
    <h2 class="d-flex align-center">
      <Backbutton to="/song" />
      Folders
    </h2>

    <form class="d-flex align-center ga-2 mb-4" @submit.prevent="createFolder">
      <v-text-field
        v-model="newFolderName"
        label="New folder"
        variant="outlined"
        density="compact"
        hide-details
        clearable
      />
      <v-btn type="submit" color="primary" prepend-icon="fas fa-folder-plus" :disabled="!newFolderName?.trim()">
        Create
      </v-btn>
    </form>

    <v-alert v-if="error" type="error" density="compact" class="mb-3" closable @click:close="error = ''">
      {{ error }}
    </v-alert>

    <v-list density="compact">
      <drop
        v-for="section in sections"
        :key="section.id ?? 'root'"
        accepts-type="song"
        class="folder-section"
        @drop="moveSong($event.data, section.id)"
      >
        <v-list-item class="folder-header">
          <template #prepend>
            <v-icon :icon="section.id ? 'fas fa-folder' : 'fas fa-folder-open'" size="small" class="me-2" />
          </template>
          <v-text-field
            v-if="section.id && renamingId === section.id"
            v-model="renameText"
            variant="outlined"
            density="compact"
            hide-details
            autofocus
            @keyup.enter="commitRename"
            @keyup.esc="renamingId = null"
            @blur="commitRename"
          />
          <v-list-item-title v-else class="font-weight-medium">{{ section.name }}</v-list-item-title>
          <template #append v-if="section.id">
            <v-btn
              icon="fas fa-pen"
              variant="text"
              size="x-small"
              title="Rename folder"
              @click="startRename(section.id!, section.name)"
            />
            <v-btn
              icon="fas fa-trash"
              variant="text"
              size="x-small"
              color="error"
              title="Delete folder"
              @click="deleteFolder(section.id!, section.name)"
            />
          </template>
        </v-list-item>

        <div v-if="songsIn(section.id).length === 0" class="text-caption text-grey ps-12 pb-2">Empty</div>
        <drag
          v-for="song in songsIn(section.id)"
          :key="song.id"
          :data="song.id"
          type="song"
          handle=".drag-handle"
        >
          <v-list-item class="ps-8">
            <template #prepend>
              <v-icon icon="fas fa-music" size="x-small" class="me-2" />
            </template>
            <v-list-item-title>{{ songTitle(song) }}</v-list-item-title>
            <template #append>
              <v-menu>
                <template #activator="{ props }">
                  <v-btn v-bind="props" icon="fas fa-ellipsis-v" variant="text" size="x-small" title="Move to folder" />
                </template>
                <v-list density="compact">
                  <v-list-item
                    v-for="target in sections.filter((t) => t.id !== section.id)"
                    :key="target.id ?? 'root'"
                    :title="target.name"
                    @click="moveSong(song.id!, target.id)"
                  />
                </v-list>
              </v-menu>
              <v-btn class="drag-handle" icon="fas fa-grip" variant="plain" size="x-small" />
            </template>
          </v-list-item>
        </drag>
      </drop>
    </v-list>
  </AppLayout>
</template>

<style scoped lang="scss">
.folder-section {
  border-radius: 4px;
  &.drop-in.drop-allowed {
    background: rgba(var(--v-theme-primary), 0.12);
  }
}
.folder-header {
  background: rgba(var(--v-theme-on-surface), 0.05);
}
</style>

<style>
.DragFeedback {
  display: none;
}
</style>
