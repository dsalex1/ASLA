<script setup lang="ts">
/** basically auto generated from claude 4 sonnet */
import { songCollection } from '@/plugins/firebase'
import { Song } from '@/types'
import { addDoc } from 'firebase/firestore'
import { ref } from 'vue'

const dialog = ref(false)
const loading = ref(false)
const error = ref('')

const formData = ref<
  Omit<
    Song,
    'id' | 'filename' | 'pdfStorageRef' | 'drumsPdfStorageRef' | 'pdfStorageSHA' | 'lyrics' | 'nadine_moderation'
  >
>({
  name: '',
  key_signature: undefined,
  bpm: undefined,
  duration: undefined,
  ibi_instrument: undefined,
})

// Auto-generate filename based on name
function generateFilename(name: string): string {
  if (!name.trim()) return ''
  return name.toLowerCase().replace(/\s+/g, '-') + '.pdf'
}

const strCrossProduct = <const T extends string, const U extends string>(arr1: T[], arr2: U[]): `${T}${U}`[] =>
  arr2.flatMap((b) => arr1.map((a) => `${a}${b}` as `${T}${U}`))

async function createSong() {
  if (!formData.value.name?.trim()) {
    error.value = 'Name is required'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const filename = generateFilename(formData.value.name)

    const songData: Omit<Song, 'id'> = {
      filename,
      name: formData.value.name,
      key_signature: formData.value.key_signature,
      bpm: formData.value.bpm,
      duration: formData.value.duration,
      ibi_instrument: formData.value.ibi_instrument,
    }

    await addDoc(songCollection, JSON.parse(JSON.stringify(songData))) // get rid of undefined fields

    // Reset form
    formData.value = {
      name: '',
      key_signature: undefined,
      bpm: undefined,
      duration: undefined,
      ibi_instrument: undefined,
    }

    dialog.value = false
  } catch (e) {
    console.error(e)
    error.value = 'An error occurred while creating the song.'
  } finally {
    loading.value = false
  }
}

function resetForm() {
  formData.value = {
    name: '',
    key_signature: undefined,
    bpm: undefined,
    duration: undefined,
    ibi_instrument: undefined,
  }
  error.value = ''
}
</script>

<template>
  <div>
    <!-- Button to open modal -->
    <v-btn @click="dialog = true" color="primary" prepend-icon="fas fa-plus" variant="tonal">Add Song</v-btn>

    <!-- Modal Dialog -->
    <v-dialog v-model="dialog" max-width="600px" persistent>
      <v-card>
        <v-card-title>
          <span class="text-h5">Create New Song</span>
        </v-card-title>

        <v-card-text>
          <v-container>
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="formData.name"
                  label="Song Name *"
                  :rules="[(v) => !!v || 'Name is required']"
                  variant="outlined"
                  hide-details="auto"
                  density="compact"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-text-field
                  :model-value="generateFilename(formData.name || '')"
                  label="Generated Filename"
                  variant="outlined"
                  readonly
                  hide-details
                  density="compact"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-autocomplete
                  v-model="formData.key_signature"
                  :items="
                    strCrossProduct(strCrossProduct(['C', 'D', 'E', 'F', 'G', 'A', 'B'], ['', '#', 'b']), ['', 'm'])
                  "
                  label="Key Signature"
                  variant="outlined"
                  hide-details
                  clearable
                  density="compact"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="formData.bpm"
                  label="BPM"
                  type="number"
                  :min="0"
                  :max="300"
                  variant="outlined"
                  hide-details
                  density="compact"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-select
                  v-model="formData.ibi_instrument"
                  :items="['Bass', 'A.Git', 'E.Git']"
                  label="Ibi Instrument"
                  variant="outlined"
                  hide-details
                  clearable
                  density="compact"
                />
              </v-col>

              <v-col cols="12">
                <div class="d-flex align-center">
                  <v-text-field
                    :model-value="formData.duration ? Math.floor(formData.duration / 60) : ''"
                    @update:model-value="
                      (value) => {
                        formData.duration =
                          (value ? parseInt(value) : 0) * 60 + (formData.duration ? formData.duration % 60 : 0)
                      }
                    "
                    label="Minutes"
                    type="number"
                    :min="0"
                    :max="99"
                    variant="outlined"
                    hide-details
                    style="max-width: 120px"
                    density="compact"
                  />
                  <span class="mx-2">:</span>
                  <v-text-field
                    :model-value="formData.duration ? formData.duration % 60 : ''"
                    @update:model-value="
                      (value) => {
                        formData.duration =
                          (formData.duration ? Math.floor(formData.duration / 60) : 0) * 60 +
                          (value ? parseInt(value) : 0)
                      }
                    "
                    label="Seconds"
                    type="number"
                    :min="0"
                    :max="59"
                    variant="outlined"
                    hide-details
                    style="max-width: 120px"
                    density="compact"
                  />
                </div>
              </v-col>
            </v-row>

            <v-alert v-if="error" type="error" class="mt-4">
              {{ error }}
            </v-alert>
          </v-container>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey darken-1" variant="text" @click=";(dialog = false), resetForm()" :disabled="loading">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            @click="createSong"
            :loading="loading"
            :disabled="!formData.name?.trim()"
          >
            Create Song
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
