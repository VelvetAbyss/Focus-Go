import { it,expect } from 'vitest'
import { getDashboardCards } from '../dashboard/registry'
it('keeps all symbolic widgets opt-in and tied to their Labs modules',()=>{
  const cards=getDashboardCards().filter(c=>['bazi','astrology','tarot'].includes(c.id))
  expect(cards).toHaveLength(3)
  cards.forEach(card=>{expect(card.defaultVisible).toBe(false);expect(card.featureKey).toBe(card.id);expect(card.defaultSize).toEqual({w:4,h:4})})
})
