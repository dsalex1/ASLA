<script setup lang="ts">
import { HOME_ROUTE } from '@/router'
import { useAuth } from '@/stores/auth'
import { RouterLink } from 'vue-router'

const auth = useAuth()

// the beta tag belongs to the beta channel only: a production build stamps nothing and
// shows the bare version
const version = `V0.0.21${__BETA_BUILD__ ? `-beta${__BETA_BUILD__}` : ''}`
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

      <span class="me-3">{{ auth.user?.email }}</span>
      <v-btn prepend-icon="fas fa-sign-out" color="white" variant="outlined" @click="auth.logout">Logout</v-btn>
    </v-toolbar>

    <v-container><slot></slot></v-container>
  </v-app>
</template>
