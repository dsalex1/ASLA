import { config } from '@vue/test-utils'
import { ref } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { vi } from 'vitest'

// firebase must never really initialise in tests
vi.mock('@/plugins/firebase', () => ({
  app: {},
  auth: {},
  db: {},
  perf: undefined,
  analytics: undefined,
  setlistCollection: { id: 'setlist' },
  songCollection: { id: 'songs' },
  withoutFields: (obj: Record<string, unknown>, ...fields: string[]) => {
    const copy = { ...obj }
    fields.forEach((f) => delete copy[f])
    return copy
  },
}))

vi.mock('firebase/firestore', () => ({
  doc: (col: unknown, id: string) => ({ col, id }),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  query: vi.fn(),
  where: vi.fn(),
  arrayRemove: vi.fn(),
}))

vi.mock('firebase/storage', () => ({
  getStorage: () => ({}),
  ref: (_s: unknown, path: string) => ({ fullPath: path }),
  getDownloadURL: vi.fn((r: { fullPath: string }) => Promise.resolve(`https://files.test/${r.fullPath}`)),
  uploadBytes: vi.fn(() => Promise.resolve()),
  deleteObject: vi.fn(() => Promise.resolve()),
}))

// the role check talks to auth and firestore; components under test are the admin's view
vi.mock('@/composables/useAccess', () => {
  const isAdmin = ref(true)
  return {
    isAdmin,
    canWrite: isAdmin,
    accessReady: ref(true),
    canSeeSetlist: () => true,
    useAccess: () => ({ profile: ref({ email: 'admin@test', role: 'admin' }), isAdmin, canWrite: isAdmin, accessReady: ref(true), canSeeSetlist: () => true }),
  }
})

// components mounted bare are not inside a <router-view>
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  onBeforeRouteLeave: vi.fn(),
}))

vi.mock('@/plugins/sheetBaseDirectory', () => ({
  useSheetBaseDirectory: () => ({ baseDirectory: ref(undefined), pdfTree: ref([]), chooseNewSheetBaseDirectory: vi.fn() }),
}))

vi.mock('vue-pdf-embed', () => ({ default: { name: 'VuePdfEmbed', props: ['source', 'page', 'height'], template: '<div class="pdf-stub" />' } }))

config.global.plugins = [createVuetify({ components, directives })]
config.global.stubs = { transition: false }

// happy-dom has no canvas/audio implementations
Object.assign(globalThis, {
  ResizeObserver: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})
HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never

// happy-dom has no Cache Storage; a Map per named cache is all the offline cache asks for.
// keys() hands back absolute URLs like the real thing, so pathname round-trips the key.
const keyOf = (key: string | Request) => (typeof key === 'string' ? key : new URL(key.url).pathname)
class FakeCache {
  store = new Map<string, Response>()
  async match(key: string | Request) {
    return this.store.get(keyOf(key))?.clone()
  }
  async put(key: string | Request, response: Response) {
    this.store.set(keyOf(key), response)
  }
  async delete(key: string | Request) {
    return this.store.delete(keyOf(key))
  }
  async keys() {
    return [...this.store.keys()].map((key) => new Request(`https://app.test${key}`))
  }
}
const fakeCaches = new Map<string, FakeCache>()
Object.assign(globalThis, {
  caches: {
    open: async (name: string) => fakeCaches.get(name) ?? fakeCaches.set(name, new FakeCache()).get(name)!,
    delete: async (name: string) => fakeCaches.delete(name),
  },
})
