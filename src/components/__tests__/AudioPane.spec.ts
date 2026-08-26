import AudioPane from '@/components/AudioPane.vue'
import JogStrip from '@/components/JogStrip.vue'
import WaveformCanvas from '@/components/WaveformCanvas.vue'
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
  gainDb: ref(0),
  loopA: ref<number | null>(null),
  loopB: ref<number | null>(null),
  load: vi.fn(() => Promise.resolve()),
  play: vi.fn(),
  pause: vi.fn(),
  toggle: vi.fn(),
  seek: vi.fn((t: number) => (engine.currentTime.value = t)),
  // one sample per peak bucket, so a sample's index is the bucket it belongs in
  levels: vi.fn(() => ({
    pre: new Float32Array([0.1, 0.2, 0.3, 0.8]),
    post: new Float32Array([0.1, 0.2, 0.3, 0.5]),
    sampleRate: 100,
    latency: 0,
    reduction: -4,
  })),
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
  localStorage.setItem('audio.loopBar', 'true') // most tests want the loop row in reach
  const wrapper = mount(AudioPane, { props: { song: song(tracks), hasPrev: false, hasNext: false, view: 'waveform' } })
  await flushPromises()
  return wrapper
}

const button = (wrapper: ReturnType<typeof mount>, label: string) =>
  wrapper.findAll('button').find((b) => b.attributes('aria-label') === label)!
const markersOf = (wrapper: ReturnType<typeof mount>) => (wrapper.vm as unknown as { markers: number[] }).markers

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear() // the monitor toggle and the output choice live there
  Object.assign(engine, { currentTime: ref(0), duration: ref(100), playing: ref(false) })
  engine.tempo.value = 1
  engine.pitch.value = 0
  engine.loopA.value = null
  engine.loopB.value = null
  engine.gainDb.value = 0
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

    it('tells the slot whether the audio is playing, so the lyrics can follow', async () => {
      const wrapper = mount(AudioPane, {
        props: { song: song([track()]), hasPrev: false, hasNext: false, view: 'lyrics' },
        slots: { view: '<template #default="{ playing }"><p>{{ playing ? "following" : "still" }}</p></template>' },
      })
      await flushPromises()
      expect(wrapper.text()).toContain('still')
      engine.playing.value = true
      await wrapper.vm.$nextTick()
      expect(wrapper.text()).toContain('following')
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

describe('AudioPane A-B move', () => {
  const loop = () => [engine.loopA.value, engine.loopB.value]
  const round = () => loop().map((v) => (v == null ? v : Math.round(v * 100) / 100))

  it('nudges both ends at once by default, keeping the length', async () => {
    const wrapper = await mountPane([track({ loopA: 10, loopB: 20 })]) // 10s long, so 2.5s a press
    await button(wrapper, 'Nudge right').trigger('click')
    expect(round()).toEqual([12.5, 22.5])
    await button(wrapper, 'Nudge left').trigger('click')
    await button(wrapper, 'Nudge left').trigger('click')
    expect(round()).toEqual([7.5, 17.5])
  })

  it('moves only the selected end', async () => {
    const wrapper = await mountPane([track({ loopA: 10, loopB: 20 })])
    await button(wrapper, 'Move A').trigger('click')
    await button(wrapper, 'Nudge right').trigger('click')
    expect(round()).toEqual([12.5, 20])

    // the selection is 7.5s now, so the next press moves by a quarter of that
    await button(wrapper, 'Move B').trigger('click')
    await button(wrapper, 'Nudge right').trigger('click')
    expect(round()).toEqual([12.5, 21.88])
  })

  it('halves and doubles the selection from A', async () => {
    const wrapper = await mountPane([track({ loopA: 10, loopB: 20 })])
    await button(wrapper, 'Halve selection').trigger('click')
    expect(loop()).toEqual([10, 15])
    await button(wrapper, 'Double selection').trigger('click')
    expect(loop()).toEqual([10, 20])
  })

  it('clamps the selection to the track and never lets B pass A', async () => {
    const wrapper = await mountPane([track({ loopA: 10, loopB: 90, duration: 100 })])
    await button(wrapper, 'Double selection').trigger('click')
    expect(loop()).toEqual([10, 100])

    await button(wrapper, 'Move B').trigger('click')
    engine.loopB.value = 10.05
    await button(wrapper, 'Nudge left').trigger('click')
    expect(engine.loopB.value).toBeGreaterThan(engine.loopA.value!)
  })

  it('disables the move buttons until both ends are set', async () => {
    const wrapper = await mountPane([track()])
    for (const label of ['Nudge left', 'Nudge right', 'Halve selection', 'Double selection'])
      expect(button(wrapper, label).attributes('disabled')).toBeDefined()
  })
})

describe('AudioPane level trim', () => {
  it('loads the trim from the track and steps it by 0.1 dB', async () => {
    const wrapper = await mountPane([track({ gainDb: -3 })])
    expect(engine.gainDb.value).toBe(-3)

    await button(wrapper, 'Louder').trigger('click')
    expect(engine.gainDb.value).toBe(-2.9)
    await button(wrapper, 'Quieter').trigger('click')
    await button(wrapper, 'Quieter').trigger('click')
    expect(engine.gainDb.value).toBe(-3.1)
  })

  it('clamps the trim to 20 dB either way', async () => {
    const wrapper = await mountPane([track({ gainDb: 19.95 })])
    for (let i = 0; i < 5; i++) await button(wrapper, 'Louder').trigger('click')
    expect(engine.gainDb.value).toBe(20)
  })

  it('stores the trim on the track, not globally', async () => {
    vi.useFakeTimers()
    const wrapper = await mountPane([track()])
    await button(wrapper, 'Louder').trigger('click')
    await vi.advanceTimersByTimeAsync(600)
    vi.useRealTimers()

    const written = vi.mocked(updateDoc).mock.calls.at(-1)![1] as unknown as { audioTracks: AudioTrack[] }
    expect(written.audioTracks[0].gainDb).toBe(0.1)
  })
})

describe('AudioPane level monitoring', () => {
  const canvas = (wrapper: ReturnType<typeof mount>) => wrapper.findComponent(WaveformCanvas)

  it('tells the canvas to monitor, and hands it the gain to draw', async () => {
    const wrapper = await mountPane([track({ gainDb: 6 })])
    expect(canvas(wrapper).props('monitor')).toBe(false)
    expect(canvas(wrapper).props('headroomDb')).toBe(0)

    await button(wrapper, 'Monitor levels').trigger('click')
    expect(canvas(wrapper).props('monitor')).toBe(true)
    expect(canvas(wrapper).props('gainDb')).toBe(6)
    // headroom only while monitoring, so the wave keeps the full height otherwise
    expect(canvas(wrapper).props('headroomDb')).toBe(6)
  })

  it('places every sample at the position it was played at, not one reading per frame', async () => {
    const wrapper = await mountPane()
    await button(wrapper, 'Monitor levels').trigger('click')
    engine.playing.value = true
    engine.currentTime.value = 2
    await flushPromises()

    // the window ends at the playhead, so its last sample lands on 2s and the rest behind
    const trail = canvas(wrapper).props('outTrail') as Float32Array
    ;[0.1, 0.2, 0.3, 0.5].forEach((v, i) => expect(trail[197 + i]).toBeCloseTo(v))
    expect(canvas(wrapper).props('reduction')).toBe(-4)
  })

  it('shifts the window back by the latency the engine reports', async () => {
    engine.levels.mockReturnValueOnce({ ...engine.levels(), latency: 0.02 })
    const wrapper = await mountPane()
    await button(wrapper, 'Monitor levels').trigger('click')
    engine.playing.value = true
    engine.currentTime.value = 2
    await flushPromises()

    // two buckets of latency, so the loudest sample belongs at 1.98s rather than 2s
    const trail = canvas(wrapper).props('outTrail') as Float32Array
    expect(trail[198]).toBeCloseTo(0.5)
    expect(trail[200]).toBe(0)
  })

  it('stretches the window over more track time as the tempo rises', async () => {
    const wrapper = await mountPane()
    await button(wrapper, 'Monitor levels').trigger('click')
    engine.tempo.value = 2
    engine.playing.value = true
    engine.currentTime.value = 2
    await flushPromises()

    // a second of audio now covers two seconds of track, so the samples spread out
    const trail = canvas(wrapper).props('outTrail') as Float32Array
    expect(trail[200]).toBeCloseTo(0.5)
    expect(trail[198]).toBeCloseTo(0.3)
    expect(trail[196]).toBeCloseTo(0.2)
  })

  it('ignores samples from before the start of the track', async () => {
    const wrapper = await mountPane()
    await button(wrapper, 'Monitor levels').trigger('click')
    engine.playing.value = true
    engine.currentTime.value = 0.01
    await flushPromises()

    const trail = canvas(wrapper).props('outTrail') as Float32Array
    ;[0.3, 0.5].forEach((v, i) => expect(trail[i]).toBeCloseTo(v))
  })

  it('records the gain reduction across the window the reading covers', async () => {
    const wrapper = await mountPane()
    await button(wrapper, 'Monitor levels').trigger('click')
    engine.playing.value = true
    engine.currentTime.value = 2
    await flushPromises()

    // reduction is reported as a negative dB figure and stored as a depth
    const curve = canvas(wrapper).props('reductionTrail') as Float32Array
    expect(curve[200]).toBe(4)
    expect(curve[198]).toBe(4)
    expect(curve[210]).toBe(0) // nothing written ahead of the playhead
  })

  it('starts the trail over when the gain changes, since old levels no longer apply', async () => {
    const wrapper = await mountPane()
    await button(wrapper, 'Monitor levels').trigger('click')
    engine.playing.value = true
    engine.currentTime.value = 2
    await flushPromises()
    expect((canvas(wrapper).props('outTrail') as Float32Array)[200]).toBeGreaterThan(0)

    await button(wrapper, 'Louder').trigger('click')
    await flushPromises()
    expect((canvas(wrapper).props('outTrail') as Float32Array)[200]).toBe(0)
  })
})

describe('AudioPane loop row', () => {
  it('keeps the loop controls out of the way until they are asked for', async () => {
    localStorage.clear()
    const wrapper = mount(AudioPane, { props: { song: song([track()]), hasPrev: false, hasNext: false, view: 'waveform' } })
    await flushPromises()
    expect(button(wrapper, 'Clear A-B')).toBeUndefined()

    await button(wrapper, 'Show loop controls').trigger('click')
    expect(button(wrapper, 'Clear A-B')).toBeTruthy()
    expect(button(wrapper, 'Halve selection')).toBeTruthy()
    expect(localStorage.getItem('audio.loopBar')).toBe('true')
  })
})

describe('AudioPane loop nudging', () => {
  it('moves the loop by a quarter of its own length', async () => {
    const wrapper = await mountPane([track({ loopA: 10, loopB: 30 })]) // 20s long, so 5s a press
    await button(wrapper, 'Nudge right').trigger('click')
    expect([engine.loopA.value, engine.loopB.value]).toEqual([15, 35])

    // now 20s still, but after halving it the step halves with it
    await button(wrapper, 'Halve selection').trigger('click')
    await button(wrapper, 'Nudge right').trigger('click')
    expect([engine.loopA.value, engine.loopB.value]).toEqual([17.5, 27.5])
  })

  it('does not move anything when there is no selection', async () => {
    const wrapper = await mountPane([track({ loopA: 5 })])
    expect(button(wrapper, 'Nudge right').attributes('disabled')).toBeDefined()
  })
})
