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

  it('reads repeats and starts them on their first date', async () => {
    expect(await parseQuickAdd('每周五交周报', [])).toMatchObject({
      title: '交周报', dueDate: '2026-10-02', recurrence: { frequency: 'weekly', interval: 1 },
    })
    expect(await parseQuickAdd('每天背单词', [])).toMatchObject({
      title: '背单词', dueDate: '2026-09-26', recurrence: { frequency: 'daily', interval: 1 },
    })
    // September has 30 days: "the 31st" lands on the 30th but keeps 31 for later months.
    expect(await parseQuickAdd('每月31号对账', [])).toMatchObject({
      title: '对账', dueDate: '2026-09-30', recurrence: { frequency: 'monthly', interval: 1, monthDay: 31 },
    })
    expect(await parseQuickAdd('每月 5 号交房租', [])).toMatchObject({
      title: '交房租', dueDate: '2026-10-05', recurrence: { frequency: 'monthly', monthDay: 5 },
    })
    expect(await parseQuickAdd('每两周 例会', [])).toMatchObject({ title: '例会', recurrence: { frequency: 'weekly', interval: 2 } })
    // Saturday: the first weekday is Monday.
    expect(await parseQuickAdd('每个工作日 站会', [])).toMatchObject({
      title: '站会', dueDate: '2026-09-28', recurrence: { frequency: 'weekdays' },
    })
    expect(await parseQuickAdd('every monday standup', [])).toMatchObject({
      title: 'standup', dueDate: '2026-09-28', recurrence: { frequency: 'weekly', interval: 1 },
    })
  })

  it('puts a clock time on the repeat day as a reminder', async () => {
    const parsed = await parseQuickAdd('每周五下午3点交周报', [])
    expect(parsed).toMatchObject({ title: '交周报', dueDate: '2026-10-02', recurrence: { frequency: 'weekly' } })
    expect(parsed.reminderAt).toBe(new Date(2026, 9, 2, 15, 0, 0).getTime())
  })

  it('leaves words that only look like repeats in the title', async () => {
    expect(await parseQuickAdd('整理工作日志', [])).toMatchObject({ title: '整理工作日志', recurrence: undefined })
    expect(await parseQuickAdd('write weekly report', [])).toMatchObject({ title: 'write weekly report', recurrence: undefined })
    expect(await parseQuickAdd('写周报', [])).toMatchObject({ recurrence: undefined })
  })
  it('reads "等 <who>" as waiting on someone, the date as when to chase', async () => {
    expect(await parseQuickAdd("等 Lowe's 回报价 周五", [])).toMatchObject({
      title: "Lowe's 回报价", waitingOn: "Lowe's", dueDate: '2026-10-02',
    })
    expect(await parseQuickAdd('wait for Ace samples', [])).toMatchObject({ title: 'Ace samples', waitingOn: 'Ace' })
    expect(await parseQuickAdd('等 @Ace 样品', [])).toMatchObject({ title: 'Ace 样品', waitingOn: 'Ace' })
  })

  it('leaves 等待, 等级 and "等 3 天" alone', async () => {
    expect(await parseQuickAdd('等待报价', [])).toMatchObject({ title: '等待报价', waitingOn: undefined })
    expect(await parseQuickAdd('等级考试报名', [])).toMatchObject({ waitingOn: undefined })
    expect((await parseQuickAdd('等 3 天再看', [])).waitingOn).toBeUndefined()
  })
})
