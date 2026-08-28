<script setup lang="ts">
import { installUpdate, updateReady } from '@/composables/useAppUpdate'
</script>

<template>
  <!-- no timeout: a new build is worth staying on screen until it is taken or dismissed -->
  <v-snackbar v-model="updateReady" :timeout="-1" color="primary" location="bottom">
    A new version is available.
    <template #actions>
      <v-btn variant="text" @click="installUpdate()">Update</v-btn>
      <v-btn variant="text" icon="fas fa-xmark" aria-label="Dismiss" @click="updateReady = false" />
    </template>
  </v-snackbar>
</template>
