// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SymbolicSyncStatus } from './SyncStatus'

const state = vi.hoisted(() => ({ conflicts: [] as unknown[] }))
vi.mock('./useSymbolic', () => ({
 useSymbolic: () => ({ owner: 'test-owner', sync: { status: 'synced' }, conflicts: state.conflicts }),
 useSymbolicCopy: () => ({ zh: true, text: (zh: string) => zh }),
}))
vi.mock('./sync', () => ({ resolveSymbolicConflict: vi.fn(), symbolicCloudEnabled: () => true, syncSymbolicNow: vi.fn() }))
afterEach(cleanup)

describe('Tarot conflict previews', () => {
 it('checks each version separately and hides a full summary until all its cards are revealed', () => {
  state.conflicts = [{
   id: 'reading', kind: 'tarot',
   payload: { cards: [{ id: 'one', revealed: true }, { id: 'two', revealed: false }], reports: { zh: { summary: '不应提前显示的完整趋势' } } },
   conflict: { payload: { cards: [{ id: 'one', revealed: true }, { id: 'two', revealed: true }], reports: { zh: { summary: '云端已经翻开的完整趋势' } } } },
  }]
  render(<SymbolicSyncStatus />)
  expect(screen.queryByText('不应提前显示的完整趋势')).toBeNull()
  expect(screen.getByText('全部翻开后可比较解读')).toBeTruthy()
  expect(screen.getByText('云端已经翻开的完整趋势')).toBeTruthy()
 })

 it('does not reveal a report for a record without valid revealed cards', () => {
  state.conflicts = [{ id: 'daily', kind: 'tarot', payload: { cards: [], reports: { zh: { summary: '隐藏的每日牌解读' } } } }]
  render(<SymbolicSyncStatus />)
  expect(screen.queryByText('隐藏的每日牌解读')).toBeNull()
  expect(screen.getByText('全部翻开后可比较解读')).toBeTruthy()
 })
})
