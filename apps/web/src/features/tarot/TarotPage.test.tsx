// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { SymbolicState, TarotSession, TarotReading } from '../symbolic/types'
import { EMPTY_SYMBOLIC_STATE } from '../symbolic/types'
import { drawCards } from './random'
import { buildTarotReports } from './interpretation'
import { defaultTarotContext } from './spreads'

const mocks = vi.hoisted(() => ({ data: null as unknown, start: vi.fn(), select: vi.fn(), finish: vi.fn(), update: vi.fn() }))
vi.mock('../symbolic/useSymbolic', () => ({
 useSymbolic: () => ({ owner: 'guest', data: mocks.data, ready: true, error: false }),
 useSymbolicCopy: () => ({ language: 'zh', text: (zh: string) => zh }),
 useSymbolicNow: () => new Date('2026-10-12T04:00:00Z'),
}))
vi.mock('../symbolic/storage', () => ({
 dailyReadingId: () => 'daily:Asia/Shanghai:2026-10-12',
 startTarotSession: mocks.start, selectTarotCard: mocks.select, finishTarotSession: mocks.finish, updateReading: mocks.update,
}))
vi.mock('../symbolic/SymbolicShell', () => ({
 SymbolicShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
 SymbolicTabs: ({ items, onChange }: { items: { id: string; label: string }[]; onChange: (value: string) => void }) => <nav>{items.map(item => <button key={item.id} onClick={() => onChange(item.id)}>{item.label}</button>)}</nav>,
 DataStatus: () => <p>Loading</p>,
}))
vi.mock('../symbolic/SymbolicWidget', () => ({ SymbolicWidget: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../symbolic/SyncStatus', () => ({ SymbolicSyncStatus: () => null }))
vi.mock('../symbolic/ReportView', () => ({ ReportView: () => <p>完整综合报告</p> }))
import TarotPage from './TarotPage'
import TarotWidget from './TarotWidget'
const state = () => mocks.data as SymbolicState
const session = (): TarotSession => ({
 id: 'session:manual', createdAt: new Date('2026-10-12T04:00:00Z').getTime(), dateKey: '2026-10-12', timeZone: 'Asia/Shanghai',
 spread: 'daily', context: defaultTarotContext(), deck: drawCards(78, false, () => 17), selected: [],
})
const reading = (s: TarotSession): TarotReading => ({
 id: s.spread === 'daily' ? 'daily:Asia/Shanghai:2026-10-12' : 'reading:manual',
 createdAt: s.createdAt, dateKey: s.dateKey, timeZone: s.timeZone, spread: s.spread, question: '测试问题', context: s.context,
 cards: s.selected.map(i => ({ ...s.deck[i], revealed: false })), reflection: '', contentVersion: '2', reports: buildTarotReports(s),
})
beforeEach(() => {
 cleanup(); vi.clearAllMocks()
 mocks.data = { ...EMPTY_SYMBOLIC_STATE, timeZone: 'Asia/Shanghai', sessions: [], readings: [] }
 mocks.update.mockImplementation(async (_owner: string, id: string, change: { reveal?: number; reflection?: string }) => {
  state().readings = state().readings.map(r => r.id !== id ? r : { ...r, cards: r.cards.map((c, i) => ({ ...c, revealed: c.revealed || i === change.reveal })), reflection: change.reflection ?? r.reflection })
 })
})
describe('manual tarot flow', () => {
 it('offers all 78 card backs, preserves the selected index and waits for save before reveal', async () => {
  const s = session(); state().sessions = [s]
  let resolveFinish: (value: TarotReading) => void = () => {}
  mocks.select.mockImplementation(async (_owner: string, _id: string, index: number) => {
   const next = { ...s, selected: [index] }; state().sessions = [next]; return next
  })
  mocks.finish.mockImplementation(() => new Promise<TarotReading>(resolve => { resolveFinish = resolve }))
  const view = render(<TarotPage/>)
  expect(screen.getAllByRole('button', { name: /^选择第 \d+ 张牌$/ })).toHaveLength(78)
  fireEvent.click(screen.getByRole('button', { name: '选择第 6 张牌' }))
  await waitFor(() => expect(mocks.finish).toHaveBeenCalledOnce())
  view.rerender(<TarotPage/>)
  expect(mocks.select).toHaveBeenCalledWith('guest', 'session:manual', 5)
  expect(screen.queryByRole('button', { name: '翻开第 1 张牌' })).toBeNull()
  const saved = reading({ ...s, selected: [5] })
  state().readings = [saved]; state().sessions = [{ ...s, selected: [5], completedReadingId: saved.id }]
  await act(async () => { resolveFinish(saved) })
  view.rerender(<TarotPage/>)
  await waitFor(() => expect(screen.getByRole('button', { name: '翻开第 1 张牌' })).toBeTruthy())
  expect(screen.queryByText('完整综合报告')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '翻开第 1 张牌' }))
  view.rerender(<TarotPage/>)
  await waitFor(() => expect(screen.getByText('完整综合报告')).toBeTruthy())
 })
 it('reveals a stored three-card spread sequentially and only then displays its saved report', async () => {
  const s = { ...session(), spread: 'three' as const, selected: [2,5,11] }
  state().readings = [reading(s)]
  const view = render(<TarotPage/>)
  fireEvent.click(screen.getByRole('button', { name: '我的记录' }))
  fireEvent.click(screen.getByRole('button', { name: /测试问题/ }))
  expect(screen.getByRole<HTMLButtonElement>('button', { name: '翻开第 2 张牌' }).disabled).toBe(true)
  expect(screen.queryByText('完整综合报告')).toBeNull()
  for (let i = 1; i <= 3; i++) {
   fireEvent.click(screen.getByRole('button', { name: '翻开第 ' + i + ' 张牌' }))
   view.rerender(<TarotPage/>)
   if (i < 3) await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: '翻开第 ' + (i + 1) + ' 张牌' }).disabled).toBe(false))
  }
  await waitFor(() => expect(screen.getByText('完整综合报告')).toBeTruthy())
  expect(screen.queryByRole('button', { name: '翻开全部' })).toBeNull()
 })
 it('keeps the widget as a manual draw entry and never draws on render', () => {
  render(<MemoryRouter><TarotWidget/></MemoryRouter>)
  expect(screen.getByRole<HTMLAnchorElement>('link', { name: '进入抽牌' }).getAttribute('href')).toBe('/tarot')
  expect(mocks.start).not.toHaveBeenCalled()
  expect(mocks.select).not.toHaveBeenCalled()
  expect(mocks.finish).not.toHaveBeenCalled()
 })
 it('can keep an unfinished question, start another and restore the original from history', () => {
  const saved = { ...session(), spread: 'three' as const, context: { ...defaultTarotContext(), question: '尚未完成的问题' }, selected: [2] }
  state().sessions = [saved]
  render(<TarotPage/>)
  fireEvent.click(screen.getByRole('button', { name: '带着问题抽牌' }))
  expect(screen.getByText('尚未完成的问题')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '暂存并开始新问题' }))
  expect(screen.getByRole('button', { name: '查看推荐牌阵' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '我的记录' }))
  fireEvent.click(screen.getByRole('button', { name: /尚未完成的问题/ }))
  expect(screen.getByRole('status').textContent).toContain('已选 1 / 3')
  expect(state().sessions[0]).toEqual(saved)
 })
 it('does not let a delayed begin overwrite a newly selected tab', async () => {
  let resolveStart: (value: TarotSession) => void = () => {}
  mocks.start.mockImplementation(() => new Promise<TarotSession>(resolve => { resolveStart = resolve }))
  const view = render(<TarotPage/>)
  fireEvent.click(screen.getByRole('button', { name: '确认并洗牌' }))
  fireEvent.click(screen.getByRole('button', { name: '带着问题抽牌' }))
  const saved = session(); state().sessions = [saved]
  await act(async () => { resolveStart(saved) })
  view.rerender(<TarotPage/>)
  expect(screen.getByRole('button', { name: '查看推荐牌阵' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '选择第 1 张牌' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '每日一牌' }))
  expect(screen.getAllByRole('button', { name: /^选择第 \d+ 张牌$/ })).toHaveLength(78)
 })
 it('keeps another historical reading open when a previous finish resolves later', async () => {
  const pending = session(); state().sessions = [pending]
  const prior = { ...reading({ ...session(), spread: 'three' as const, selected: [3,8,13] }), id: 'reading:prior', question: '正在查看的旧问题' }
  state().readings = [prior]
  let resolveFinish: (value: TarotReading) => void = () => {}
  mocks.select.mockImplementation(async (_owner: string, _id: string, index: number) => {
   const next = { ...pending, selected: [index] }; state().sessions = [next]; return next
  })
  mocks.finish.mockImplementation(() => new Promise<TarotReading>(resolve => { resolveFinish = resolve }))
  const view = render(<TarotPage/>)
  fireEvent.click(screen.getByRole('button', { name: '选择第 6 张牌' }))
  await waitFor(() => expect(mocks.finish).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('button', { name: '我的记录' }))
  fireEvent.click(screen.getByRole('button', { name: /正在查看的旧问题/ }))
  const saved = reading({ ...pending, selected: [5] })
  state().readings = [saved, prior]; state().sessions = [{ ...pending, selected: [5], completedReadingId: saved.id }]
  await act(async () => { resolveFinish(saved) })
  view.rerender(<TarotPage/>)
  expect(screen.getByRole('heading', { name: '正在查看的旧问题' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '翻开第 3 张牌' })).toBeTruthy()
 })
 it('shows frozen V2 card-position paragraphs while partially revealed', () => {
  const saved = reading({ ...session(), spread: 'three' as const, selected: [2,5,11] })
  saved.cards[0].revealed = true
  saved.reports!.zh.sections.find(section => section.id === 'card-0')!.paragraphs = ['当时保存的第一段原文', '当时保存的第二段原文']
  state().readings = [saved]
  render(<TarotPage/>)
  fireEvent.click(screen.getByRole('button', { name: '我的记录' }))
  fireEvent.click(screen.getByRole('button', { name: /测试问题/ }))
  expect(screen.getByText('当时保存的第一段原文')).toBeTruthy()
  expect(screen.getByText('当时保存的第二段原文')).toBeTruthy()
  expect(screen.queryByText('完整综合报告')).toBeNull()
 })
 it('uses original V1 positions even while a development question draft exists', () => {
  const saved: TarotReading = { ...reading({ ...session(), spread: 'three' as const, selected: [2,5,11] }), contentVersion: '1', context: undefined, reports: undefined }
  state().readings = [saved]
  render(<TarotPage/>)
  fireEvent.click(screen.getByRole('button', { name: '带着问题抽牌' }))
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'development' } })
  fireEvent.click(screen.getByRole('button', { name: '我的记录' }))
  fireEvent.click(screen.getByRole('button', { name: /测试问题/ }))
  expect(screen.getByText('当下')).toBeTruthy()
  expect(screen.getByText('留意')).toBeTruthy()
  expect(screen.getByText('行动')).toBeTruthy()
  expect(screen.queryByText('变化因素')).toBeNull()
  expect(screen.queryByText('延续的趋势')).toBeNull()
 })

 it('shows a small card illustration only after the saved daily card is revealed', () => {
  const saved = reading({ ...session(), selected: [2] }); state().readings = [saved]
  const view = render(<MemoryRouter><TarotWidget/></MemoryRouter>)
  expect(view.container.querySelector('.tarot-widget-card')).toBeNull()
  state().readings = [{ ...saved, cards: saved.cards.map(card => ({ ...card, revealed: true })) }]
  view.rerender(<MemoryRouter><TarotWidget/></MemoryRouter>)
  expect(view.container.querySelector('.tarot-widget-card .tarot-art')).toBeTruthy()
  expect(mocks.start).not.toHaveBeenCalled()
 })

})
