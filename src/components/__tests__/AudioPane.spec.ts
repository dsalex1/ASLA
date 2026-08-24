import AudioPane from '@/components/AudioPane.vue'
import JogStrip from '@/components/JogStrip.vue'
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

const song = (tracks: AudioTrack[], over: Partial<Song> = {}): Song => ({
  id: 's1',
  filename: 'a',
  name: 'A',
  bpm: 120,
  audioTracks: tracks,
  ...over,
})

const mountPane = async (tracks: AudioTrack[] = [track()]) => {
  const wrapper = mount(AudioPane, { props: { song: song(tracks), hasPrev: false, hasNext: false, view: 'waveform' } })
  await flushPromises()
  return wrapper
}

const button = (wrapper: ReturnType<typeof mount>, label: string) =>
  wrapper.findAll('button').find((b) => b.attributes('aria-label') === label)!
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
    expect(engine.load).toHaveBeenCalledWith('blob:track', 100) // duration up front so the waveform is scrubbable while decoding
    expect([engine.tempo.value, engine.pitch.value, engine.loopA.value, engine.loopB.value]).toEqual([0.8, -2, 5, 10])
  })

  describe('a song with no audio', () => {
    it('says so in the strip where the wave would be', async () => {
      const wrapper = await mountPane([])
      expect(wrapper.text()).toContain('No audio available')
    })

    it('still offers the lyrics and chords switcher', async () => {
      const wrapper = await mountPane([])
      expect(button(wrapper, 'lyrics')).toBeDefined()
      expect(button(wrapper, 'chords')).toBeDefined()
    })

    it('drops the waveform option and every audio control', async () => {
      const wrapper = await mountPane([])
      expect(button(wrapper, 'waveform')).toBeUndefined()
      for (const label of ['Play', 'Add marker', 'Faster', 'Clear A-B', 'Back 10 seconds'])
        expect(button(wrapper, label)).toBeUndefined()
      expect(wrapper.findAllComponents(JogStrip)).toHaveLength(0)
    })

    it('switches away from the waveform view', async () => {
      const wrapper = mount(AudioPane, { props: { song: song([]), hasPrev: false, hasNext: false, view: 'waveform' } })
      await flushPromises()
      expect(wrapper.emitted('update:view')!.at(-1)).toEqual(['lyrics'])
    })

    it('keeps showing the lyrics slot', async () => {
      const wrapper = mount(AudioPane, {
        props: { song: song([]), hasPrev: false, hasNext: false, view: 'lyrics' },
        slots: { view: '<p>the words</p>' },
      })
      await flushPromises()
      expect(wrapper.text()).toContain('the words')
    })
  })

  it('starts on the track that was selected last time', async () => {
    const wrapper = mount(AudioPane, {
      props: {
        song: song([track(), track({ name: 'Live', storageRef: 'audio/live.mp3' })], { selectedAudioTrack: 1 }),
        hasPrev: false,
        hasNext: false,
        view: 'waveform',
      },
    })
    await flushPromises()
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('1')
  })

  it('falls back to the first track when the remembered one is gone', async () => {
    const wrapper = mount(AudioPane, {
      props: { song: song([track()], { selectedAudioTrack: 3 }), hasPrev: false, hasNext: false, view: 'waveform' },
    })
    await flushPromises()
    expect((wrapper.vm as unknown as { trackIndex: number }).trackIndex).toBe(0)
  })

  it('saves the picked track alongside its settings', async () => {
    vi.useFakeTimers()
    const wrapper = await mountPane([track(), track({ name: 'Live', storageRef: 'audio/live.mp3' })])
    await wrapper.find('select').setValue('1')
    await vi.advanceTimersByTimeAsync(600)
    vi.useRealTimers()
    const written = vi.mocked(updateDoc).mock.calls.at(-1)![1] as unknown as { selectedAudioTrack: number }
    expect(written.selectedAudioTrack).toBe(1)
  })

  it('offers a picker only when there is more than one track', async () => {
    expect((await mountPane()).find('select').exists()).toBe(false)
    expect((await mountPane([track(), track({ name: 'Live' })])).find('select').exists()).toBe(true)
  })
})

describe('AudioPane markers', () => {
  it('drops a marker at the playhead, keeping them sorted', async () => {
    const wrapper = await mountPane([track({ markers: [20] })])
    engine.currentTime.value = 5
    await button(wrapper, 'Add marker').trigger('click')
    expect(markersOf(wrapper)).toEqual([5, 20])
  })

  it('removes the marker instead when the playhead is on one', async () => {
    const wrapper = await mountPane([track({ markers: [5, 20] })])
    engine.currentTime.value = 5.2
    await wrapper.vm.$nextTick()
    await button(wrapper, 'Remove marker').trigger('click')
    expect(markersOf(wrapper)).toEqual([20])
  })

  it('offers add or remove depending on where the playhead is', async () => {
    const wrapper = await mountPane([track({ markers: [5] })])
    expect(button(wrapper, 'Add marker')).toBeDefined()
    engine.currentTime.value = 5.1
    await wrapper.vm.$nextTick()
    expect(button(wrapper, 'Remove marker')).toBeDefined()
    expect(button(wrapper, 'Add marker')).toBeUndefined()
  })

  it('jumps to the previous and next marker', async () => {
    const wrapper = await mountPane([track({ markers: [5, 20] })])
    engine.currentTime.value = 12
    await button(wrapper, 'Next marker').trigger('click')
    expect(engine.seek).toHaveBeenLastCalledWith(20)
    engine.currentTime.value = 12
    await button(wrapper, 'Previous marker').trigger('click')
    expect(engine.seek).toHaveBeenLastCalledWith(5)
  })

  it('refuses to store a marker at a non-finite position', async () => {
    const wrapper = await mountPane([track({ markers: [20] })])
    engine.currentTime.value = NaN
    await button(wrapper, 'Add marker').trigger('click')
    expect(markersOf(wrapper)).toEqual([20])
  })

  it('runs to the track ends when there is no marker that way', async () => {
    const wrapper = await mountPane([track({ markers: [] })])
    engine.currentTime.value = 12
    await button(wrapper, 'Previous marker').trigger('click')
    expect(engine.seek).toHaveBeenLastCalledWith(0)
    await button(wrapper, 'Next marker').trigger('click')
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
    await button(wrapper, 'Clear A-B').trigger('click')
    expect([engine.loopA.value, engine.loopB.value]).toEqual([null, null])
  })
})

describe('AudioPane transport', () => {
  it('skips ten seconds each way', async () => {
    const wrapper = await mountPane()
    await button(wrapper, 'Forward 10 seconds').trigger('click')
    expect(engine.skip).toHaveBeenCalledWith(10)
    await button(wrapper, 'Back 10 seconds').trigger('click')
    expect(engine.skip).toHaveBeenCalledWith(-10)
  })

  it('restarts the song when pressed past the start', async () => {
    const wrapper = mount(AudioPane, { props: { song: song([track()]), hasPrev: true, hasNext: true, view: 'waveform' } })
    await flushPromises()
    engine.currentTime.value = 30
    await button(wrapper, 'Restart or previous song').trigger('click')
    expect(engine.seek).toHaveBeenCalledWith(0)
    expect(wrapper.emitted('prevSong')).toBeUndefined()
  })

  it('goes to the previous song when pressed near the start', async () => {
    const wrapper = mount(AudioPane, { props: { song: song([track()]), hasPrev: true, hasNext: true, view: 'waveform' } })
    await flushPromises()
    engine.currentTime.value = 1
    await button(wrapper, 'Restart or previous song').trigger('click')
    expect(wrapper.emitted('prevSong')).toHaveLength(1)
  })

  it('only offers the next song when there is one', async () => {
    expect(button(await mountPane(), 'Next song').attributes('disabled')).toBeDefined()
  })

  it('steps the tempo and shows the resulting bpm', async () => {
    const wrapper = await mountPane()
    for (let i = 0; i < 4; i++) await button(wrapper, 'Faster').trigger('click')
    expect(engine.tempo.value).toBeCloseTo(1.2, 4)
    expect(wrapper.text()).toContain('144 bpm') // 120 bpm at 1.2x
  })

  it('clamps tempo to 0.25x-4x and pitch to a two octave range', async () => {
    const wrapper = await mountPane()
    const jogs = wrapper.findAllComponents(JogStrip)
    expect(jogs[0].props()).toMatchObject({ min: 30, max: 480, step: 1 }) // 120 bpm at 0.25x-4x
    expect(jogs[1].props()).toMatchObject({ min: -24, max: 24, step: 0.01 })

    for (let i = 0; i < 30; i++) await button(wrapper, 'Pitch up').trigger('click')
    expect(engine.pitch.value).toBe(24)
  })

  it('double clicking the jogs restores 1.00x and 0 semitones', async () => {
    const wrapper = await mountPane()
    const [tempoJog, pitchJog] = wrapper.findAllComponents(JogStrip)
    expect(tempoJog.props('resetTo')).toBe(120) // the song bpm, ie 1.00x
    expect(pitchJog.props('resetTo')).toBe(0)

    engine.tempo.value = 0.6
    engine.pitch.value = 5
    await wrapper.vm.$nextTick() // let the jogs see the new values before resetting them
    await tempoJog.trigger('dblclick')
    await pitchJog.trigger('dblclick')
    expect(engine.tempo.value).toBe(1)
    expect(engine.pitch.value).toBe(0)
  })

  it('falls back to a tempo multiplier when the song has no bpm', async () => {
    const wrapper = mount(AudioPane, {
      props: { song: { ...song([track()]), bpm: undefined }, hasPrev: false, hasNext: false, view: 'waveform' },
    })
    await flushPromises()
    expect(wrapper.findAllComponents(JogStrip)[0].props()).toMatchObject({ min: 0.25, max: 4, step: 0.01 })
  })
})

describe('AudioPane persistence', () => {
  it('writes markers, loop, tempo and pitch back to the track', async () => {
    vi.useFakeTimers()
    const wrapper = await mountPane([track({ markers: [20] }), track({ name: 'Live' })])
    engine.currentTime.value = 5
    await button(wrapper, 'Add marker').trigger('click')
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
    await button(wrapper, 'Clear A-B').trigger('click')
    await vi.advanceTimersByTimeAsync(600)
    vi.useRealTimers()

    const written = vi.mocked(updateDoc).mock.calls.at(-1)![1] as unknown as { audioTracks: AudioTrack[] }
    expect(written.audioTracks[0]).not.toHaveProperty('loopA')
    expect(written.audioTracks[0]).not.toHaveProperty('loopB')
  })
})
