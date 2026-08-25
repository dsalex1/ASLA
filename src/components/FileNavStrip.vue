<script setup lang="ts">
import { FileContent } from '@/composables/useFileContents'
import { ref, watchEffect } from 'vue'
import { VBtn } from 'vuetify/components'

const props = defineProps<{
  files: FileContent[]
  fileIndex: number
  page: number
  lockedTo?: number | null // while annotating, only this file stays selectable
}>()

defineEmits<{ (e: 'select', index: number): void }>()

const navButtons = ref<VBtn[]>([])
watchEffect(() => {
  navButtons.value[props.fileIndex]?.$el.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'center' })
})
</script>

<template>
  <div class="d-flex ms-4" style="overflow-x: scroll; flex: 1">
    <v-btn
      ref="navButtons"
      variant="plain"
      small
      class="p-0"
      style="min-width: 0; padding-inline: 5px !important; position: relative"
      v-for="(file, i) in files"
      :key="i"
      :disabled="lockedTo != null && i !== lockedTo"
      @click="$emit('select', i)"
    >
      {{ file.name.length > 15 ? file.name.slice(0, 15) + '...' : file.name }}
      <div
        v-for="j in file.pageCount || 1"
        :key="j"
        style="position: absolute; bottom: 0; top: 0; height: 100%"
        :style="{
          width: `${100 / (file.pageCount || 1)}%`,
          left: `${(j - 1) * (100 / (file.pageCount || 1))}%`,
          borderRight: j == file.pageCount ? '1px solid black' : '1px dotted grey',
          backgroundColor: i == fileIndex && j === page ? 'rgba(var(--v-theme-primary), 0.2)' : 'transparent',
        }"
      ></div>
    </v-btn>
  </div>
</template>
