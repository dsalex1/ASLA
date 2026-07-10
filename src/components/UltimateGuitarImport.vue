<script setup lang="ts">
import { fetchLyricsOvh, OvhResult, searchLyricsOvh } from '@/helpers/lyricsOvh'
import { fetchUltimateGuitarTab, searchUltimateGuitar, UgSearchResult } from '@/helpers/ultimateGuitar'
import { Song } from '@/types'
import { ref } from 'vue'

const props = defineProps<{
  query: string
}>()

export type UgImportData = {
  lyrics: string
  bpm?: number
  duration?: number
  key_signature?: Song['key_signature']
}

const emit = defineEmits<{
  (e: 'import', data: UgImportData): void
}>()

const loading = ref(false)
const importingUrl = ref('')
const error = ref('')
const results = ref<(UgSearchResult | OvhResult)[] | null>(null)
let searchDuration: number | undefined

async function search() {
  loading.value = true
  error.value = ''
  results.value = null
  try {
    const res = await searchUltimateGuitar(props.query)
    results.value = res.results
    searchDuration = res.duration
    if (!res.results.length) {
      // no tabs on UG: fall back to a plain-lyrics search
      results.value = await searchLyricsOvh(props.query)
      if (!results.value.length) error.value = 'No results found'
    }
  } catch (e) {
    console.error('Ultimate Guitar search failed:', e)
    error.value = 'Search failed'
  } finally {
    loading.value = false
  }
}

const resultKey = (result: UgSearchResult | OvhResult) =>
  'url' in result ? result.url : `${result.artist}|${result.title}`

async function pick(result: UgSearchResult | OvhResult) {
  if (importingUrl.value) return
  importingUrl.value = resultKey(result)
  error.value = ''
  try {
    if ('url' in result) {
      const tab = await fetchUltimateGuitarTab(result.url)
      if (!tab.lyrics) throw new Error('No tab content found')
      emit('import', {
        lyrics: tab.lyrics,
        bpm: tab.bpm,
        duration: searchDuration,
        key_signature: tab.key_signature,
      })
    } else {
      emit('import', {
        lyrics: await fetchLyricsOvh(result.artist, result.title),
        duration: result.duration,
      })
    }
    results.value = null
  } catch (e) {
    console.error('Lyrics import failed:', e)
    error.value = 'Import failed'
  } finally {
    importingUrl.value = ''
  }
}
</script>

<template>
  <div>
    <v-btn
      variant="tonal"
      color="primary"
      prepend-icon="fas fa-cloud-arrow-down"
      :loading="loading"
      :disabled="!query.trim()"
      @click="search"
    >
      Import from Ultimate Guitar
    </v-btn>
    <v-alert v-if="error" type="warning" density="compact" class="mt-2">{{ error }}</v-alert>
    <v-list
      v-if="results?.length"
      density="compact"
      class="border rounded mt-2"
      max-height="300"
      style="overflow-y: auto"
    >
      <v-list-item
        v-for="result in results"
        :key="resultKey(result)"
        :title="result.title"
        :subtitle="
          'url' in result
            ? result.votes
              ? `${result.artist} · ${result.votes.toLocaleString()} votes`
              : result.artist
            : `${result.artist} · lyrics only`
        "
        @click="pick(result)"
      >
        <template #append>
          <v-progress-circular v-if="importingUrl === resultKey(result)" indeterminate size="20" />
        </template>
      </v-list-item>
    </v-list>
  </div>
</template>
