import { PaneView, ViewMode } from '@/types'

/** every view the big pane can show, in the order the switches offer them */
export const PANE_VIEWS = ['waveform', 'sheet', 'drums', 'lyrics', 'chords'] as const

export const PANE_VIEW_ICONS: Record<PaneView, string> = {
  waveform: 'fas fa-wave-square',
  sheet: 'fas fa-file-pdf',
  drums: 'fas fa-drum',
  lyrics: 'fas fa-file-lines',
  chords: 'fas fa-music',
}

export const PANE_VIEW_LABELS: Record<PaneView, string> = {
  waveform: 'Waveform',
  sheet: 'Sheet',
  drums: 'Drums',
  lyrics: 'Lyrics',
  chords: 'Chords',
}

/** what a song is missing when it cannot serve a view, for the fallback's hint */
export const PANE_VIEW_MISSING: Record<PaneView, string> = {
  waveform: 'audio',
  sheet: 'sheet',
  drums: 'drums',
  lyrics: 'lyrics',
  chords: 'lyrics',
}

/** the view a setlist opened in this mode starts on */
export const viewOfMode = (mode?: ViewMode): PaneView =>
  mode == 'audio' ? 'waveform' : mode == 'drums' ? 'drums' : mode == 'lyrics' ? 'lyrics' : 'sheet'

/** which pdf the sheet panes and the annotations should resolve for a view */
export const sheetModeOfView = (view: PaneView): ViewMode =>
  view == 'drums' ? 'drums' : view == 'sheet' ? 'chords' : 'lyrics'

/**
 * What each view degrades to when the song has nothing for it, best first. A sheet is a
 * chord chart, so it falls back to the lyrics *with* their chords rather than to the bare
 * words; the words in turn stand in for the chords when the song has no chord lines.
 */
const FALLBACKS: Record<PaneView, readonly PaneView[]> = {
  waveform: ['waveform', 'sheet', 'chords', 'lyrics', 'drums'],
  sheet: ['sheet', 'chords', 'lyrics', 'drums', 'waveform'],
  drums: ['drums', 'sheet', 'chords', 'lyrics', 'waveform'],
  lyrics: ['lyrics', 'chords', 'sheet', 'drums', 'waveform'],
  chords: ['chords', 'lyrics', 'sheet', 'drums', 'waveform'],
}

/**
 * The view actually rendered for a song. The chosen view is never given up, so stepping
 * onto a song that has no track and back off it lands on the waveform again.
 */
export const shownView = (view: PaneView, available: Record<PaneView, boolean>): PaneView =>
  FALLBACKS[view].find((v) => available[v]) ?? view
