<script setup lang="ts">
import AppUpdatePrompt from '@/components/AppUpdatePrompt.vue'
</script>
<template>
  <v-app style="width: 100dvw; height: 100dvh; overflow: hidden">
    <slot></slot>

    <AppUpdatePrompt />
  </v-app>
</template>
