import { accessReady, canSeeSetlist, isAdmin } from '@/composables/useAccess'
import { until } from '@vueuse/core'
import { createRouter, createWebHashHistory } from 'vue-router'

export const HOME_ROUTE = '/setlist'
export const LOGIN_ROUTE = '/login'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.VITE_BASE_URL),
  routes: [
    {
      path: HOME_ROUTE,
      component: () => import('@/views/SetlistsIndex.vue'),
    },
    {
      path: '/setlist/create',
      meta: { admin: true },
      component: () => import('@/views/SetlistCreateUpdate.vue'),
    },
    {
      path: '/setlist/:id/overview',
      component: () => import('@/views/SetlistOverview.vue'),
    },
    {
      path: '/setlist/:id/edit',
      meta: { admin: true },
      component: () => import('@/views/SetlistCreateUpdate.vue'),
    },
    {
      path: '/setlist/:id',
      component: () => import('@/views/SetlistRead.vue'),
    },
    {
      path: LOGIN_ROUTE,
      component: () => import('@/views/Login.vue'),
    },
    {
      path: '/users',
      meta: { admin: true },
      component: () => import('@/views/Users.vue'),
    },
    {
      path: '/settings',
      meta: { admin: true },
      component: () => import('@/views/Settings.vue'),
    },
    {
      path: '/song',
      meta: { admin: true },
      component: () => import('@/views/SongIndex.vue'),
    },
    {
      path: '/folders',
      meta: { admin: true },
      component: () => import('@/views/FolderIndex.vue'),
    },
    {
      // A plain user practises from inside a setlist, which is where the whole transport
      // is; the single-song view is the one that edits and annotates, so it stays admin.
      path: '/song/:id',
      meta: { admin: true },
      component: () => import('@/views/SongView.vue'),
    },
    {
      path: '/',
      redirect: LOGIN_ROUTE,
    },
  ],
})

// Everything a plain user must not reach is kept out here rather than only hidden, so a
// pasted link lands on their own setlists instead of a page they cannot use. Writes are
// refused by the security rules regardless; this is about what is worth showing.
router.beforeEach(async (to) => {
  if (!to.meta.admin && !to.path.startsWith('/setlist/')) return true
  await until(accessReady).toBe(true)
  if (to.meta.admin) return isAdmin.value ? true : HOME_ROUTE
  const id = to.params.id as string | undefined
  return !id || canSeeSetlist(id) ? true : HOME_ROUTE
})

export default router
