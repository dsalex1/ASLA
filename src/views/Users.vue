<script setup lang="ts">
import Backbutton from '@/components/Backbutton.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { firebaseConfig, setlistCollection, userCollection, useEmulators } from '@/plugins/firebase'
import { HOME_ROUTE } from '@/router'
import { Role, UserProfile } from '@/types'
import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut } from 'firebase/auth'
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
import { ref } from 'vue'
import { useCollection } from 'vuefire'
import { auth } from '@/plugins/firebase'
import { useAuth } from '@/stores/auth'

const users = useCollection(userCollection)
// An admin who demoted or revoked themselves would be locked out of this page, and with
// no admin left nobody could put it back: the rules let only an admin write these.
const authStore = useAuth()
const isSelf = (user: UserProfile) => user.id === authStore.user?.uid
const setlists = useCollection(setlistCollection)

const error = ref('')
const notice = ref('')
const creating = ref(false)
const form = ref({ email: '', password: '', role: 'user' as Role })

/**
 * Creating an account signs that account in, which would throw the admin out of their own
 * session. A second Firebase app has its own auth state, so the new user is created and
 * signed out over there while the admin stays signed in here.
 */
async function createUser() {
  error.value = notice.value = ''
  creating.value = true
  const secondary = initializeApp(firebaseConfig, `create-user-${Date.now()}`)
  const secondaryAuth = getAuth(secondary)
  if (useEmulators) connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9099', { disableWarnings: true })
  try {
    const { user } = await createUserWithEmailAndPassword(secondaryAuth, form.value.email, form.value.password)
    await setDoc(doc(userCollection, user.uid), { email: form.value.email, role: form.value.role, setlists: [] })
    notice.value = `Created ${form.value.email}.`
    form.value = { email: '', password: '', role: 'user' }
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    await signOut(secondaryAuth)
    await deleteApp(secondary)
    creating.value = false
  }
}

const setRole = (user: UserProfile, role: Role) =>
  isSelf(user) ? undefined : updateDoc(doc(userCollection, user.id!), { role })

const setSetlists = (user: UserProfile, ids: string[]) => updateDoc(doc(userCollection, user.id!), { setlists: ids })

/**
 * Takes the profile away, which is what access is: without one an account can neither
 * write nor see a setlist. The login itself survives — deleting that needs the Firebase
 * console, as no client may delete an account other than its own.
 */
async function revoke(user: UserProfile) {
  if (isSelf(user)) return
  if (!confirm(`Remove ${user.email}'s access? They will no longer see any setlist.`)) return
  await deleteDoc(doc(userCollection, user.id!))
}

async function resetPassword(user: UserProfile) {
  error.value = notice.value = ''
  try {
    await sendPasswordResetEmail(auth, user.email)
    notice.value = `Password reset email sent to ${user.email}.`
  } catch (e) {
    error.value = (e as Error).message
  }
}
</script>

<template>
  <AppLayout>
    <h2 class="d-flex align-center">
      <Backbutton :to="HOME_ROUTE" />
      <div style="flex: 1">Users</div>
    </h2>

    <v-alert v-if="error" type="error" class="mb-4" :text="error" closable @click:close="error = ''" />
    <v-alert v-if="notice" type="success" class="mb-4" :text="notice" closable @click:close="notice = ''" />

    <v-card class="mb-6">
      <v-card-title>Add a user</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="createUser">
          <div class="d-flex flex-wrap ga-3 align-start">
            <v-text-field v-model="form.email" label="Email" density="compact" style="min-width: 220px; flex: 1" />
            <v-text-field
              v-model="form.password"
              label="Password"
              type="text"
              hint="At least 6 characters"
              density="compact"
              style="min-width: 200px; flex: 1"
            />
            <v-select
              v-model="form.role"
              :items="['user', 'admin']"
              label="Role"
              density="compact"
              style="min-width: 140px"
            />
            <v-btn
              :loading="creating"
              :disabled="!form.email || form.password.length < 6"
              type="submit"
              color="primary"
              prepend-icon="fas fa-user-plus"
            >
              Create
            </v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>

    <v-card v-for="user in users" :key="user.id" class="mb-3">
      <v-card-title class="d-flex align-center flex-wrap ga-2">
        <span class="text-body-1 text-truncate" style="flex: 1 1 200px; min-width: 0">{{ user.email }}</span>
        <!-- your own row shows the role rather than offering it: a disabled toggle greys
             both halves, and then you cannot even read which one you are -->
        <v-chip v-if="isSelf(user)" size="small" color="primary" variant="flat">{{ user.role }}</v-chip>
        <v-btn-toggle
          v-else
          :model-value="user.role"
          density="compact"
          variant="outlined"
          divided
          mandatory
          @update:model-value="(role: Role) => setRole(user, role)"
        >
          <v-btn value="user" size="small">user</v-btn>
          <v-btn value="admin" size="small">admin</v-btn>
        </v-btn-toggle>
        <v-btn size="small" variant="text" prepend-icon="fas fa-key" @click="resetPassword(user)">Reset password</v-btn>
        <v-btn
          v-if="!isSelf(user)"
          size="small"
          variant="text"
          color="error"
          prepend-icon="fas fa-user-slash"
          @click="revoke(user)"
        >
          Revoke
        </v-btn>
        <span v-else class="text-grey text-caption">that's you</span>
      </v-card-title>
      <v-card-text>
        <v-select
          v-if="user.role !== 'admin'"
          :model-value="user.setlists ?? []"
          :items="setlists.map((s) => ({ title: s.name || 'Untitled', value: s.id }))"
          label="Setlists this user can see"
          multiple
          chips
          closable-chips
          density="compact"
          hide-details
          @update:model-value="(ids: string[]) => setSetlists(user, ids)"
        />
        <span v-else class="text-grey">Admins see every setlist and can change anything.</span>
      </v-card-text>
    </v-card>
  </AppLayout>
</template>
