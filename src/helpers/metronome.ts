// Metronome as a self-looping one-beat AudioBuffer: the audio hardware repeats
// the click sample-accurately with no JS timers involved. iOS freezes timers in
// backgrounded PWAs, which killed the previous lookahead scheduler; a looping
// buffer keeps playing. audioSession type 'playback' (iOS 16.4+) marks it as
// media so it survives backgrounding/screen lock and the mute switch.
// onRemote fires when the headset/lock-screen transport keys are pressed.
export function createMetronome(getBpm: () => number, onRemote?: (play: boolean) => void) {
  let ctx: AudioContext | null = null
  let source: AudioBufferSourceNode | null = null
  let silent: HTMLAudioElement | null = null

  function beatBuffer(c: AudioContext) {
    const sr = c.sampleRate
    const buf = c.createBuffer(1, Math.max(1, Math.round((sr * 60) / getBpm())), sr)
    const data = buf.getChannelData(0)
    for (let i = 0; i < sr * 0.03; i++) data[i] = Math.sin((2 * Math.PI * 1000 * i) / sr) * Math.exp(-i / (sr * 0.008))
    return buf
  }

  // iOS suspends the context on lock/background despite the playback session on
  // older versions; kick it back when we return
  const onVisible = () => {
    if (ctx && document.visibilityState === 'visible' && ctx.state !== 'running') ctx.resume()
  }

  // The transport keys only reach a page that owns the media session, and only
  // an HTMLMediaElement claims one - the click is Web Audio, which no platform
  // treats as media. So a silent track runs alongside the click (Chrome ignores
  // media shorter than 5s) and is paused and resumed with it: a headset button
  // toggles on what the platform sees actually playing, not on playbackState,
  // so a track left running would go on asking for 'pause' forever.
  function claimMediaKeys() {
    if (!onRemote || !navigator.mediaSession) return
    if (!silent) {
      silent = new Audio(URL.createObjectURL(new Blob([silentWav(30)], { type: 'audio/wav' })))
      silent.loop = true
      navigator.mediaSession.setActionHandler('play', () => onRemote(true))
      navigator.mediaSession.setActionHandler('pause', () => onRemote(false))
    }
    silent.play().catch(() => {})
  }

  function start() {
    claimMediaKeys()
    if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing'
    // the context outlives a stop: a remote 'play' is not a user gesture everywhere,
    // and a fresh context would come up suspended and stay silent
    if (!ctx) {
      const audioSession = (navigator as { audioSession?: { type: string } }).audioSession
      if (audioSession) audioSession.type = 'playback'
      ctx = new AudioContext()
      document.addEventListener('visibilitychange', onVisible)
    }
    ctx.resume()
    if (source) return
    source = ctx.createBufferSource()
    source.buffer = beatBuffer(ctx)
    source.loop = true
    source.connect(ctx.destination)
    source.start()
  }

  function stop() {
    if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused'
    silent?.pause()
    source?.stop()
    source?.disconnect()
    source = null
  }

  // leaving the view: give the media session and the audio hardware back
  function release() {
    stop()
    document.removeEventListener('visibilitychange', onVisible)
    ctx?.close()
    ctx = null
    if (silent) URL.revokeObjectURL(silent.src)
    silent = null
    if (navigator.mediaSession) {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.playbackState = 'none'
    }
  }

  return { start, stop, release }
}

// 8-bit mono silence, header written by hand so no asset has to be shipped
function silentWav(seconds: number) {
  const rate = 8000
  const n = seconds * rate
  const bytes = new Uint8Array(44 + n).fill(128, 44)
  const dv = new DataView(bytes.buffer)
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => (bytes[at + i] = c.charCodeAt(0)))
  ascii(0, 'RIFF')
  dv.setUint32(4, 36 + n, true)
  ascii(8, 'WAVEfmt ')
  dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true) // PCM
  dv.setUint16(22, 1, true) // mono
  dv.setUint32(24, rate, true)
  dv.setUint32(28, rate, true)
  dv.setUint16(32, 1, true)
  dv.setUint16(34, 8, true)
  ascii(36, 'data')
  dv.setUint32(40, n, true)
  return bytes
}
