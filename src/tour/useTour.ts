import { useAccess } from '@/composables/useAccess'
import { useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'
import { Tour, TourStep, TOURS } from './tours'

/**
 * Which guide is on screen and how far through it is. Module state, so the toolbar's help
 * menu, the song view's menu and the overlay itself all drive the same one.
 */
const active = ref<Tour | null>(null)
const index = ref(0)

/** what was seen is remembered per role: someone made an admin gets the admin's steps */
const seen = useLocalStorage<Record<string, boolean>>('tour.seen', {})
/** a guide asked for somewhere it cannot run yet, to start as soon as it can */
const queued = ref<string | null>(null)

const { isAdmin } = useAccess()
const role = computed(() => (isAdmin.value ? 'admin' : 'user'))
const seenKey = (id: string) => `${id}:${role.value}`

/** the steps this account gets: the admin's are about things a plain user cannot do */
export const stepsFor = (tour: Tour, admin: boolean): TourStep[] =>
  tour.steps.filter((s) => (s.for === 'admin' ? admin : s.for === 'user' ? !admin : true))

const steps = computed(() => (active.value ? stepsFor(active.value, isAdmin.value) : []))
const step = computed((): TourStep | undefined => steps.value[index.value])

function start(id: string) {
  const tour = TOURS.find((t) => t.id === id)
  if (!tour) return
  queued.value = null
  active.value = tour
  index.value = 0
}

/** whichever guide belongs to what is on screen: the player's over the player, else the app's */
function startHere() {
  const here = TOURS.find((t) => t.contextual && document.querySelector(t.trigger))
  start(here?.id ?? 'app')
}

/** for a guide whose screen is not open: it starts the next time that screen is */
function startNextTime(id: string) {
  queued.value = id
}

/** done or skipped alike: either way it is not sprung on anyone again */
function finish() {
  if (active.value) seen.value = { ...seen.value, [seenKey(active.value.id)]: true }
  active.value = null
  index.value = 0
}

export function useTour() {
  return {
    active,
    index,
    steps,
    step,
    queued,
    start,
    startHere,
    startNextTime,
    finish,
    hasSeen: (id: string) => !!seen.value[seenKey(id)],
  }
}
