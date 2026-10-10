// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { initialDashboardPage, isWorkingTime, rememberManualPage, writeAutoPageEnabled } from './autoPage'

beforeEach(() => window.localStorage.clear())

describe('isWorkingTime', () => {
  it('is weekdays 9:00–18:00 by default', () => {
    expect(isWorkingTime(new Date(2026, 9, 12, 9, 0))).toBe(true) // Monday
    expect(isWorkingTime(new Date(2026, 9, 12, 18, 0))).toBe(false)
    expect(isWorkingTime(new Date(2026, 9, 10, 11, 0))).toBe(false) // Saturday
  })

  it('follows the given hours', () => {
    expect(isWorkingTime(new Date(2026, 9, 10, 11, 0), { workStart: 600, workEnd: 900, workdays: [6] })).toBe(true)
  })
})

describe('initialDashboardPage', () => {
  it('stays on 专注 while the switch is off', () => {
    expect(initialDashboardPage(new Date(2026, 9, 10, 21, 0))).toBe('main')
  })

  it('opens 生活 outside working hours and 专注 inside, once switched on', () => {
    writeAutoPageEnabled(true)
    expect(initialDashboardPage(new Date(2026, 9, 12, 21, 0))).toBe('life')
    expect(initialDashboardPage(new Date(2026, 9, 12, 10, 0))).toBe('main')
  })

  it('keeps a page picked by hand for the rest of that day only', () => {
    writeAutoPageEnabled(true)
    rememberManualPage('main', new Date(2026, 9, 12, 20, 0))
    expect(initialDashboardPage(new Date(2026, 9, 12, 22, 0))).toBe('main')
    expect(initialDashboardPage(new Date(2026, 9, 13, 21, 0))).toBe('life')
  })
})
