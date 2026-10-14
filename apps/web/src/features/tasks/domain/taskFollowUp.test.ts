import { describe, expect, it } from 'vitest'
import type { TaskItem } from '../../../data/models/types'
import { addWorkdays, groupWaitingByCounterpart, safeSourceUrl, sourceLabel, withChase } from './taskFollowUp'

const task = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: 't', title: '报价', description: '', pinned: false, isToday: false, status: 'waiting', priority: null,
  tags: [], subtasks: [], taskNoteBlocks: [], activityLogs: [], createdAt: 1, updatedAt: 1, ...overrides,
})

describe('safeSourceUrl', () => {
  it('keeps web, mailto and Mail.app links', () => {
    expect(safeSourceUrl(' https://mail.google.com/mail/u/0/#inbox/abc ')).toBe('https://mail.google.com/mail/u/0/#inbox/abc')
    expect(safeSourceUrl('mailto:buyer@lowes.com')).toBe('mailto:buyer@lowes.com')
    expect(safeSourceUrl('message:%3Cabc@mail%3E')).toBe('message:%3Cabc@mail%3E')
  })

  it('drops anything that could run code or is not a link', () => {
    expect(safeSourceUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeSourceUrl('data:text/html,<b>x</b>')).toBeUndefined()
    expect(safeSourceUrl('just words')).toBeUndefined()
    expect(safeSourceUrl(42)).toBeUndefined()
  })
})

describe('sourceLabel', () => {
  it('names the mail service or the host', () => {
    expect(sourceLabel('https://mail.google.com/mail/u/0/#inbox/abc')).toBe('Gmail')
    expect(sourceLabel('https://outlook.office.com/mail/id/1')).toBe('Outlook')
    expect(sourceLabel('https://www.lowes.com/pd/123')).toBe('lowes.com')
    expect(sourceLabel('mailto:buyer@lowes.com?subject=Hi')).toBe('buyer@lowes.com')
    expect(sourceLabel('message:%3Cabc%3E')).toBe('Mail')
  })
})

describe('addWorkdays', () => {
  it('skips the weekend', () => {
    // Friday 2026-10-09 + 3 workdays → Wednesday 2026-10-14
    expect(addWorkdays(new Date(2026, 9, 9, 18), 3)).toBe('2026-10-14')
    // Saturday counts from Monday
    expect(addWorkdays(new Date(2026, 9, 10, 10), 1)).toBe('2026-10-12')
  })
})

describe('withChase', () => {
  it('logs the chase, counts it and moves the chase date three workdays on', () => {
    const now = new Date(2026, 9, 9, 18).getTime()
    const chased = withChase(task({ chasedAt: [1], progressHistory: [{ id: 'p', text: '寄了样品', createdAt: 5 }], waitingSince: 7 }), '10月9日 已催', now)
    expect(chased.chasedAt).toEqual([1, now])
    expect(chased.dueDate).toBe('2026-10-14')
    // A reminder that morning, so the push reaches you on the chase day.
    expect(chased.reminderAt).toBe(new Date(2026, 9, 14, 9, 0).getTime())
    expect(chased.reminderFiredAt).toBeUndefined()
    expect(chased.progressHistory?.map((entry) => entry.text)).toEqual(['10月9日 已催', '寄了样品'])
    expect(chased.status).toBe('waiting')
    expect(chased.waitingSince).toBe(7)
  })
})

describe('groupWaitingByCounterpart', () => {
  it('names a group by the capitalised spelling when the counts tie', () => {
    const [group] = groupWaitingByCounterpart([task({ id: 'a', waitingOn: "lowe's" }), task({ id: 'b', waitingOn: "Lowe's" })], () => 0)
    expect(group.who).toBe("Lowe's")
  })

  it('groups by who, case-insensitive, longest wait first, unnamed last', () => {
    const days: Record<string, number> = { a: 2, b: 9, c: 4, d: 1, e: 0 }
    const groups = groupWaitingByCounterpart(
      [
        task({ id: 'a', waitingOn: "Lowe's" }),
        task({ id: 'b', waitingOn: 'Ace' }),
        task({ id: 'c', waitingOn: "lowe's " }),
        task({ id: 'e', waitingOn: "lowe's" }),
        task({ id: 'd' }),
      ],
      (item) => days[item.id],
    )
    expect(groups.map((group) => [group.who, group.longest, group.tasks.map((item) => item.id)])).toEqual([
      ['Ace', 9, ['b']],
      // Two "lowe's" against one "Lowe's": the spelling written most wins.
      ["lowe's", 4, ['c', 'a', 'e']],
      [null, 1, ['d']],
    ])
  })
})
