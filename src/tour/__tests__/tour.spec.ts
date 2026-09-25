import TourGuide from '@/tour/TourGuide.vue'
import { AUDIO_TOUR, APP_TOUR, SHEETS_TOUR, TOURS } from '@/tour/tours'
import { stepsFor, useTour } from '@/tour/useTour'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

vi.mock('@/router', () => ({ HOME_ROUTE: '/setlist' }))

const route = reactive({ path: '/setlist' })
const push = vi.fn(async (path: string) => void (route.path = path))
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRoute: () => route,
  useRouter: () => ({ push }),
}))

const tour = useTour()

/** puts the markup a guide looks for on the page, standing in for the real screens */
function page(html: string) {
  let root = document.getElementById('page')
  if (!root) document.body.appendChild((root = Object.assign(document.createElement('div'), { id: 'page' })))
  root.innerHTML = html
}

/** what has been seen, written the way another tab would, so the open guide state hears it */
function setSeen(seen: Record<string, boolean> | null) {
  const value = seen && JSON.stringify(seen)
  if (value) localStorage.setItem('tour.seen', value)
  else localStorage.removeItem('tour.seen')
  window.dispatchEvent(new StorageEvent('storage', { key: 'tour.seen', newValue: value, storageArea: localStorage }))
}

const cardTitle = () => document.querySelector('.tour-title')?.textContent
const press = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.tour-btn')].find((b) => b.textContent?.trim() === label)!.click()

/** long enough for the page watcher to notice and for each lookup to settle */
const settle = async () => {
  await vi.advanceTimersByTimeAsync(400)
  await flushPromises()
}

beforeEach(() => {
  vi.useFakeTimers()
  tour.finish()
  setSeen(null)
  route.path = '/setlist'
  // happy-dom lays nothing out, and the guide passes over what has no size
  Element.prototype.getBoundingClientRect = vi.fn(() => ({ left: 10, top: 10, width: 100, height: 40, right: 110, bottom: 50 }) as DOMRect)
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  tour.finish()
  vi.useRealTimers()
  document.getElementById('page')?.remove()
})

describe('which steps an account gets', () => {
  it('leaves the admin steps out for a plain user, and the user ones out for an admin', () => {
    const user = stepsFor(APP_TOUR, false).map((s) => s.title)
    const admin = stepsFor(APP_TOUR, true).map((s) => s.title)
    expect(user).toContain('Only what is shared with you')
    expect(user).not.toContain('Adding a song')
    expect(admin).toContain('Adding a song')
    expect(admin).not.toContain('Only what is shared with you')
  })
})

describe('TourGuide', () => {
  it('starts the audio guide by itself the first time the player is on screen', async () => {
    mount(TourGuide, { attachTo: document.body })
    await settle()
    expect(tour.active.value).toBeNull()

    route.path = '/setlist/abc'
    page('<div class="audio-pane"><div class="waveform"></div></div>')
    await settle()
    expect(tour.active.value?.id).toBe(AUDIO_TOUR.id)
    expect(cardTitle()).toBe('The waveform')
  })

  it('passes over optional steps whose target is not there', async () => {
    page('<div class="audio-pane"><div class="waveform"></div><div class="group group--centre"></div></div>')
    route.path = '/setlist/abc'
    mount(TourGuide, { attachTo: document.body })
    await settle()
    press('Next') // flags
    await settle()
    press('Next') // the admin's moving flags
    await settle()
    // no overview strip on this page, so straight on to the transport once it has been looked for
    press('Next')
    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()
    expect(cardTitle()).toBe('Transport')
  })

  it('is not sprung again once skipped, but can be asked for', async () => {
    route.path = '/setlist/abc'
    page('<div class="audio-pane"><div class="waveform"></div></div>')
    const wrapper = mount(TourGuide, { attachTo: document.body })
    await settle()
    press('Skip guide')
    await settle()
    expect(tour.active.value).toBeNull()
    expect(tour.hasSeen(AUDIO_TOUR.id)).toBe(true)

    wrapper.unmount()
    mount(TourGuide, { attachTo: document.body })
    await settle()
    expect(tour.active.value).toBeNull()

    tour.startHere() // the player is up, so it is the player's guide
    await settle()
    expect(tour.active.value?.id).toBe(AUDIO_TOUR.id)
  })

  it('starts a guide queued for later once its screen comes up', async () => {
    setSeen({ 'app:admin': true, 'audio:admin': true })
    mount(TourGuide, { attachTo: document.body })
    tour.startNextTime(AUDIO_TOUR.id)
    await settle()
    expect(tour.active.value).toBeNull()

    page('<div class="audio-pane"><div class="waveform"></div></div>')
    await settle()
    expect(tour.active.value?.id).toBe(AUDIO_TOUR.id)
  })

  it('goes to the page a step is on', async () => {
    setSeen({ 'app:admin': true, 'audio:admin': true })
    route.path = '/song'
    mount(TourGuide, { attachTo: document.body })
    tour.start(APP_TOUR.id)
    await settle()
    expect(push).toHaveBeenCalledWith('/setlist')
    expect(cardTitle()).toBe('Welcome')
  })

  it('starts the sheet guide over a song that is not in the player', async () => {
    route.path = '/setlist/abc'
    page('<div class="song-info-bar"></div>')
    mount(TourGuide, { attachTo: document.body })
    await settle()
    expect(tour.active.value?.id).toBe(SHEETS_TOUR.id)
  })

  it('passes over a step that could not set its screen up, and tidies up at the end', async () => {
    const end = vi.fn()
    const guide = {
      id: 'test',
      title: 'Test',
      trigger: '#never',
      end,
      steps: [
        { title: 'One', body: [] },
        { title: 'Two', body: [], before: () => false },
        { title: 'Three', body: [] },
      ],
    }
    TOURS.push(guide)
    try {
      mount(TourGuide, { attachTo: document.body })
      tour.start('test')
      await settle()
      press('Next')
      await settle()
      expect(cardTitle()).toBe('Three')
      press('Done')
      await settle()
      expect(end).toHaveBeenCalledOnce()
    } finally {
      TOURS.splice(TOURS.indexOf(guide), 1)
    }
  })

  it('closes on Escape', async () => {
    mount(TourGuide, { attachTo: document.body })
    tour.start(APP_TOUR.id)
    await settle()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(tour.active.value).toBeNull()
  })
})
