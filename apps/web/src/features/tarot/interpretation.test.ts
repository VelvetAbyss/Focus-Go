import { describe, expect, it } from 'vitest'
import { TAROT_DECK } from './deck'
import { drawCards } from './random'
import { SEMANTIC_CARD_IDS, cardSemantics } from './semantics'
import { buildTarotReports, interpretTarot, questionFocus } from './interpretation'
import { defaultTarotContext, recommendedSpread, spreadPositions, validateTarotContext } from './spreads'
import type { DrawnCard, TarotContext, TarotSession } from '../symbolic/types'

const card = (id: string, reversed = false): DrawnCard => ({ id, reversed, revealed: false })
const context = (overrides: Partial<TarotContext> = {}): TarotContext => ({ ...defaultTarotContext(), question: '我可以怎样推进这个项目？', ...overrides })
const facts = { id: 'test', dateKey: '2026-10-12', spread: 'three' as const, context: context(), cards: [card('major-1'), card('wands-10'), card('pentacles-3')] }
describe('tarot content and context', () => {
 it('covers every card with distinct upright and reversed semantics in both languages and all topics', () => {
  expect(new Set(SEMANTIC_CARD_IDS)).toEqual(new Set(TAROT_DECK.map(c => c.id)))
  for (const c of TAROT_DECK) for (const language of ['zh','en'] as const) for (const topic of ['general','career','money','love'] as const) {
   const upright = cardSemantics(card(c.id), context({ topic }), language)
   const reversed = cardSemantics(card(c.id, true), context({ topic }), language)
   expect(upright.meaning).not.toBe(reversed.meaning)
   expect(upright.domain.length).toBeGreaterThan(10)
   expect(reversed.domain.length).toBeGreaterThan(10)
  }
 })
 it('recommends a spread using explicit intent rather than pretending to infer arbitrary text', () => {
  expect(recommendedSpread(context())).toBe('three')
  expect(recommendedSpread(context({ intent: 'choice' }))).toBe('choice')
  expect(recommendedSpread(context({ intent: 'relationship' }))).toBe('relationship')
  expect(questionFocus(context({ question: 'abcxyz' }), 'zh')).toBeNull()
  expect(questionFocus(context({ question: '我要如何与同事沟通？' }), 'zh')?.id).toBe('communication')
  expect(validateTarotContext(context({ intent: 'choice', optionA: 'same', optionB: 'same' }), 'choice')).toBe('options')
 })
 it('uses different positions for action, development, choice and relationship intents', () => {
  expect(spreadPositions('three', context()).map(p => p.role)).toEqual(['present','friction','action'])
  expect(spreadPositions('three', context({ intent: 'development' })).map(p => p.role)).toEqual(['present','influence','trend'])
  expect(spreadPositions('choice', context()).map(p => p.role)).toEqual(['present','aSupport','aCost','bSupport','bCost'])
  expect(spreadPositions('relationship', context()).map(p => p.role)).toEqual(['self','interaction','bridge','friction','action'])
 })
})
describe('composed interpretation', () => {
 it('reads an action card as a response to the obstacle, with question-specific checks', () => {
  const report = interpretTarot(facts, 'zh')
  expect(report.sections[0].paragraphs.join(' ')).toContain('需要回应第二张牌的制约')
  expect(report.sections.find(s => s.id === 'question')?.suggestions.join(' ')).toContain('小交付')
  expect(report.sections.find(s => s.id === 'card-1')?.paragraphs.join(' ')).toContain('阻力位置')
  expect(report.scores).toBeUndefined()
 })
 it('changes the synthesis when cards change positions, orientations, or the topic changes', () => {
  const original = interpretTarot(facts, 'zh')
  const swapped = interpretTarot({ ...facts, cards: [facts.cards[2], facts.cards[1], facts.cards[0]] }, 'zh')
  const reversed = interpretTarot({ ...facts, cards: [card('major-1', true), ...facts.cards.slice(1)] }, 'zh')
  const love = interpretTarot({ ...facts, context: context({ topic: 'love' }) }, 'zh')
  expect(swapped.summary).not.toBe(original.summary)
  expect(reversed.summary).not.toBe(original.summary)
  expect(love.sections.find(s => s.id === 'card-0')?.paragraphs).not.toEqual(original.sections.find(s => s.id === 'card-0')?.paragraphs)
 })
 it('recognises repeated themes and mixed pacing without using an outcome score', () => {
  const report = interpretTarot({ ...facts, cards: [card('major-1'),card('wands-8'),card('major-9')] }, 'zh')
  const relations = report.sections.find(s => s.id === 'relations')
  expect(relations?.paragraphs.join(' ')).toContain('2 个牌位重复')
  expect(relations?.paragraphs.join(' ')).toContain('节奏上的制约')
  expect(relations?.evidence.length).toBeGreaterThanOrEqual(2)
 })
 it('compares named alternatives using paired support and required work', () => {
  const report = interpretTarot({ ...facts, spread: 'choice', context: context({ intent: 'choice', topic: 'career', optionA: '留任', optionB: '换岗' }), cards: [card('major-11'),card('pentacles-8'),card('wands-10'),card('major-0'),card('pentacles-2',true)] }, 'zh')
  expect(report.summary).toContain('留任')
  expect(report.summary).toContain('换岗')
  expect(report.sections[0].paragraphs[0]).toContain('取决于你是否愿意处理')
  expect(report.sections[0].paragraphs[1]).toContain('实际资源和行动')
  expect(report.sections[0].paragraphs[2]).toContain('不将牌面换算成胜率')
 })
 it('keeps relationship positions about observable interaction rather than another person’s thoughts', () => {
  const report = interpretTarot({ ...facts, spread: 'relationship', context: context({ topic: 'love', intent: 'relationship' }), cards: [card('cups-2'),card('cups-6'),card('major-14'),card('swords-2'),card('cups-14')] }, 'en')
  expect(report.sections.find(s => s.id === 'card-1')?.paragraphs.join(' ')).toContain('not another person’s private thoughts')
  expect(report.sections[0].paragraphs).toHaveLength(3)
 })
 it('rejects missing or duplicated spread cards instead of silently inventing a reading', () => {
  expect(() => interpretTarot({ ...facts, cards: [card('major-1')] }, 'zh')).toThrow()
  expect(() => interpretTarot({ ...facts, cards: [card('major-1'),card('major-1'),card('major-2')] }, 'zh')).toThrow()
  expect(() => interpretTarot({ ...facts, cards: [card('unknown'),card('major-1'),card('major-2')] }, 'zh')).toThrow()
 })
 it('creates bilingual snapshots from the actual selected deck indices in order', () => {
  const deck = drawCards(78, false, () => 17)
  const session: TarotSession = { id: 'session:test', createdAt: 0, timeZone: 'Asia/Shanghai', dateKey: '2026-10-12', spread: 'three', context: context(), deck, selected: [13,1,67] }
  const reports = buildTarotReports(session)
  const expected = interpretTarot({ id: session.id, dateKey: session.dateKey, spread: session.spread, context: session.context, cards: session.selected.map(i => deck[i]) }, 'zh')
  expect(reports.zh).toEqual(expected)
  expect(reports.en.sections.map(s => s.id)).toEqual(reports.zh.sections.map(s => s.id))
  const snapshot = JSON.stringify(reports)
  session.context.question = 'A later changed question'
  expect(JSON.stringify(reports)).toBe(snapshot)
 })
 it('can shuffle a complete deck for manual selection without repetition', () => {
  const deck = drawCards(78, true, () => 17)
  expect(new Set(deck.map(c => c.id)).size).toBe(78)
  expect(deck.every(c => !c.revealed)).toBe(true)
  expect(() => drawCards(79, true)).toThrow()
 })
 it('uses the account day boundaries, including offset zones and daylight saving changes', () => {
  const daily = { ...facts, spread: 'daily' as const, cards: [card('major-0')] }
  const offset = interpretTarot({ ...daily, timeZone: '+08:00' }, 'zh')
  expect(offset.period?.start).toBe('2026-10-11T16:00:00Z')
  expect(offset.period?.end).toBe('2026-10-12T16:00:00Z')
  const dst = interpretTarot({ ...daily, dateKey: '2026-03-08', timeZone: 'America/New_York' }, 'en')
  expect(Date.parse(dst.period!.end) - Date.parse(dst.period!.start)).toBe(23 * 60 * 60 * 1000)
 })
 it('derives avoid-actions from the relevant friction card instead of a common disclaimer', () => {
  const first = interpretTarot(facts, 'zh')
  const second = interpretTarot({ ...facts, cards: [facts.cards[0], card('swords-2'), facts.cards[2]] }, 'zh')
  expect(first.donts[0]).toContain('盘点时间')
  expect(second.donts[0]).toContain('关键')
  expect(second.donts).not.toEqual(first.donts)
 })
})
