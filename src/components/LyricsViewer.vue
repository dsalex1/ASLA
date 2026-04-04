<script setup lang="ts">
import { isChordLine, lyricsHasChords, tokenizeChordLine } from '@/helpers/lyrics'
import { computed } from 'vue'

const props = defineProps<{
  lyrics: string
  mode?: 'lyrics' | 'chords' | 'drums'
  fontSize: number
}>()

const isLyricsMode = computed(() => props.mode === 'lyrics')

const parsedLines = computed(() => {
  if (!props.lyrics) return []

  return props.lyrics
    .split('\n')
    .filter((line) => {
      // If in lyrics mode, hide chord lines
      if (isLyricsMode.value && isChordLine(line)) return false
      return true
    })
    .map((line) => {
      if (isLyricsMode.value) {
        // In lyrics mode, trim the line
        return { type: 'lyrics', text: line.trim(), tokens: [] }
      } else {
        // In chords/drums mode, highlight chords
        if (isChordLine(line)) {
          return { type: 'chord', text: line, tokens: tokenizeChordLine(line) }
        } else {
          return { type: 'lyrics', text: line, tokens: [] }
        }
      }
    })
})

const needsMonospace = computed(() => {
  return lyricsHasChords(props.lyrics) && !isLyricsMode.value
})
</script>

<template>
  <div
    class="w-100"
    :style="{
      fontSize: fontSize + 'px',
      fontFamily: needsMonospace ? 'monospace' : 'inherit',
      whiteSpace: 'pre-wrap',
      lineHeight: !isLyricsMode ? '1.0' : 'inherit',
    }"
  >
    <div
      v-for="(line, lineIdx) in parsedLines"
      :key="lineIdx"
      :class="{ 'mb-2': line.type !== 'chord' && !isLyricsMode }"
    >
      <template v-if="line.type === 'chord'">
        <template v-for="(token, tokenIdx) in line.tokens" :key="tokenIdx">
          <strong v-if="token.isChord" class="text-blue-darken-4 bg-grey-lighten-3 px-1 mx-n1 rounded">
            {{ token.text }}
          </strong>
          <template v-else>{{ token.text }}</template>
        </template>
      </template>
      <template v-else>{{ line.text || ' ' }}</template>
    </div>
  </div>
</template>
