// Drift-free metronome using the Web Audio clock.
// Clicks are scheduled ahead on AudioContext.currentTime, so even if the main
// thread hangs for a moment the beats stay aligned to the audio hardware clock.
// (Chris Wilson, "A Tale of Two Clocks".)
export function createMetronome(getBpm: () => number) {
  let ctx: AudioContext | null = null
  let nextNoteTime = 0 // audio-clock time of the next click
  let timer: ReturnType<typeof setTimeout> | null = null
  const lookahead = 0.1 // schedule clicks this many seconds ahead
  const tick = 25 // scheduler wake-up interval (ms)

  function scheduleClick(time: number) {
    const osc = ctx!.createOscillator()
    const gain = ctx!.createGain()
    osc.frequency.value = 1000
    gain.gain.setValueAtTime(1, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03)
    osc.connect(gain).connect(ctx!.destination)
    osc.start(time)
    osc.stop(time + 0.03)
  }

  function scheduler() {
    const secondsPerBeat = 60 / getBpm()
    while (nextNoteTime < ctx!.currentTime + lookahead) {
      scheduleClick(nextNoteTime)
      nextNoteTime += secondsPerBeat
    }
    timer = setTimeout(scheduler, tick)
  }

  function start() {
    if (ctx) return
    ctx = new AudioContext()
    nextNoteTime = ctx.currentTime + 0.1
    scheduler()
  }

  function stop() {
    if (timer) clearTimeout(timer)
    timer = null
    ctx?.close()
    ctx = null
  }

  return { start, stop }
}
