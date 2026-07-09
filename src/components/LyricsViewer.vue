<script setup lang="ts">
import { isChordLine, lyricsHasChords, replaceChordInLine, tokenizeChordLine, transposeChord, transposeTokens } from '@/helpers/lyrics'
import { computed, ref } from 'vue'

const props = defineProps<{
  lyrics: string
  mode?: 'lyrics' | 'chords' | 'drums'
  fontSize: number
  transpose?: number
  editable?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:lyrics', lyrics: string): void
}>()

const isLyricsMode = computed(() => props.mode === 'lyrics')
const semitones = computed(() => props.transpose ?? 0)

const parsedLines = computed(() => {
  if (!props.lyrics) return []

  return props.lyrics
    .split('\n')
    .map((line, originalIdx) => ({ line, originalIdx, isChord: isChordLine(line) }))
    .filter(({ isChord }) => {
      // If in lyrics mode, hide chord lines
      if (isLyricsMode.value && isChord) return false
      return true
    })
    .map(({ line, originalIdx, isChord }) => {
      if (isLyricsMode.value) {
        // In lyrics mode, trim the line
        return { type: 'lyrics', text: line.trim(), originalIdx, tokens: [] }
      } else {
        // In chords/drums mode, highlight chords
        if (isChord) {
          return {
            type: 'chord',
            text: line,
            originalIdx,
            tokens: transposeTokens(tokenizeChordLine(line), semitones.value),
          }
        } else {
          return { type: 'lyrics', text: line, originalIdx, tokens: [] }
        }
      }
    })
})

const needsMonospace = computed(() => {
  return lyricsHasChords(props.lyrics) && !isLyricsMode.value
})

// --- inline chord editing (tap a chord) ---
const editing = ref<{ lineIdx: number; tokenIdx: number } | null>(null)
const editText = ref('')

function startEdit(lineIdx: number, tokenIdx: number, displayed: string) {
  if (!props.editable) return
  editing.value = { lineIdx, tokenIdx }
  editText.value = displayed
}

function commitEdit() {
  if (!editing.value) return
  const { lineIdx, tokenIdx } = editing.value
  editing.value = null
  const newText = editText.value.trim()
  if (!newText) return
  // the user edits the displayed (transposed) chord; store it untransposed
  const stored = transposeChord(newText, -semitones.value)
  const lines = props.lyrics.split('\n')
  const newLine = replaceChordInLine(lines[lineIdx], tokenIdx, stored)
  if (newLine === lines[lineIdx]) return
  lines[lineIdx] = newLine
  emit('update:lyrics', lines.join('\n'))
}
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
      v-for="line in parsedLines"
      :key="line.originalIdx"
      :class="{ 'mb-2': line.type !== 'chord' && !isLyricsMode }"
    >
      <template v-if="line.type === 'chord'">
        <template v-for="(token, tokenIdx) in line.tokens" :key="tokenIdx">
          <input
            v-if="editing && editing.lineIdx === line.originalIdx && editing.tokenIdx === tokenIdx"
            :ref="(el) => (el as HTMLInputElement | null)?.focus()"
            v-model="editText"
            class="chord-edit-input text-blue-darken-4 bg-grey-lighten-3 px-1 mx-n1 rounded"
            :style="{ width: Math.max(editText.length + 1, 3) + 'ch' }"
            @keydown.enter="commitEdit"
            @keydown.esc="editing = null"
            @blur="commitEdit"
          />
          <strong
            v-else-if="token.isChord"
            class="text-blue-darken-4 bg-grey-lighten-3 px-1 mx-n1 rounded"
            :style="editable ? { cursor: 'pointer' } : undefined"
            @click="startEdit(line.originalIdx, tokenIdx, token.text)"
          >
            {{ token.text }}
          </strong>
          <template v-else>{{ token.text }}</template>
        </template>
      </template>
      <template v-else>{{ line.text || ' ' }}</template>
    </div>
  </div>
</template>

<style scoped>
.chord-edit-input {
  font: inherit;
  font-weight: bold;
  border: none;
  outline: 2px solid rgb(var(--v-theme-primary));
}
</style>
