<script setup lang="ts">
defineProps<{
  pageCount: number
  page: number
  canUndo: boolean
  canRedo: boolean
  dirty: boolean
  saving: boolean
}>()

const tool = defineModel<'pen' | 'eraser'>('tool', { required: true })
const gray = defineModel<number>('gray', { required: true })
const width = defineModel<number>('width', { required: true })
const page = defineModel<number>('page', { required: true })

defineEmits<{
  (e: 'undo'): void
  (e: 'redo'): void
  (e: 'save'): void
  (e: 'done'): void
}>()

const colors = [0, 0.5, 1]
const widths = [2, 5, 10]
</script>

<template>
  <div class="w-100 d-flex flex-wrap justify-center align-center ga-2 py-1">
    <div>
      <v-btn
        v-for="c in colors"
        :key="c"
        density="compact"
        :variant="tool == 'pen' && gray == c ? 'outlined' : 'text'"
        icon
        @click=";((gray = c), (tool = 'pen'))"
      >
        <div
          :style="{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            border: '1px solid #888',
            backgroundColor: `rgb(${c * 255},${c * 255},${c * 255})`,
          }"
        ></div>
      </v-btn>
    </div>
    <div>
      <v-btn
        v-for="(w, i) in widths"
        :key="w"
        density="compact"
        :variant="tool == 'pen' && width == w ? 'outlined' : 'text'"
        icon
        @click=";((width = w), (tool = 'pen'))"
      >
        <div :style="{ width: `${8 + i * 5}px`, height: `${8 + i * 5}px`, borderRadius: '50%', backgroundColor: 'currentColor' }"></div>
      </v-btn>
    </div>
    <v-btn density="compact" :variant="tool == 'eraser' ? 'outlined' : 'text'" icon="fas fa-eraser" @click="tool = 'eraser'" />
    <v-divider vertical />
    <div>
      <v-btn density="compact" variant="text" icon="fas fa-rotate-left" :disabled="!canUndo" @click="$emit('undo')" />
      <v-btn density="compact" variant="text" icon="fas fa-rotate-right" :disabled="!canRedo" @click="$emit('redo')" />
    </div>
    <v-divider vertical />
    <div>
      <v-btn density="compact" variant="text" icon="fas fa-chevron-left" :disabled="page <= 1" @click="page--" />
      <span>{{ page }}/{{ pageCount }}</span>
      <v-btn density="compact" variant="text" icon="fas fa-chevron-right" :disabled="page >= pageCount" @click="page++" />
    </div>
    <v-divider vertical />
    <div>
      <v-btn
        density="compact"
        variant="tonal"
        color="primary"
        prepend-icon="fas fa-floppy-disk"
        :loading="saving"
        :disabled="!dirty"
        @click="$emit('save')"
      >
        Save
      </v-btn>
      <v-btn density="compact" variant="text" icon="fas fa-check-circle" @click="$emit('done')" />
    </div>
  </div>
</template>
