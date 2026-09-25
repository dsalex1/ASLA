<script setup lang="ts">
import { autoNumbers } from '@/helpers/autoNumber'
import { Loop, Marker } from '@/types'
import { computed, nextTick, ref } from 'vue'

/**
 * Every saved loop and marker on the track as a list down the side of the waveform, so a
 * track with a lot of them can be got around by name rather than by hunting for flags.
 * Loops come first: this only shows while looping, which is what they are wanted for.
 */
const props = defineProps<{
  loops: Loop[]
  markers: Marker[]
  /** the saved loop the A-B stands on, or -1 */
  selectedLoop: number
  position: number
  /** renaming and deleting are writes; a read-only account can only pick */
  editable: boolean
}>()

const emit = defineEmits<{
  (e: 'selectLoop', index: number): void
  (e: 'renameLoop', index: number, name: string): void
  (e: 'deleteLoop', index: number): void
  (e: 'seek', seconds: number): void
  (e: 'renameMarker', index: number, name: string): void
  (e: 'deleteMarker', index: number): void
}>()

const open = defineModel<boolean>('open', { default: false })

const loopNumbers = computed(() => autoNumbers(props.loops.map((l) => ({ at: l.a, name: l.name }))))
const markerNumbers = computed(() => autoNumbers(props.markers))

// loops are stored in the order they were saved; the list reads in the order they play
const loopRows = computed(() =>
  props.loops
    .map((loop, index) => ({ loop, index, label: loop.name || `Loop ${loopNumbers.value[index] ?? ''}` }))
    .sort((a, b) => a.loop.a - b.loop.a)
)
const markerRows = computed(() =>
  props.markers.map((marker, index) => ({ marker, index, label: marker.name || `Marker ${markerNumbers.value[index] ?? ''}` }))
)

/** the marker the playhead is at or has most recently passed */
const currentMarker = computed(() => {
  let found = -1
  props.markers.forEach((m, i) => m.at <= props.position + 0.05 && (found = i))
  return found
})

const time = (seconds: number) => {
  const safe = Math.max(0, seconds)
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`
}

// --- renaming in place ---
const editing = ref<{ kind: 'loop' | 'marker'; index: number } | null>(null)
const draft = ref('')
const field = ref<HTMLInputElement[] | null>(null)

async function startRename(kind: 'loop' | 'marker', index: number, name = '') {
  editing.value = { kind, index }
  draft.value = name
  await nextTick()
  field.value?.[0]?.focus()
  field.value?.[0]?.select()
}

function commitRename() {
  const current = editing.value
  if (!current) return
  editing.value = null
  const name = draft.value.trim()
  if (current.kind === 'loop') emit('renameLoop', current.index, name)
  else emit('renameMarker', current.index, name)
}

const isEditing = (kind: 'loop' | 'marker', index: number) => editing.value?.kind === kind && editing.value.index === index
</script>

<template>
  <div class="lm-list" :class="{ 'lm-list--open': open }">
    <button
      v-if="!open"
      class="lm-tab"
      aria-label="Show loops and markers"
      title="Loops and markers"
      @click="open = true"
    >
      <i class="fas fa-list-ul" />
      <span class="lm-count">{{ loops.length + markers.length }}</span>
    </button>

    <div v-else class="lm-panel">
      <div class="lm-head">
        <span>Loops &amp; markers</span>
        <button class="lm-icon" aria-label="Hide loops and markers" @click="open = false">
          <i class="fas fa-chevron-left" />
        </button>
      </div>

      <div class="lm-scroll">
        <div class="lm-section">Loops</div>
        <div v-if="!loopRows.length" class="lm-empty">None saved yet: set A and B, then +</div>
        <div
          v-for="row in loopRows"
          :key="`l${row.index}`"
          class="lm-row"
          :class="{ 'lm-row--on': row.index === selectedLoop }"
        >
          <i class="fas fa-repeat lm-kind lm-kind--loop" />
          <input
            v-if="isEditing('loop', row.index)"
            ref="field"
            v-model="draft"
            class="lm-field"
            :placeholder="`Loop ${loopNumbers[row.index] ?? ''}`"
            aria-label="Loop name"
            @keydown.enter="commitRename"
            @keydown.esc="editing = null"
            @blur="commitRename"
          />
          <button v-else class="lm-pick" @click="emit('selectLoop', row.index)">
            <span class="lm-label">{{ row.label }}</span>
            <span class="lm-time">{{ time(row.loop.a) }}–{{ time(row.loop.b) }}</span>
          </button>
          <template v-if="editable && !isEditing('loop', row.index)">
            <button class="lm-icon" aria-label="Rename loop" @click="startRename('loop', row.index, row.loop.name)">
              <i class="fas fa-pen" />
            </button>
            <button class="lm-icon lm-icon--danger" aria-label="Delete loop" @click="emit('deleteLoop', row.index)">
              <i class="fas fa-trash" />
            </button>
          </template>
        </div>

        <div class="lm-section">Markers</div>
        <div v-if="!markerRows.length" class="lm-empty">No markers yet</div>
        <div
          v-for="row in markerRows"
          :key="`m${row.index}`"
          class="lm-row"
          :class="{ 'lm-row--on': row.index === currentMarker }"
        >
          <i class="fas lm-kind" :class="row.marker.skip ? 'fa-forward-step lm-kind--skip' : 'fa-flag lm-kind--marker'" />
          <input
            v-if="isEditing('marker', row.index)"
            ref="field"
            v-model="draft"
            class="lm-field"
            :placeholder="`Marker ${markerNumbers[row.index] ?? ''}`"
            aria-label="Marker name"
            @keydown.enter="commitRename"
            @keydown.esc="editing = null"
            @blur="commitRename"
          />
          <button v-else class="lm-pick" @click="emit('seek', row.marker.at)">
            <span class="lm-label">{{ row.label }}</span>
            <span class="lm-time">{{ time(row.marker.at) }}</span>
          </button>
          <template v-if="editable && !isEditing('marker', row.index)">
            <button class="lm-icon" aria-label="Rename marker" @click="startRename('marker', row.index, row.marker.name)">
              <i class="fas fa-pen" />
            </button>
            <button class="lm-icon lm-icon--danger" aria-label="Delete marker" @click="emit('deleteMarker', row.index)">
              <i class="fas fa-trash" />
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* laid over the left of the wave: that side is what has already played, and the canvas
   keeps its width, so the playhead stays in the middle */
.lm-list {
  position: absolute;
  left: 0;
  top: 50%;
  z-index: 15;
  transform: translateY(-50%);
}
.lm-list--open {
  top: 0;
  bottom: 0;
  transform: none;
  width: min(240px, 70%);
}

.lm-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 26px;
  padding: 8px 0;
  border: 1px solid #333;
  border-left: none;
  border-radius: 0 6px 6px 0;
  background: rgba(20, 20, 20, 0.9);
  color: #f59e0b;
  font-size: 12px;
  cursor: pointer;
}
.lm-count {
  font-size: 10px;
  color: #aaa;
}

.lm-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid #2a2a2a;
  background: rgba(16, 16, 16, 0.96);
  box-shadow: 8px 0 24px rgb(0 0 0 / 50%);
}
.lm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 4px 10px;
  border-bottom: 1px solid #222;
  font-size: 12px;
  font-weight: 600;
  color: #cfcfcf;
}
.lm-scroll {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 6px;
}
.lm-section {
  padding: 8px 10px 2px;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #777;
}
.lm-empty {
  padding: 2px 10px 4px;
  font-size: 11px;
  color: #666;
}

.lm-row {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px 0 8px;
  min-height: 34px;
}
.lm-row--on {
  background: rgba(245, 158, 11, 0.16);
}
.lm-kind {
  width: 14px;
  font-size: 11px;
  text-align: center;
}
.lm-kind--loop {
  color: #f59e0b;
}
.lm-kind--marker {
  color: #4a90d9;
}
.lm-kind--skip {
  color: #ef4444;
}

.lm-pick {
  display: flex;
  flex: 1;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
  padding: 6px 4px;
  border: none;
  background: none;
  color: #e8e8e8;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.lm-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lm-time {
  flex: none;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: #888;
}
.lm-field {
  flex: 1;
  min-width: 0;
  height: 28px;
  margin: 3px 0;
  padding-inline: 6px;
  border: 1px solid #f59e0b;
  border-radius: 5px;
  background: #0d0d0d;
  color: #eee;
  font-size: 13px;
}

.lm-icon {
  flex: none;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 5px;
  background: none;
  color: #888;
  font-size: 11px;
  cursor: pointer;
}
.lm-icon:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ddd;
}
.lm-icon--danger:hover {
  color: #ef4444;
}
</style>
