<template>
  <RouterLink class="text-decoration-none" :to="to"
    ><v-btn icon="fas fa-angle-left" color="black" class="mt-n1 ms-0 me-n1" variant="plain"></v-btn
  ></RouterLink>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{ to: string }>()
</script>
