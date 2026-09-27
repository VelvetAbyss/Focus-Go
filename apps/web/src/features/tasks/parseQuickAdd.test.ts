import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseQuickAdd } from './parseQuickAdd'

// Saturday 2026-09-26, 10:00 local.
const NOW = new Date(2026, 8, 26, 10, 0, 0)

describe('parseQuickAdd', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads Chinese dates written without spaces', async () => {
    expect(await parseQuickAdd('明天交报告', [])).toMatchObject({ title: '交报告', dueDate: '2026-09-27' })
    expect(await parseQuickAdd('后天去医院', [])).toMatchObject({ title: '去医院', dueDate: '2026-09-28' })
    expect(await parseQuickAdd('周五前提交周报', [])).toMatchObject({ title: '提交周报', dueDate: '2026-10-02' })
    expect(await parseQuickAdd('9月30日缴费', [])).toMatchObject({ title: '缴费', dueDate: '2026-09-30' })
    expect(await parseQuickAdd('3天后复查 !1', [])).toMatchObject({ title: '复查', dueDate: '2026-09-29', priority: 'high' })
  })

  it('turns a clock time into a reminder and marks today', async () => {
    const parsed = await parseQuickAdd('今天下午3点开会', [])
    expect(parsed).toMatchObject({ title: '开会', dueDate: '2026-09-26', isToday: true })
    expect(parsed.reminderAt).toBe(new Date(2026, 8, 26, 15, 0, 0).getTime())
  })

  it('joins a separate clock time onto the date', async () => {
    const parsed = await parseQuickAdd('周五前提交季度报告 下午3点', [])
    expect(parsed).toMatchObject({ title: '提交季度报告', dueDate: '2026-10-02' })
    expect(parsed.reminderAt).toBe(new Date(2026, 9, 2, 15, 0, 0).getTime())
  })

  it('leaves month-only and part-of-day words in the title', async () => {
    expect(await parseQuickAdd('整理12月账单', [])).toMatchObject({ title: '整理12月账单', dueDate: undefined })
    expect(await parseQuickAdd('早上跑步', [])).toMatchObject({ title: '早上跑步', dueDate: undefined })
    expect(await parseQuickAdd('写周报', [])).toMatchObject({ title: '写周报', dueDate: undefined })
  })

  it('keeps the English behaviour and drops the dangling preposition', async () => {
    expect(await parseQuickAdd('report by friday #work', [])).toMatchObject({ title: 'report', dueDate: '2026-10-02', tags: ['work'] })
    expect(await parseQuickAdd('call mom tomorrow', [])).toMatchObject({ title: 'call mom', dueDate: '2026-09-27' })
    expect(await parseQuickAdd('明天 写周报 #工作', [])).toMatchObject({ title: '写周报', dueDate: '2026-09-27', tags: ['工作'] })
  })
})
