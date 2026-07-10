// Metronome as a self-looping one-beat AudioBuffer: the audio hardware repeats
// the click sample-accurately with no JS timers involved. iOS freezes timers in
// backgrounded PWAs, which killed the previous lookahead scheduler; a looping
// buffer keeps playing. audioSession type 'playback' (iOS 16.4+) marks it as
// media so it survives backgrounding/screen lock and the mute switch.
export function createMetronome(getBpm: () => number) {
  let ctx: AudioContext | null = null
  let source: AudioBufferSourceNode | null = null

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

  function start() {
    if (ctx) return
    const audioSession = (navigator as { audioSession?: { type: string } }).audioSession
    if (audioSession) audioSession.type = 'playback'
    ctx = new AudioContext()
    source = ctx.createBufferSource()
    source.buffer = beatBuffer(ctx)
    source.loop = true
    source.connect(ctx.destination)
    source.start()
    document.addEventListener('visibilitychange', onVisible)
  }

  function stop() {
    document.removeEventListener('visibilitychange', onVisible)
    source?.stop()
    ctx?.close()
    source = null
    ctx = null
  }

  return { start, stop }
}
