<script setup lang="ts">
import AppUpdatePrompt from '@/components/AppUpdatePrompt.vue'
import { HOME_ROUTE } from '@/router'
import { useAccess } from '@/composables/useAccess'
import { useAuth } from '@/stores/auth'
import { RouterLink } from 'vue-router'

const auth = useAuth()
const { isAdmin } = useAccess()

// the beta tag belongs to the beta channel only: a production build stamps nothing and
// shows the bare version
const version = `V${__APP_VERSION__}${__BETA_BUILD__ ? `-beta${__BETA_BUILD__}` : ''}`
</script>
<template>
  <v-app>
    <v-toolbar color="primary" dark class="sticky-top">
      <RouterLink :to="HOME_ROUTE" style="text-decoration: none">
        <div class="d-flex flex-column align-center">
          <img style="filter: invert()" src="@/assets/logo.svg" width="40" height="40" class="mx-3" />
          <span style="color: white; font-size: 10px">{{ version }}</span>
        </div>
      </RouterLink>
      <v-spacer></v-spacer>

      <RouterLink v-if="isAdmin" to="/users" class="me-3">
        <v-btn prepend-icon="fas fa-users" color="white" variant="text">users</v-btn>
      </RouterLink>
      <span class="me-3">{{ auth.user?.email }}</span>
      <v-btn prepend-icon="fas fa-sign-out" color="white" variant="outlined" @click="auth.logout">Logout</v-btn>
    </v-toolbar>

    <v-container><slot></slot></v-container>

    <AppUpdatePrompt />
  </v-app>
</template>
