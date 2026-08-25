import LyricsPane from '@/components/LyricsPane.vue'
import { Song } from '@/types'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const SCROLL_HEIGHT = 1000
const CLIENT_HEIGHT = 200
const END_SCROLL = SCROLL_HEIGHT - CLIENT_HEIGHT

const song = (over: Partial<Song> = {}): Song => ({ filename: 'a', name: 'A', lyrics: 'la la la', duration: 200, ...over })

const mountPane = async (props: Record<string, unknown> = {}) => {
  const wrapper = mount(LyricsPane, {
    props: { song: song(), lyricsMode: 'lyrics', fontSize: 16, ...props },
  })
  const container = wrapper.find('div').element
  Object.defineProperty(container, 'scrollHeight', { value: SCROLL_HEIGHT, configurable: true })
  Object.defineProperty(container, 'clientHeight', { value: CLIENT_HEIGHT, configurable: true })
  container.scrollTop = 0
  await wrapper.vm.$nextTick()
  return { wrapper, container }
}

beforeEach(() => vi.restoreAllMocks())

describe('LyricsPane audio-driven scrolling', () => {
  // the scroll starts 20s in and finishes 40s before the end, matching the timer behaviour
  it.each([
    [20, 0],
    [90, END_SCROLL / 2],
    [160, END_SCROLL],
    [190, END_SCROLL], // clamped past the end
    [5, 0], // clamped before the start
  ])('at %is the lyrics sit at %i', async (position, expected) => {
    const { wrapper, container } = await mountPane({ autoScroll: true, position: 0 })
    await wrapper.setProps({ position })
    expect(container.scrollTop).toBe(Math.round(expected))
  })

  it('ignores the playhead when autoscroll is off', async () => {
    const { wrapper, container } = await mountPane({ autoScroll: false, position: 0 })
    await wrapper.setProps({ position: 90 })
    expect(container.scrollTop).toBe(0)
  })

  it('stops following once the reader scrolls ahead by hand', async () => {
    const { wrapper, container } = await mountPane({ autoScroll: true, position: 0 })
    container.scrollTop = 500 // reader scrolled ahead
    await wrapper.setProps({ position: 25 })
    container.scrollTop = 500
    await wrapper.setProps({ position: 90 })
    expect(container.scrollTop).toBe(500) // left where the reader put it
  })

  it('picks the lyrics back up when playback is started again', async () => {
    const { wrapper, container } = await mountPane({ autoScroll: true, position: 0 })
    container.scrollTop = 500
    await wrapper.setProps({ position: 25 }) // cancels the follow
    await wrapper.setProps({ autoScroll: false })
    await wrapper.setProps({ autoScroll: true })
    container.scrollTop = 0
    await wrapper.setProps({ position: 90 })
    expect(container.scrollTop).toBe(Math.round(END_SCROLL / 2))
  })

  it('falls back to 150s when the song has no duration', async () => {
    const { wrapper, container } = await mountPane({ song: song({ duration: undefined }), autoScroll: true, position: 0 })
    await wrapper.setProps({ position: (150 - 40 + 20) / 2 }) // halfway between the 20s start and the 110s end
    expect(container.scrollTop).toBe(Math.round(END_SCROLL / 2))
  })

  it('does not run the timer when a playhead is driving it', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    await mountPane({ autoScroll: true, position: 0 })
    expect(raf).not.toHaveBeenCalled()
  })
})

describe('LyricsPane timer scrolling', () => {
  it('runs the timer when there is no playhead', async () => {
    vi.useFakeTimers()
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    await mountPane({ autoScroll: true })
    await vi.advanceTimersByTimeAsync(200)
    vi.useRealTimers()
    expect(raf).toHaveBeenCalled()
  })
})

describe('LyricsPane content', () => {
  it('shows the moderation block only when asked', async () => {
    const props = { song: song({ nadine_moderation: 'say hi' }) }
    expect((await mountPane(props)).wrapper.text()).not.toContain('say hi')
    expect((await mountPane({ ...props, showModeration: true })).wrapper.text()).toContain('say hi')
  })

  it('shows the no-sheet hint when given one', async () => {
    expect((await mountPane({ noSheetHint: 'No sheet file - A' })).wrapper.text()).toContain('No sheet file - A')
  })

  it('says so when the song has no lyrics', async () => {
    expect((await mountPane({ song: song({ lyrics: undefined }) })).wrapper.text()).toContain('No lyrics yet')
  })
})
