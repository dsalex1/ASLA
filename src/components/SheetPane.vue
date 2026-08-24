<script setup lang="ts">
import { FileContent } from '@/composables/useFileContents'
import VuePdfEmbed from 'vue-pdf-embed'

defineProps<{
  files: FileContent[]
  fileIndex: number
  page: number
  height: number
  hidden?: boolean // the lyrics pane is covering the sheets
}>()
</script>

<template>
  <div
    v-for="(file, i) in files"
    :key="i"
    :style="{ opacity: i === fileIndex && !hidden ? 1 : 0 }"
    style="width: 0px"
  >
    <template v-if="file.isPdf">
      <vue-pdf-embed
        v-for="pageIndex in file.pageCount || 1"
        :key="pageIndex"
        v-show="pageIndex === page"
        :height="height"
        :page="pageIndex"
        @loaded="({ numPages }) => (file.pageCount = numPages)"
        :source="file.dataUrl"
      />
    </template>
    <template v-else>
      <img
        style="transform: translateX(-50%)"
        v-for="(url, index) in file.urls"
        :key="index"
        v-show="index + 1 === page"
        :src="url"
        :style="{ height: height + 'px', objectFit: 'contain' }"
      />
    </template>
  </div>
</template>

<style>
.vue-pdf-embed__page {
  display: flex;
  justify-content: center;
}
</style>
