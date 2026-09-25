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
  /** puts the screen into the state the step is about, by pressing what a person would;
   * false means it could not, and the step is passed over */
  before?: () => void | boolean | Promise<void | boolean>
}

export type Tour = {
  id: string
  title: string
  /** starts by itself, the first time this is on screen */
  trigger: string | (() => Element | null | undefined)
  /** the path the trigger has to be on as well, when the selector alone is not enough */
  triggerRoute?: string
  /** what the in-app "guide" entry starts when this is what is on screen */
  contextual?: boolean
  /** puts back whatever the steps changed to show themselves */
  end?: () => void
  steps: TourStep[]
}

/** the element that says a guide's screen is up, if it is */
export const triggerOf = (tour: Tour) =>
  (typeof tour.trigger === 'function' ? tour.trigger() : document.querySelector(tour.trigger)) ?? null

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))
const first = (selector: string) => () => document.querySelector(selector)
/** press something if it is there; the guide opens panels the way a person would */
const press = (selector: string) => (document.querySelector<HTMLElement>(selector)?.click(), undefined)

/** the offline control on the first setlist, in whichever of its states it is in */
const offlineControl = () =>
  document.querySelector('.v-card [title="Offline copy options"]') ??
  document.querySelector('.v-card .fa-download')?.closest('button')

const HELP_REMINDER = 'Every guide can be opened again from the ? in the top bar.'

// --- the song dialogs, opened and closed the way a person would ---
const DIALOG = '.v-overlay--active'
const dialogTitle = () => document.querySelector(`${DIALOG} .v-card-title`)?.textContent ?? ''

/** a field in the open dialog, found by its label */
const fieldLabeled = (label: string) => () =>
  [...document.querySelectorAll(`${DIALOG} .v-input`)].find((i) => i.querySelector('.v-label')?.textContent?.trim().startsWith(label))

const buttonInDialog = (text: string) => () =>
  [...document.querySelectorAll<HTMLElement>(`${DIALOG} .v-btn`)].find((b) => b.textContent?.trim() === text)

async function closeDialogs() {
  if (!document.querySelector(DIALOG)) return
  buttonInDialog('Cancel')()?.click()
  document.querySelector<HTMLElement>(`${DIALOG} .v-card-title .fa-times`)?.closest('button')?.click()
  await wait(300)
}

async function openCreateDialog() {
  if (dialogTitle().includes('Create New Song')) return
  await closeDialogs()
  const add = document.querySelector<HTMLElement>('h2 .fa-plus')?.closest('button')
  if (!add) return false
  add.click()
  await wait(400)
}

/** the first song in the library, opened for editing; false when there is none yet */
async function openEditDialog() {
  if (dialogTitle().includes('Edit Song')) return
  await closeDialogs()
  const edit = document.querySelector<HTMLElement>('.v-container .fa-edit')?.closest('button')
  if (!edit) return false
  edit.click()
  await wait(400)
}

export const APP_TOUR: Tour = {
  id: 'app',
  title: 'App guide',
  end: () => void closeDialogs(),
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
        'Each of these has its own guide, which comes up the first time you open one.',
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
      body: ['Rename it, add or remove songs and drag them into order. The setlist’s own page has an Edit button too.'],
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
      before: closeDialogs,
      target: () => document.querySelector('h2 .fa-plus')?.closest('button'),
      optional: true,
      body: ['A new song starts here. The guide opens the dialog to show you round it; nothing is saved unless you press Create.'],
    },
    {
      title: 'Name it',
      for: 'admin',
      route: '/song',
      before: openCreateDialog,
      target: fieldLabeled('Song Name'),
      optional: true,
      body: [
        'The name is the only thing it needs. The file name next to it is made from it.',
        'Once a name is typed, Import from Ultimate Guitar appears below it: pick a result and the lyrics with their chords come in, along with the key, BPM and length where the tab has them.',
      ],
    },
    {
      title: 'The details',
      for: 'admin',
      route: '/song',
      before: openCreateDialog,
      target: () => fieldLabeled('Key Signature')()?.closest('.v-row'),
      optional: true,
      body: [
        'Key and BPM show above the sheet; the BPM also drives the click and the count-in.',
        'The instrument says what Ibi plays on it, the folder where it is filed, and the length adds up into each setlist’s total time.',
      ],
    },
    {
      title: 'Create',
      for: 'admin',
      route: '/song',
      before: openCreateDialog,
      target: buttonInDialog('Create Song'),
      optional: true,
      body: ['Creates the song. Everything else, the files and the audio, is added by editing it, which comes next.'],
    },
    {
      title: 'Editing a song',
      for: 'admin',
      route: '/song',
      before: openEditDialog,
      target: first('.v-overlay--active .v-card-title'),
      optional: true,
      body: [
        'The pencil next to a song opens this. Every change saves as you type; there is no save button, just close it.',
        'The top part is the same as when adding: name, Ultimate Guitar import, key, BPM, length, instrument and folder.',
      ],
    },
    {
      title: 'Moderation and lyrics',
      for: 'admin',
      route: '/song',
      before: openEditDialog,
      target: fieldLabeled('Lyrics'),
      optional: true,
      body: [
        'Moderation is what is said before the song; it shows above the lyrics.',
        'For chords, put each chord line above the words it belongs to. A song whose lyrics have chord lines gets a Chords view, and the text switches to a fixed-width font so they line up.',
      ],
    },
    {
      title: 'Audio from a file',
      for: 'admin',
      route: '/song',
      before: openEditDialog,
      target: fieldLabeled('Add audio track'),
      optional: true,
      body: ['Upload a recording or backing track (mp3, wav, …). A song can have several; the player lets you pick one.'],
    },
    {
      title: 'Audio from YouTube',
      for: 'admin',
      route: '/song',
      before: openEditDialog,
      target: fieldLabeled('Search YouTube'),
      optional: true,
      body: [
        'Search by name or paste a link, and pick the video: its audio is added as a track.',
        'Tick “Split into stems” to have it separated straight after.',
      ],
    },
    {
      title: 'Tracks and stems',
      for: 'admin',
      route: '/song',
      before: openEditDialog,
      target: () => buttonInDialog('Split into stems')() ?? buttonInDialog('Regenerate stems')(),
      optional: true,
      body: [
        'Each track can be renamed or removed. Split into stems separates it into vocals, drums, bass and the rest, so parts can be muted in the player.',
        'Splitting takes a few minutes and keeps going if you close the dialog; every device shows its progress. Drop stems goes back to the plain track.',
      ],
    },
    {
      title: 'Sheet and drum PDFs',
      for: 'admin',
      route: '/song',
      before: openEditDialog,
      target: fieldLabeled('Select sheet file'),
      optional: true,
      body: [
        'Choose the chord sheet PDF here, and the drum sheet in the section above. Their pages are previewed underneath once uploaded.',
        'Choosing a new file replaces the old one; the red button removes it.',
      ],
    },
    {
      title: 'Deleting a song',
      for: 'admin',
      route: '/song',
      before: openEditDialog,
      target: buttonInDialog('Delete Song'),
      optional: true,
      body: ['Removes the song and all its files. It asks first, and says which setlists it is in; it is taken out of those too.'],
    },
    {
      title: 'Find and sort',
      for: 'admin',
      route: '/song',
      before: closeDialogs,
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
      body: ['Who can sign in, and what each of them gets to see and change.'],
    },
    {
      title: 'Admins and users',
      for: 'admin',
      route: '/users',
      body: [
        'There are two kinds of account. An admin sees every setlist and can change anything: songs, setlists, markers, loops, the shared tempo and key.',
        'A user only sees the setlists you give them and cannot change anything the band shares. Their own capo, text size and count-in still work, on their device only.',
      ],
    },
    {
      title: 'Add someone',
      for: 'admin',
      route: '/users',
      target: () => document.querySelector('.fa-user-plus')?.closest('.v-card'),
      optional: true,
      body: [
        'Type their email and a starting password (at least 6 characters), pick a role and press Create.',
        'Send them the password yourself; they can change it with a reset mail.',
      ],
    },
    {
      title: 'Roles and setlists',
      for: 'admin',
      route: '/users',
      target: () => document.querySelectorAll('.v-container .v-card')[1],
      optional: true,
      body: [
        'Each account has its own card. Switch it between user and admin, and for a user tick the setlists they can see.',
        'Reset password sends them a mail to pick a new one; Revoke takes their access away. Your own card cannot be demoted or revoked.',
      ],
    },
    {
      title: 'Help is here',
      route: HOME_ROUTE,
      target: first('[aria-label="Help"]'),
      body: [
        'That is it. The player and the sheet views have guides of their own, which come up the first time you open them.',
        HELP_REMINDER,
      ],
    },
  ],
}

/** shorthand for a group of transport buttons, found by one of the buttons in it */
const groupWith = (label: string) => () => document.querySelector(`.audio-pane .group:has([aria-label="${label}"])`)
const loopGroupWith = (label: string) => () => document.querySelector(`.audio-pane .loop-row .group:has([aria-label="${label}"])`)

const openLoopControls = () => press('.audio-pane [aria-label="Show loop controls"]')
const openLoopList = () => {
  openLoopControls()
  return wait(50).then(() => press('.audio-pane [aria-label="Show loops and markers"]'))
}

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
      title: 'Jumping between markers',
      target: groupWith('Next marker'),
      body: [
        'The two arrows jump to the previous and next marker. The start and end of every saved loop count as well, so they are a quick way through a song cut into parts.',
        'Past the last one, they go to the start or the end of the song.',
      ],
    },
    {
      title: 'Adding and removing markers',
      for: 'admin',
      target: first('.audio-pane [aria-label="Add marker"], .audio-pane [aria-label="Remove marker"]'),
      optional: true,
      body: [
        'The flag between the arrows drops a marker where the playhead is.',
        'When the playhead is on a marker the flag turns chequered: press it then to delete that marker. Jump to one with the arrows first to delete it this way, or use the bin in the loops and markers list.',
      ],
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
      body: ['This switches looping on and off, and shows the loop controls. The guide has opened them for you.'],
    },
    {
      title: 'Setting A and B',
      before: openLoopControls,
      target: loopGroupWith('Clear A-B'),
      optional: true,
      body: [
        'Play up to where the passage starts and press A, then at its end press B. It now repeats until you stop it.',
        'Drag the A and B handles on the wave to fine-tune; the x clears both.',
      ],
    },
    {
      title: 'Saving a loop',
      for: 'admin',
      before: openLoopControls,
      target: loopGroupWith('Save loop'),
      optional: true,
      body: [
        '+ keeps the A-B as a saved loop, drawn as an orange pair of flags, which the whole band gets.',
        'Type in the box to name it (“Solo”, “Bridge”…); empty, it is shown by its number.',
        'The bin deletes the loop the A-B is on. Pick a loop first, by tapping its flag or from the list.',
      ],
    },
    {
      title: 'Saved loops',
      for: 'user',
      before: openLoopControls,
      target: loopGroupWith('Save loop'),
      optional: true,
      body: ['Loops an admin has saved show up as orange pairs of flags. Tap one, or pick it from the list, to loop it; the box shows its name.'],
    },
    {
      title: 'Walk, halve, double',
      before: openLoopControls,
      target: loopGroupWith('Halve selection'),
      optional: true,
      body: [
        'The arrows move the whole loop back or ahead by its own length, so you can work through a song one chunk at a time.',
        '½ halves the loop and x2 doubles it, keeping A where it is: good for drilling a tricky bar, then widening out again.',
      ],
    },
    {
      title: 'Loops and markers list',
      before: openLoopList,
      target: first('.audio-pane .lm-list'),
      body: [
        'While looping, every loop and marker is listed at the left edge of the wave. Tap one to go there; a loop is also put on the A-B.',
        'The tab folds the list away again.',
      ],
    },
    {
      title: 'Rename and delete',
      for: 'admin',
      target: first('.audio-pane .lm-list'),
      optional: true,
      body: ['The pencil next to an entry renames it, the bin deletes it. Quicker than finding the flag when there are many.'],
    },
    {
      title: 'List layout',
      target: first('.audio-pane [aria-label="List layout"]'),
      optional: true,
      body: ['The cog switches between loops then markers, and one list of both in the order they come in the song.'],
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

// --- the sheet views: the view menu is pressed the way a person would, so each view can be shown ---
const VIEW_MENU = '.song-info-bar .v-btn:has(.fa-caret-down)'
const currentView = () => document.querySelector(VIEW_MENU)?.textContent?.trim() ?? ''
let viewBeforeTour: string | null = null

/** switch the song to one of its views; false when it has nothing for that one */
async function showView(label: string): Promise<boolean> {
  const menu = document.querySelector<HTMLElement>(VIEW_MENU)
  if (!menu) return false
  if (currentView() === label) return true
  viewBeforeTour ??= currentView()
  menu.click()
  await wait(250)
  const item = [...document.querySelectorAll<HTMLElement>('.v-overlay--active .v-list-item')].find(
    (i) => i.textContent?.trim() === label
  )
  if (!item) {
    menu.click() // close it again: this song has nothing for that view
    await wait(200)
    return false
  }
  item.click()
  await wait(300)
  return true
}

export const SHEETS_TOUR: Tour = {
  id: 'sheets',
  title: 'Lyrics, chords & drums guide',
  // a song open in a setlist, and not in the player, which has its own guide
  trigger: () => (document.querySelector('.audio-pane') ? null : document.querySelector('.song-info-bar')),
  contextual: true,
  end: () => {
    if (viewBeforeTour) showView(viewBeforeTour)
    viewBeforeTour = null
  },
  steps: [
    {
      title: 'Playing a setlist',
      body: [
        'Every song of the setlist is here, in running order, shown as a sheet, a drum sheet, lyrics or chords.',
        'Tap the right half of the page to turn forward and the left half to turn back, or swipe. After the last page comes the next song.',
      ],
    },
    {
      title: 'Songs in the set',
      target: first('.file-nav-strip'),
      optional: true,
      body: ['Jump straight to any song. The shading shows which page of it you are on.'],
    },
    {
      title: 'Views',
      target: first(VIEW_MENU),
      body: [
        'Switch this song between its sheet, drums, lyrics and chords. Only the views the song has anything for are offered.',
        'The Guide entry at the bottom brings this guide back.',
      ],
    },
    {
      title: 'Sheet',
      before: () => showView('Sheet'),
      target: first('.song-info-bar'),
      body: ['The chord chart as uploaded. Several pages turn like the rest of the set.'],
    },
    {
      title: 'Writing on the sheet',
      for: 'admin',
      target: first('.song-info-bar [title="Annotate"]'),
      optional: true,
      body: ['The pen lets you draw on the sheet: cues, repeats, who plays what. Save and everyone sees it. It needs a connection.'],
    },
    {
      title: 'Click track',
      target: () => document.querySelector('.song-info-bar .fa-drum')?.closest('button'),
      optional: true,
      body: ['Tap the BPM to hear a click at the song’s tempo; the button blinks with it. Tap again to stop.'],
    },
    {
      title: 'Drums',
      before: () => showView('Drums'),
      target: first('.song-info-bar'),
      body: ['The drum sheet, for the drummer, turned the same way.'],
    },
    {
      title: 'Lyrics',
      before: () => showView('Lyrics'),
      target: first('.song-info-bar'),
      body: [
        'Just the words, with the moderation notes on top when the song has any.',
        '– and + change the text size on this device. The play button scrolls the lyrics along by itself.',
      ],
    },
    {
      title: 'Chords',
      before: () => showView('Chords'),
      target: first('.song-info-bar'),
      body: [
        'The lyrics with the chords above them.',
        'Capo moves the chords to what you play with a capo, on this device only; the key you then sound in is shown next to it.',
      ],
    },
    {
      title: 'Transpose for everyone',
      for: 'admin',
      target: () => document.querySelector('.song-info-bar [title="Transpose the song up, for everyone"]')?.parentElement,
      optional: true,
      body: [
        'The arrows change the song’s key for the whole band. Tap any chord in the text to correct it.',
      ],
    },
    {
      title: 'Edit the song',
      for: 'admin',
      target: () => document.querySelector('.file-nav-strip')?.previousElementSibling,
      optional: true,
      body: ['The pencil opens the song itself: name, key, lyrics, PDFs and audio.'],
    },
    {
      title: 'That is it',
      body: ['The view you were on is put back now. Open this guide again from the view menu, or with the ? in the top bar of the setlists page.'],
    },
  ],
}

export const TOURS: Tour[] = [AUDIO_TOUR, SHEETS_TOUR, APP_TOUR]
