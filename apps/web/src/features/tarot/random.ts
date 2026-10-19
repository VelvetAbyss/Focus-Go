import { TAROT_DECK } from './deck'
import type { DrawnCard } from '../symbolic/types'
export type RandomWord = () => number
const cryptoWord: RandomWord = () => crypto.getRandomValues(new Uint32Array(1))[0]
export function randomBelow(bound: number, random: RandomWord = cryptoWord): number {
 if (!Number.isInteger(bound) || bound < 1 || bound > 0x100000000) throw new Error('Invalid random bound')
 const ceiling = Math.floor(0x100000000 / bound) * bound
 for (;;) { const value = random(); if (!Number.isInteger(value) || value < 0 || value >= 0x100000000) throw new Error('Invalid random source'); if (value < ceiling) return value % bound }
}
export function drawCards(count: number, reverse: boolean, random: RandomWord = cryptoWord): DrawnCard[] {
 if (!Number.isInteger(count) || count < 1 || count > TAROT_DECK.length) throw new Error('Invalid card count')
 const deck = TAROT_DECK.map(card => card.id)
 for (let i = deck.length - 1; i > 0; i--) { const j = randomBelow(i + 1, random); [deck[i], deck[j]] = [deck[j], deck[i]] }
 return deck.slice(0, count).map(id => ({ id, reversed: reverse && randomBelow(2, random) === 1, revealed: false }))
}
