<script setup lang="ts">
import { formatDuration } from '@/helpers'
import { MAX_STEMS, MAX_TRACK_SECONDS, METRONOME, SPLITTABLE, stemIcon, stemLabel } from '@/helpers/stems'
import { AudioTrack } from '@/types'
import { computed, ref, watch } from 'vue'

const props = defineProps<{ track: AudioTrack }>()
const open = defineModel<boolean>({ required: true })

const emit = defineEmits<{ (e: 'split', requested: string[]): void }>()

// what was picked last time is what you usually want again on the next song
const DEFAULTS_KEY = 'stemDefaults'
const remembered = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DEFAULTS_KEY) ?? '') ?? []
  } catch {
    return ['vocals', 'guitars', 'bass', 'drums']
  }
}

const picked = ref<string[]>([])
watch(open, (isOpen) => {
  if (!isOpen) return
  // stems this track already has are pre-ticked, so re-splitting keeps them by default
  const already = props.track.stems?.map((s) => s.name).filter((n) => n !== 'other') ?? []
  picked.value = already.length ? already : remembered()
})

const instruments = computed(() => picked.value.filter((n) => n !== METRONOME))
const tooMany = computed(() => instruments.value.length > MAX_STEMS)
const tooLong = computed(() => props.track.duration > MAX_TRACK_SECONDS)
const canStart = computed(() => instruments.value.length > 0 && !tooMany.value && !tooLong.value)

function toggle(name: string) {
  picked.value = picked.value.includes(name) ? picked.value.filter((n) => n !== name) : [...picked.value, name]
}

function start() {
  localStorage.setItem(DEFAULTS_KEY, JSON.stringify(picked.value))
  emit('split', picked.value)
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="520px">
    <v-card>
      <v-card-title>Split "{{ track.name }}" into stems</v-card-title>
      <v-card-text>
        <p class="text-body-2 text-grey mb-3">
          The parts you pick are separated once and stored with the song, so everyone gets them. Whatever is left over
          stays in the mix as "Other", and the whole track can still be heard with nothing muted.
          <template v-if="track.stems?.length">
            <br />
            This replaces the stems the track has now.
          </template>
        </p>

        <div class="d-flex flex-wrap ga-2 mb-3">
          <v-chip
            v-for="name in SPLITTABLE"
            :key="name"
            :prepend-icon="stemIcon(name)"
            :color="picked.includes(name) ? 'primary' : undefined"
            :variant="picked.includes(name) ? 'flat' : 'outlined'"
            @click="toggle(name)"
          >
            {{ stemLabel(name) }}
          </v-chip>
        </div>

        <v-chip
          :prepend-icon="stemIcon(METRONOME)"
          :color="picked.includes(METRONOME) ? 'primary' : undefined"
          :variant="picked.includes(METRONOME) ? 'flat' : 'outlined'"
          @click="toggle(METRONOME)"
        >
          {{ stemLabel(METRONOME) }}
        </v-chip>
        <div class="text-caption text-grey mt-1">
          A click rendered on the beats found in the recording - it does not count towards the {{ MAX_STEMS }}.
        </div>

        <v-alert v-if="tooMany" type="warning" density="compact" class="mt-3" variant="tonal">
          At most {{ MAX_STEMS }} instruments per split. Split again afterwards to add more.
        </v-alert>
        <v-alert v-else-if="tooLong" type="warning" density="compact" class="mt-3" variant="tonal">
          This track is {{ formatDuration(Math.round(track.duration)) }} - only tracks up to
          {{ formatDuration(MAX_TRACK_SECONDS) }} can be separated.
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text="Cancel" @click="open = false" />
        <v-btn
          color="primary"
          variant="flat"
          :text="track.stems?.length ? 'Replace' : 'Split'"
          :disabled="!canStart"
          @click="start"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
