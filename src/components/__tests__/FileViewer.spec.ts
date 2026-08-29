import FileViewer from '@/components/FileViewer.vue'
import SongInfoBar from '@/components/SongInfoBar.vue'
import { PaneView, Song } from '@/types'
import { flushPromises, mount } from '@vue/test-utils'
import { updateDoc } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const metronome = { start: vi.fn(), stop: vi.fn(), release: vi.fn() }
let remoteControl: (play: boolean) => void
vi.mock('@/helpers/metronome', () => ({
  createMetronome: (_bpm: () => number, onRemote: (play: boolean) => void) => ((remoteControl = onRemote), metronome),
}))
// a song with a track would otherwise have the audio pane reach for the real files
vi.mock('@/helpers/audioTracks', () => ({
  loadPeaks: () => Promise.resolve(new Uint8Array(1000)),
  audioUrl: () => Promise.resolve('blob:track'),
}))

const song = (over: Partial<Song> = {}): Song => ({ filename: 'a.pdf', name: 'Song A', ...over })

const mountViewer = async (props: InstanceType<typeof FileViewer>['$props']) => {
  const wrapper = mount(FileViewer, { props })
  await flushPromises()
  return wrapper
}

// the two invisible click halves that page forwards/backwards
const nextArea = (w: ReturnType<typeof mount>) => w.findAll('.page-half')[1]
const prevArea = (w: ReturnType<typeof mount>) => w.findAll('.page-half')[0]
// only the wrapper with opacity 1 is on screen, and within it only the current page
const visibleImgs = (w: ReturnType<typeof mount>) =>
  w
    .findAll('div[style*="width: 0px"]')
    .filter((d) => (d.attributes('style') ?? '').includes('opacity: 1'))
    .flatMap((d) => d.findAll('img'))
    .filter((i) => !(i.attributes('style') ?? '').includes('display: none'))
    .map((i) => i.attributes('src'))

beforeEach(() => vi.clearAllMocks())

describe('FileViewer file resolution', () => {
  it('renders one cached page image per storage ref in chords mode', async () => {
    const w = await mountViewer({
      songs: [song({ pdfStorageRef: 'a.pdf', pdfImageStorageRefs: ['sheet_images/a_1.webp', 'sheet_images/a_2.webp'] })],
      mode: 'chords',
    })
    const imgs = w.findAll('img')
    expect(imgs).toHaveLength(2)
    expect(imgs[0].attributes('src')).toBe('https://files.test/sheet_images/a_1.webp')
    expect(visibleImgs(w)).toEqual(['https://files.test/sheet_images/a_1.webp'])
  })

  it('falls back to the pdf when no page images are cached', async () => {
    const w = await mountViewer({ songs: [song({ pdfStorageRef: 'a.pdf' })], mode: 'chords' })
    expect(w.find('.pdf-stub').exists()).toBe(true)
  })

  it('resolves the drums file in drums mode', async () => {
    const w = await mountViewer({
      songs: [song({ pdfStorageRef: 'a.pdf', drumsPdfImageStorageRefs: ['drums_images/a_1.webp'] })],
      mode: 'drums',
    })
    expect(w.find('img').attributes('src')).toBe('https://files.test/drums_images/a_1.webp')
  })

  // the guard that tells a song from a custom setlist entry used to test for a sheet pdf,
  // so a song that only ever had a drum chart resolved to nothing and rendered blank
  it('resolves the drums file for a song that has no sheet at all', async () => {
    const w = await mountViewer({
      songs: [song({ drumsPdfImageStorageRefs: ['drums_images/a_1.webp'] })],
      mode: 'drums',
    })
    expect(w.find('img').attributes('src')).toBe('https://files.test/drums_images/a_1.webp')
  })

  it('shows lyrics with a hint when the song has no sheet for this mode', async () => {
    const w = await mountViewer({ songs: [song({ lyrics: 'hello world' })], mode: 'chords' })
    expect(w.text()).toContain('No sheet file')
    expect(w.text()).toContain('hello world')
  })
})

describe('FileViewer navigation', () => {
  const twoSongs = [
    song({ name: 'A', pdfStorageRef: 'a.pdf', pdfImageStorageRefs: ['i/a1.webp', 'i/a2.webp'] }),
    song({ name: 'B', pdfStorageRef: 'b.pdf', pdfImageStorageRefs: ['i/b1.webp'] }),
  ]
  type Nav = { currentFileIndex: number; currentFilePage: number }

  it('pages through a file, then moves to the next file', async () => {
    const w = await mountViewer({ songs: twoSongs, mode: 'chords' })
    const vm = w.vm as unknown as Nav
    expect(visibleImgs(w)).toEqual(['https://files.test/i/a1.webp'])

    await nextArea(w).trigger('click')
    expect(vm).toMatchObject({ currentFileIndex: 0, currentFilePage: 2 })

    await nextArea(w).trigger('click')
    expect(vm).toMatchObject({ currentFileIndex: 1, currentFilePage: 1 })
  })

  it('stops at the last page of the last file', async () => {
    const w = await mountViewer({ songs: twoSongs, mode: 'chords' })
    for (let i = 0; i < 6; i++) await nextArea(w).trigger('click')
    expect(w.vm as unknown as Nav).toMatchObject({ currentFileIndex: 1, currentFilePage: 1 })
  })

  it('going back from the first page of a file lands on the last page of the previous one', async () => {
    const w = await mountViewer({ songs: twoSongs, mode: 'chords' })
    const vm = w.vm as unknown as Nav
    await nextArea(w).trigger('click')
    await nextArea(w).trigger('click')
    await prevArea(w).trigger('click')
    expect(vm).toMatchObject({ currentFileIndex: 0, currentFilePage: 2 })
  })

  it('renders a custom setlist entry as a title card', async () => {
    const w = await mountViewer({ songs: [{ title: 'Pause', description: '10 min' }], mode: 'chords' })
    expect(w.text()).toContain('Pause')
    expect(w.text()).toContain('10 min')
  })
})

describe('FileViewer lyrics rendering', () => {
  const lyrics = 'C       G\nsome words here'

  it('hides chord lines in lyrics mode', async () => {
    const w = await mountViewer({ songs: [song({ lyrics })], mode: 'lyrics' })
    expect(w.text()).toContain('some words here')
    expect(w.find('strong').exists()).toBe(false)
  })

  it('keeps chord lines in chords mode', async () => {
    const w = await mountViewer({ songs: [song({ lyrics })], mode: 'chords' })
    expect(w.text()).toContain('some words here')
    expect(w.find('strong').text()).toBe('C')
  })

  it('shows the moderation block only in the lyrics pane', async () => {
    const w = await mountViewer({ songs: [song({ lyrics, nadine_moderation: 'say hi' })], mode: 'lyrics' })
    expect(w.text()).toContain('say hi')
  })

  it('changes the font size', async () => {
    const w = await mountViewer({ songs: [song({ lyrics })], mode: 'lyrics' })
    expect(w.text()).toContain('16')
    await w.findAll('.v-btn').find((b) => b.find('.fa-plus').exists())!.trigger('click')
    expect(w.text()).toContain('18')
  })
})

describe('FileViewer transpose', () => {
  const transposed = song({ id: 's1', lyrics: 'C\nla', transpose: 2 })

  it('shows the transpose chip in chords mode when not annotatable', async () => {
    const w = await mountViewer({ songs: [transposed], mode: 'chords' })
    expect(w.find('.v-chip').text()).toContain('+2')
  })

  it('applies the transpose to the displayed chords', async () => {
    const w = await mountViewer({ songs: [transposed], mode: 'chords' })
    expect(w.find('strong').text()).toBe('D')
  })

  it('clamps at +11 without losing rapid clicks', async () => {
    const w = await mountViewer({
      songs: [song({ id: 's1', lyrics: 'C\nla', transpose: 10 })],
      mode: 'chords',
      annotatable: true,
    })
    const up = w.findAll('.v-btn').find((b) => b.find('.fa-arrow-up').exists())!
    await up.trigger('click')
    await up.trigger('click')
    expect(vi.mocked(updateDoc).mock.calls.map((c) => c[1])).toEqual([{ transpose: 11 }, { transpose: 11 }])
  })
})

describe('FileViewer drums metronome', () => {
  const bpmButton = (w: ReturnType<typeof mount>) => w.findAll('.v-btn').find((b) => b.text().includes('BPM'))

  it('starts and stops the click', async () => {
    const w = await mountViewer({ songs: [song({ bpm: 120, lyrics: 'la' })], mode: 'drums' })
    await bpmButton(w)!.trigger('click')
    expect(metronome.start).toHaveBeenCalledOnce()
    await bpmButton(w)!.trigger('click')
    expect(metronome.stop).toHaveBeenCalledOnce()
  })

  it('is not offered without a bpm', async () => {
    const w = await mountViewer({ songs: [song({ lyrics: 'la' })], mode: 'drums' })
    expect(bpmButton(w)).toBeUndefined()
  })

  it('starts and stops the click from the headset transport keys', async () => {
    const w = await mountViewer({ songs: [song({ bpm: 120, lyrics: 'la' })], mode: 'drums' })
    remoteControl(true)
    await flushPromises()
    expect(metronome.start).toHaveBeenCalledOnce()
    expect(bpmButton(w)!.text()).toContain('120')
    remoteControl(false)
    expect(metronome.stop).toHaveBeenCalledOnce()
  })

  it('stops the click when the song changes', async () => {
    const w = await mountViewer({ songs: [song({ bpm: 120, lyrics: 'la' })], mode: 'drums' })
    await bpmButton(w)!.trigger('click')
    await w.setProps({ songs: [song({ name: 'other', bpm: 90, lyrics: 'la' })] })
    await flushPromises()
    expect(metronome.stop).toHaveBeenCalled()
  })
})

describe('FileViewer view switching', () => {
  const infoBar = (w: ReturnType<typeof mount>) => w.findComponent(SongInfoBar)
  const pick = async (w: ReturnType<typeof mount>, view: PaneView) => {
    infoBar(w).vm.$emit('update:view', view)
    await flushPromises()
  }
  const everything = song({
    pdfStorageRef: 'a.pdf',
    pdfImageStorageRefs: ['i/a1.webp'],
    drumsPdfImageStorageRefs: ['d/a1.webp'],
    lyrics: 'C\nla',
    audioTracks: [{ name: 't', storageRef: 'a.mp3', peaksRef: 'a.peaks', duration: 10, markers: [] }],
  })

  it('opens on the view its mode asks for', async () => {
    for (const [mode, view] of [
      ['chords', 'sheet'],
      ['drums', 'drums'],
      ['lyrics', 'lyrics'],
      ['audio', 'waveform'],
    ] as const)
      expect(infoBar(await mountViewer({ songs: [everything], mode })).props('view')).toBe(view)
  })

  it('reports which views the song has anything for', async () => {
    const w = await mountViewer({ songs: [everything], mode: 'chords' })
    expect(infoBar(w).props('available')).toEqual({ waveform: true, sheet: true, drums: true, lyrics: true, chords: true })

    const bare = await mountViewer({ songs: [song({ lyrics: 'la' })], mode: 'chords' })
    expect(infoBar(bare).props('available')).toEqual({
      waveform: false,
      sheet: false,
      drums: false,
      lyrics: true,
      chords: true,
    })
  })

  it('swaps the sheet for the drum chart without leaving the mode', async () => {
    const w = await mountViewer({ songs: [everything], mode: 'chords' })
    expect(visibleImgs(w)).toEqual(['https://files.test/i/a1.webp'])
    await pick(w, 'drums')
    expect(visibleImgs(w)).toEqual(['https://files.test/d/a1.webp'])
  })

  it('shows the words in place of a sheet the song has not got, keeping the view', async () => {
    const w = await mountViewer({ songs: [everything, song({ name: 'B', lyrics: 'G\nwords' })], mode: 'chords' })
    await nextArea(w).trigger('click') // onto the song with no sheet
    await flushPromises()

    expect(infoBar(w).props('view')).toBe('sheet') // the choice survives
    expect(infoBar(w).props('shown')).toBe('chords') // a chart falls back to the chords, not the bare words
    expect(w.text()).toContain('No sheet file')
    expect(w.find('strong').text()).toBe('G')

    await prevArea(w).trigger('click')
    await flushPromises()
    expect(infoBar(w).props('shown')).toBe('sheet')
  })

  it('turns the page of a sheet shown inside the audio pane', async () => {
    const twoPages = { ...everything, pdfImageStorageRefs: ['i/a1.webp', 'i/a2.webp'] }
    const w = await mountViewer({ songs: [twoPages], mode: 'audio' })
    expect(w.findAll('.page-half')).toHaveLength(0) // nothing to turn on the waveform

    await pick(w, 'sheet')
    expect(visibleImgs(w)).toEqual(['https://files.test/i/a1.webp'])
    await nextArea(w).trigger('click')
    expect(visibleImgs(w)).toEqual(['https://files.test/i/a2.webp'])
    await prevArea(w).trigger('click')
    expect(visibleImgs(w)).toEqual(['https://files.test/i/a1.webp'])

    await pick(w, 'lyrics')
    expect(w.findAll('.page-half')).toHaveLength(0) // the words are scrolled by hand instead
  })

  it('keeps the sheet loaded while the words are on screen', async () => {
    const w = await mountViewer({ songs: [everything], mode: 'chords' })
    await pick(w, 'lyrics')
    expect(w.find('img').exists()).toBe(true) // still mounted, only hidden
    expect(visibleImgs(w)).toEqual([])
    await pick(w, 'sheet')
    expect(visibleImgs(w)).toEqual(['https://files.test/i/a1.webp'])
  })
})
