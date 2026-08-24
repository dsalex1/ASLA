import AudioPane from '@/components/AudioPane.vue'
import { AudioTrack, Song } from '@/types'
import { flushPromises, mount } from '@vue/test-utils'
import { updateDoc } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const engine = {
  currentTime: ref(0),
  duration: ref(100),
  playing: ref(false),
  loading: ref(false),
  error: ref(''),
  tempo: ref(1),
  pitch: ref(0),
  loopA: ref<number | null>(null),
  loopB: ref<number | null>(null),
  load: vi.fn(() => Promise.resolve()),
  play: vi.fn(),
  pause: vi.fn(),
  toggle: vi.fn(),
  seek: vi.fn((t: number) => (engine.currentTime.value = t)),
  skip: vi.fn(),
}
vi.mock('@/composables/useAudioEngine', () => ({ useAudioEngine: () => engine }))
vi.mock('@/helpers/audioTracks', () => ({
  loadPeaks: vi.fn(() => Promise.resolve(new Uint8Array(10000))),
  audioUrl: vi.fn(() => Promise.resolve('blob:track')),
}))

const track = (over: Partial<AudioTrack> = {}): AudioTrack => ({
  name: 'Original',
  storageRef: 'audio/a.mp3',
  peaksRef: 'audio/a.peaks',
  duration: 100,
  markers: [],
  ...over,
})

const song = (tracks: AudioTrack[]): Song => ({ id: 's1', filename: 'a', name: 'A', bpm: 120, audioTracks: tracks })

const mountPane = async (tracks: AudioTrack[] = [track()]) => {
  const wrapper = mount(AudioPane, { props: { song: song(tracks), hasPrev: false, hasNext: false, view: 'waveform' } })
  await flushPromises()
  return wrapper
}

const button = (wrapper: ReturnType<typeof mount>, icon: string) =>
  wrapper.findAll('button').find((b) => b.find(`.fa-${icon}`).exists())!
const markersOf = (wrapper: ReturnType<typeof mount>) => (wrapper.vm as unknown as { markers: number[] }).markers

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(engine, { currentTime: ref(0), duration: ref(100), playing: ref(false) })
  engine.tempo.value = 1
  engine.pitch.value = 0
  engine.loopA.value = null
  engine.loopB.value = null
})

describe('AudioPane track loading', () => {
  it('loads peaks and audio, and restores the saved settings', async () => {
    const { loadPeaks, audioUrl } = await import('@/helpers/audioTracks')
    await mountPane([track({ markers: [5, 10], loopA: 5, loopB: 10, tempo: 0.8, pitch: -2 })])
    expect(loadPeaks).toHaveBeenCalledOnce()
    expect(audioUrl).toHaveBeenCalledOnce()
    expect(engine.load).toHaveBeenCalledWith('blob:track')
    expect([engine.tempo.value, engine.pitch.value, engine.loopA.value, engine.loopB.value]).toEqual([0.8, -2, 5, 10])
  })

  it('says so when the song has no track', async () => {
    const wrapper = await mountPane([])
    expect(wrapper.text()).toContain('No audio track for this song')
  })

  it('offers a picker only when there is more than one track', async () => {
    expect((await mountPane()).find('.v-select').exists()).toBe(false)
    expect((await mountPane([track(), track({ name: 'Live' })])).find('.v-select').exists()).toBe(true)
  })
})

describe('AudioPane markers', () => {
  it('drops a marker at the playhead, keeping them sorted', async () => {
    const wrapper = await mountPane([track({ markers: [20] })])
    engine.currentTime.value = 5
    await button(wrapper, 'flag').trigger('click')
    expect(markersOf(wrapper)).toEqual([5, 20])
  })

  it('removes the marker instead when the playhead is on one', async () => {
    const wrapper = await mountPane([track({ markers: [5, 20] })])
    engine.currentTime.value = 5.2
    await button(wrapper, 'flag').trigger('click')
    expect(markersOf(wrapper)).toEqual([20])
  })

  it('jumps to the previous and next marker', async () => {
    const wrapper = await mountPane([track({ markers: [5, 20] })])
    engine.currentTime.value = 12
    await button(wrapper, 'forward-step').trigger('click')
    expect(engine.seek).toHaveBeenLastCalledWith(20)
    engine.currentTime.value = 12
    await button(wrapper, 'backward-step').trigger('click')
    expect(engine.seek).toHaveBeenLastCalledWith(5)
  })

  it('runs to the track ends when there is no marker that way', async () => {
    const wrapper = await mountPane([track({ markers: [] })])
    engine.currentTime.value = 12
    await button(wrapper, 'backward-step').trigger('click')
    expect(engine.seek).toHaveBeenLastCalledWith(0)
    await button(wrapper, 'forward-step').trigger('click')
    expect(engine.seek).toHaveBeenLastCalledWith(100)
  })
})

describe('AudioPane A-B repeat', () => {
  const press = (wrapper: ReturnType<typeof mount>, label: 'A' | 'B') =>
    wrapper.findAll('button').find((b) => b.text().trim() === label)!.trigger('click')

  it('sets A and B at the playhead', async () => {
    const wrapper = await mountPane()
    engine.currentTime.value = 12
    await press(wrapper, 'A')
    engine.currentTime.value = 30
    await press(wrapper, 'B')
    expect([engine.loopA.value, engine.loopB.value]).toEqual([12, 30])
  })

  it('snaps to a marker within a second', async () => {
    const wrapper = await mountPane([track({ markers: [12] })])
    engine.currentTime.value = 12.6
    await press(wrapper, 'A')
    expect(engine.loopA.value).toBe(12)
  })

  it('does not snap to a marker further away than that', async () => {
    const wrapper = await mountPane([track({ markers: [12] })])
    engine.currentTime.value = 14
    await press(wrapper, 'A')
    expect(engine.loopA.value).toBe(14)
  })

  it('drops the other bound when the new one would invert the region', async () => {
    const wrapper = await mountPane()
    engine.currentTime.value = 30
    await press(wrapper, 'B')
    engine.currentTime.value = 40
    await press(wrapper, 'A')
    expect([engine.loopA.value, engine.loopB.value]).toEqual([40, null])
  })

  it('clears both bounds', async () => {
    const wrapper = await mountPane()
    engine.currentTime.value = 10
    await press(wrapper, 'A')
    engine.currentTime.value = 20
    await press(wrapper, 'B')
    await button(wrapper, 'times').trigger('click')
    expect([engine.loopA.value, engine.loopB.value]).toEqual([null, null])
  })
})

describe('AudioPane transport', () => {
  it('skips ten seconds each way', async () => {
    const wrapper = await mountPane()
    await button(wrapper, 'forward').trigger('click')
    expect(engine.skip).toHaveBeenCalledWith(10)
    await button(wrapper, 'backward').trigger('click')
    expect(engine.skip).toHaveBeenCalledWith(-10)
  })

  it('restarts the song when pressed past the start', async () => {
    const wrapper = mount(AudioPane, { props: { song: song([track()]), hasPrev: true, hasNext: true, view: 'waveform' } })
    await flushPromises()
    engine.currentTime.value = 30
    await button(wrapper, 'backward-fast').trigger('click')
    expect(engine.seek).toHaveBeenCalledWith(0)
    expect(wrapper.emitted('prevSong')).toBeUndefined()
  })

  it('goes to the previous song when pressed near the start', async () => {
    const wrapper = mount(AudioPane, { props: { song: song([track()]), hasPrev: true, hasNext: true, view: 'waveform' } })
    await flushPromises()
    engine.currentTime.value = 1
    await button(wrapper, 'backward-fast').trigger('click')
    expect(wrapper.emitted('prevSong')).toHaveLength(1)
  })

  it('only offers the next song when there is one', async () => {
    expect(button(await mountPane(), 'forward-fast').attributes('disabled')).toBeDefined()
  })

  it('clamps tempo and pitch, and shows the resulting bpm', async () => {
    const wrapper = await mountPane()
    for (let i = 0; i < 20; i++) await button(wrapper, 'plus').trigger('click')
    expect(engine.tempo.value).toBe(1.5)
    expect(wrapper.text()).toContain('180 bpm') // 120 bpm at 1.5x
    for (let i = 0; i < 20; i++) await button(wrapper, 'arrow-up').trigger('click')
    expect(engine.pitch.value).toBe(12)
  })
})

describe('AudioPane persistence', () => {
  it('writes markers, loop, tempo and pitch back to the track', async () => {
    vi.useFakeTimers()
    const wrapper = await mountPane([track({ markers: [20] }), track({ name: 'Live' })])
    engine.currentTime.value = 5
    await button(wrapper, 'flag').trigger('click')
    engine.tempo.value = 0.9
    await vi.advanceTimersByTimeAsync(600)
    vi.useRealTimers()

    const written = vi.mocked(updateDoc).mock.calls.at(-1)![1] as unknown as { audioTracks: AudioTrack[] }
    expect(written.audioTracks[0]).toMatchObject({ markers: [5, 20], tempo: 0.9, pitch: 0 })
    expect(written.audioTracks[1].name).toBe('Live') // other tracks untouched
  })

  it('leaves a cleared A-B out of the document entirely', async () => {
    vi.useFakeTimers()
    const wrapper = await mountPane([track({ loopA: 1, loopB: 2 })])
    await button(wrapper, 'times').trigger('click')
    await vi.advanceTimersByTimeAsync(600)
    vi.useRealTimers()

    const written = vi.mocked(updateDoc).mock.calls.at(-1)![1] as unknown as { audioTracks: AudioTrack[] }
    expect(written.audioTracks[0]).not.toHaveProperty('loopA')
    expect(written.audioTracks[0]).not.toHaveProperty('loopB')
  })
})
