import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

/**
 * A capo, per song and per device. The band's key lives on the song and is shared; this
 * is the player's own offset on top of it, so the guitarist reading capo shapes and the
 * singer reading concert pitch can look at the same setlist.
 *
 * A capo raises what is heard, so the chords to read are that many semitones lower —
 * which is why this subtracts. Negative values are allowed, and then it is simply a
 * local transpose, for a part written in another key.
 */
const capos = useLocalStorage<Record<string, number>>('capo', {})

export function useCapo(songId: () => string | undefined) {
  return computed({
    get: () => (songId() ? capos.value[songId()!] || 0 : 0),
    set: (value: number) => {
      const id = songId()
      if (!id) return
      const next = { ...capos.value }
      // a capo of zero is the absence of one, and keeping it would grow the map forever
      if (value) next[id] = Math.max(-11, Math.min(11, Math.round(value)))
      else delete next[id]
      capos.value = next
    },
  })
}
