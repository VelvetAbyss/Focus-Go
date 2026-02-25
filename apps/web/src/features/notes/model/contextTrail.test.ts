import { describe, expect, it } from 'vitest'
import { pushContextTrail } from './contextTrail'

describe('contextTrail', () => {
  it('keeps latest navigation order with dedupe', () => {
    const next = pushContextTrail(['a', 'b', 'c'], 'b', 5)

    expect(next).toEqual(['a', 'c', 'b'])
  })

  it('trims to max size from the oldest side', () => {
    const next = pushContextTrail(['a', 'b', 'c'], 'd', 3)

    expect(next).toEqual(['b', 'c', 'd'])
  })
})
