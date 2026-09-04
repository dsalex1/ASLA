import { auth, userCollection } from '@/plugins/firebase'
import type { UserProfile } from '@/types'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { computed, ref } from 'vue'

/**
 * The signed-in account's role, read once at module scope so the router guard can consult
 * it without a component around. `undefined` means it has not been read yet, `null` that
 * nobody is signed in.
 *
 * An account with no profile document gets nothing: it cannot write, and it is assigned no
 * setlists, so it sees an empty list. Only an admin may write the collection, which means
 * the first admin has to be created outside the app — from the Firebase console, or by the
 * emulator seed.
 */
const profile = ref<UserProfile | null | undefined>(undefined)

let stopProfile: (() => void) | undefined

onAuthStateChanged(auth, (u) => {
  stopProfile?.()
  if (!u) {
    profile.value = null
    return
  }
  // live, so an admin granting a setlist shows up on the other device without a reload
  stopProfile = onSnapshot(doc(userCollection, u.uid), (snap) => {
    profile.value = snap.data() ?? { email: u.email ?? '', role: 'user', setlists: [] }
  })
})

export const isAdmin = computed(() => profile.value?.role === 'admin')

/** admins write, everyone else reads; the security rules enforce the same split */
export const canWrite = isAdmin

/** the profile has been read, so a decision made from it is not made too early */
export const accessReady = computed(() => profile.value !== undefined)

/** admins see every setlist; a plain user sees the ones assigned to them */
export function canSeeSetlist(setlistId: string | undefined) {
  if (isAdmin.value) return true
  return !!setlistId && !!profile.value?.setlists?.includes(setlistId)
}

export function useAccess() {
  return { profile, isAdmin, canWrite, accessReady, canSeeSetlist }
}
