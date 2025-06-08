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
      component: () => import('@/views/SetlistCreateUpdate.vue'),
    },
    {
      path: '/setlist/:id/overview',
      component: () => import('@/views/SetlistOverview.vue'),
    },
    {
      path: '/setlist/:id/edit',
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
      path: '/settings',
      component: () => import('@/views/Settings.vue'),
    },
    {
      path: '/',
      redirect: LOGIN_ROUTE,
    },
  ],
})

export default router
