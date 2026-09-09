import { autoNumbers } from '@/helpers/autoNumber'
import { describe, expect, it } from 'vitest'

describe('autoNumbers', () => {
  it('numbers the unnamed ones through the song, whatever order they were made in', () => {
    expect(autoNumbers([{ at: 30 }, { at: 10 }, { at: 20 }])).toEqual([3, 1, 2])
  })

  it('skips the named ones rather than leaving a gap', () => {
    expect(autoNumbers([{ at: 10 }, { at: 20, name: 'Chorus' }, { at: 30 }])).toEqual([1, undefined, 2])
  })
})
