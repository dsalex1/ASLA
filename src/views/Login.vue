<script setup lang="ts">
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import { auth } from '@/plugins/firebase'
import { useAuth } from '@/stores/auth'
import { sendPasswordResetEmail } from '@firebase/auth'
import { reactive, ref } from 'vue'

const ENV = import.meta.env

const authStore = useAuth()
const error = ref('')
const loading = ref(false)
const success = ref('')

const user = reactive({
  email: '',
  password: '',
})

async function forgetPassword() {
  try {
    await sendPasswordResetEmail(auth, user.email)
    success.value = 'Password reset email sent.'
    error.value = ''
  } catch (e) {
    error.value = 'No user found with this email.'
  }
}
const login = async (event: any) => {
  if (!(await event).valid) return
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    await authStore.login(user.email, user.password)
  } catch (e) {
    error.value = 'Wrong credentials.'
  }
  loading.value = false
}
</script>

<template>
  <div v-if="authStore.user === undefined" class="d-flex justify-center align-center" style="height: 100dvh">
    <LoadingSpinner />
  </div>
  <v-container v-else class="d-flex flex-column align-center">
    <v-img class="mt-12 border rounded" width="128" height="128" src="@/assets/logo.svg"></v-img>
    <h2 class="mt-2 mb-10">{{ ENV.VITE_APP_NAME }}</h2>
    <v-sheet max-width="400" width="400" class="mx-auto">
      <h1 class="text-h4 mb-2">Login</h1>
      <v-alert color="success mb-2" v-if="success" :text="success"></v-alert>
      <v-form validate-on="submit" @submit.prevent="login" width="100%">
        <v-text-field
          :rules="[(v) => !!v || 'Please enter your password.']"
          v-model="user.email"
          label="Email"
        ></v-text-field>

        <v-text-field
          :rules="[(v) => !!v || 'Please enter your email address.']"
          v-model="user.password"
          type="password"
          label="Password"
        ></v-text-field>
        <p class="text-error" v-if="error">{{ error }}</p>
        <v-btn :loading="loading" type="submit" color="primary" class="me-2 mt-4">Login</v-btn>
        <v-btn variant="text" color="primary" class="mt-4" @click="forgetPassword" v-if="error">Forgot Password?</v-btn>
      </v-form>
    </v-sheet>
  </v-container>
</template>
