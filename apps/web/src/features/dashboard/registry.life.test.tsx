import { describe, expect, it } from 'vitest'
import { getLifeCards } from './registry'

describe('getLifeCards', () => {
  it('registers daily review on the life dashboard', () => {
    expect(getLifeCards().some((card) => card.id === 'daily_review')).toBe(true)
  })

  it('registers podcast and people cards on the life dashboard', () => {
    const cards = getLifeCards()
    expect(cards.some((card) => card.id === 'podcast_card')).toBe(true)
    expect(cards.some((card) => card.id === 'people_card')).toBe(true)
  })
})
