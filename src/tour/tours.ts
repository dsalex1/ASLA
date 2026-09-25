import { HOME_ROUTE } from '@/router'

/**
 * The guides, written against what is already on screen. Targets are found by the labels
 * and classes the features carry anyway, so none of the features has to know it is being
 * explained; a step whose target is not there (a button only an admin gets, a mixer on a
 * track without stems) is simply passed over.
 */
export type TourStep = {
  title: string
  /** one paragraph per entry */
  body: string[]
  /** what to point at; without one the card sits in the middle of the screen */
  target?: string | (() => Element | null | undefined)
  /** the page this step is on; the guide goes there first */
  route?: string
  /** a step about something only one kind of account can do */
  for?: 'admin' | 'user'
  /** leave the step out, rather than showing it unanchored, when its target is not there */
  optional?: boolean
}

export type Tour = {
  id: string
  title: string
  /** starts by itself, the first time this is on screen */
  trigger: string
  /** the path the trigger has to be on as well, when the selector alone is not enough */
  triggerRoute?: string
  /** what the in-app "guide" entry starts when this is what is on screen */
  contextual?: boolean
  steps: TourStep[]
}

const first = (selector: string) => () => document.querySelector(selector)
/** the offline control on the first setlist, in whichever of its states it is in */
const offlineControl = () =>
  document.querySelector('.v-card [title="Offline copy options"]') ??
  document.querySelector('.v-card .fa-download')?.closest('button')

const HELP_REMINDER = 'Both guides can be opened again from the ? in the top bar.'

export const APP_TOUR: Tour = {
  id: 'app',
  title: 'App guide',
  // the cards, or the note that there are none: either way the list has loaded
  trigger: '.setlist-title, .v-alert',
  triggerRoute: HOME_ROUTE,
  steps: [
    {
      title: 'Welcome',
      route: HOME_ROUTE,
      body: [
        'This app keeps the band’s setlists, sheets, lyrics and backing tracks in one place, and works on stage without a connection.',
        'Here is a quick look around. Skip it any time; it can be brought back from the ? in the top bar.',
      ],
    },
    {
      title: 'Your setlists',
      route: HOME_ROUTE,
      target: first('.setlist-title'),
      optional: true,
      body: ['Each card is a setlist. Tap its name for the running order, total length and a printable list.'],
    },
    {
      title: 'Play a setlist',
      route: HOME_ROUTE,
      target: () => document.querySelector('.mode-btn')?.closest('.v-btn-group'),
      optional: true,
      body: [
        'Open the whole set in the view you need: lyrics, chord sheets, drum sheets, or audio with the backing tracks.',
        'Swipe or tap the left and right edges to turn pages and move between songs. The menu above the page switches the view for the song you are on.',
      ],
    },
    {
      title: 'Take it offline',
      route: HOME_ROUTE,
      target: offlineControl,
      optional: true,
      body: [
        'Download a setlist before the gig and every sheet, lyric and track in it is kept on this device, so a dead venue Wi-Fi does not matter.',
      ],
    },
    {
      title: 'Only what is shared with you',
      for: 'user',
      body: [
        'You see the setlists an admin has shared with you. Everything is read-only for you, but your own capo, font size and count-in stay on your device.',
      ],
    },
    {
      title: 'Edit a setlist',
      for: 'admin',
      route: HOME_ROUTE,
      target: first('[title="Edit setlist"]'),
      optional: true,
      body: ['Rename it, add or remove songs and drag them into order.'],
    },
    {
      title: 'New setlist',
      for: 'admin',
      route: HOME_ROUTE,
      target: first('a[href$="setlist/create"]'),
      optional: true,
      body: ['Start a setlist by naming it and ticking songs from the library.'],
    },
    {
      title: 'The song library',
      for: 'admin',
      route: HOME_ROUTE,
      target: first('a[href$="#/song"]'),
      optional: true,
      body: ['Every song lives here, whether or not it is in a setlist yet.'],
    },
    {
      title: 'Adding a song',
      for: 'admin',
      route: '/song',
      target: () => document.querySelector('h2 .fa-plus')?.closest('button'),
      optional: true,
      body: [
        '1. Press Add Song and type the name. Lyrics and chords can be pulled in from Ultimate Guitar right there.',
        '2. Fill in key, BPM and length if you know them, and create it.',
        '3. Open it with the pencil to add the rest: a sheet PDF, a drums PDF, and audio, uploaded or fetched from YouTube.',
        '4. An audio track can be split into stems (vocals, drums, bass…) so parts can be muted while practising.',
      ],
    },
    {
      title: 'Find and sort',
      for: 'admin',
      route: '/song',
      target: first('.v-text-field'),
      optional: true,
      body: ['Search by name, or narrow the list to a recent setlist with the chips above.'],
    },
    {
      title: 'Folders',
      for: 'admin',
      route: '/song',
      target: first('a[href$="#/folders"]'),
      optional: true,
      body: ['Group songs into folders; that is how they are laid out when picking songs for a setlist.'],
    },
    {
      title: 'Settings',
      for: 'admin',
      route: HOME_ROUTE,
      target: first('a[href$="#/settings"]'),
      optional: true,
      body: ['Sheet folder, image cache and what is stored offline on this device.'],
    },
    {
      title: 'Users',
      for: 'admin',
      route: HOME_ROUTE,
      target: first('a[href$="#/users"]'),
      optional: true,
      body: ['Invite band members, make them admins, and choose which setlists each of them sees.'],
    },
    {
      title: 'Help is here',
      route: HOME_ROUTE,
      target: first('[aria-label="Help"]'),
      body: [
        'That is it. The audio player has a guide of its own, which comes up the first time you open a song with audio.',
        HELP_REMINDER,
      ],
    },
  ],
}

/** shorthand for a group of transport buttons, found by one of the buttons in it */
const groupWith = (label: string) => () => document.querySelector(`.audio-pane .group:has([aria-label="${label}"])`)

export const AUDIO_TOUR: Tour = {
  id: 'audio',
  title: 'Audio player guide',
  trigger: '.audio-pane .waveform',
  contextual: true,
  steps: [
    {
      title: 'The waveform',
      target: first('.audio-pane .waveform'),
      body: [
        'The red line is where you are. Drag the wave to scrub, or flick it and let it coast. Tap anywhere to jump there.',
        'Pinch (or use the mouse wheel) to zoom in and out.',
      ],
    },
    {
      title: 'Flags',
      target: first('.audio-pane .waveform'),
      body: [
        'Blue flags are markers, red ones are skips that playback jumps over, and the orange pennant pairs are saved loops.',
        'Tap a marker to jump to it, tap a loop to select it.',
      ],
    },
    {
      title: 'Moving and naming flags',
      for: 'admin',
      target: first('.audio-pane .waveform'),
      body: [
        'Hold a flag for a moment to pick it up and drag it somewhere else.',
        'Hold a marker and let go without moving it to name it, or turn it into a skip.',
      ],
    },
    {
      title: 'The whole track',
      target: () => document.querySelectorAll('.audio-pane .waveform')[1],
      optional: true,
      body: ['The strip at the bottom is the whole song. Tap it to jump anywhere.'],
    },
    {
      title: 'Transport',
      target: first('.audio-pane .group--centre'),
      body: [
        'Play and pause, and skip 10 seconds either way.',
        'The outer buttons go to the next song, and back: to the start of this one, or, if you are already near the start, to the one before.',
      ],
    },
    {
      title: 'Markers',
      target: groupWith('Next marker'),
      body: ['Step back and forth between markers and loop edges.'],
    },
    {
      title: 'Set a marker',
      for: 'admin',
      target: first('.audio-pane [aria-label="Add marker"], .audio-pane [aria-label="Remove marker"]'),
      optional: true,
      body: ['Drops a marker at the playhead. Pressed on a marker, it takes it away again.'],
    },
    {
      title: 'Tempo',
      target: groupWith('Slower'),
      body: [
        'Slow it down to practise, without changing the key. Drag the display sideways for fine steps; double-tap it to reset.',
      ],
    },
    {
      title: 'Pitch',
      target: groupWith('Pitch down'),
      body: ['Move the key in semitones, e.g. to match a capo or a singer. Double-tap to reset.'],
    },
    {
      title: 'Volume',
      target: groupWith('Quieter'),
      body: ['Evens out tracks that were mastered louder or quieter than the rest of the set.'],
    },
    {
      title: 'Settings are shared',
      for: 'admin',
      body: [
        'Markers, loops, tempo, pitch, volume, count-in and the stem mix are saved with the song, so the whole band gets the same setup.',
      ],
    },
    {
      title: 'Looping',
      target: first('.audio-pane [aria-label="Show loop controls"], .audio-pane [aria-label="Hide loop controls"]'),
      body: [
        'Turns on looping. Press A and B at the start and end of a passage and it repeats. Drag the A and B handles on the wave to adjust.',
        'The arrows walk the loop along the song, ½ and x2 halve or double it.',
      ],
    },
    {
      title: 'Saved loops',
      for: 'admin',
      target: first('.audio-pane .loop-row'),
      optional: true,
      body: ['Press + to save the A-B as a loop, give it a name, or drop it with the bin.'],
    },
    {
      title: 'Loops and markers list',
      target: first('.audio-pane .lm-list'),
      body: [
        'While looping, every loop and marker is listed at the left edge of the wave: loops first, then markers. Tap one to go there.',
      ],
    },
    {
      title: 'Rename and delete',
      for: 'admin',
      target: first('.audio-pane .lm-list'),
      optional: true,
      body: ['The list also has a pencil and a bin next to each entry, which is quicker than finding the flag when there are many.'],
    },
    {
      title: 'Count-in',
      target: first('.audio-pane [aria-label="Count-in"]'),
      optional: true,
      body: ['Clicks a bar in before the track starts. Set the tempo and number of beats here.'],
    },
    {
      title: 'Stems',
      target: first('.audio-pane [aria-label="Show the stem mixer"], .audio-pane [aria-label="Hide the stem mixer"]'),
      optional: true,
      body: ['This track is split into stems. Mute or turn down the parts you are playing yourself.'],
    },
    {
      title: 'Tracks',
      target: first('.audio-pane .track-picker'),
      optional: true,
      body: ['This song has more than one recording. Pick which one to play.'],
    },
    {
      title: 'Level meter',
      target: first('.audio-pane .monitor-toggle'),
      optional: true,
      body: ['Draws what the volume and the limiter are actually doing onto the wave as it plays.'],
    },
    {
      title: 'Sheet, lyrics, chords',
      target: first('.audio-pane .segmented'),
      body: ['Swap the waveform for the sheet, lyrics or chords. The music keeps playing and the lyrics can scroll along.'],
    },
    {
      title: 'That is the player',
      body: ['Open this guide again from the view menu above the player, or press ? on a keyboard.'],
    },
  ],
}

export const TOURS: Tour[] = [AUDIO_TOUR, APP_TOUR]
