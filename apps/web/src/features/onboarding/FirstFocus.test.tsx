// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FirstFocus from './FirstFocus'
const mocks = vi.hoisted(() => ({ count: vi.fn(), get: vi.fn(), add: vi.fn(), start: vi.fn(), auth: vi.fn(), state: { status: 'idle', running: false, remainingSeconds: 600 } }))
vi.mock('../../data/db', () => ({ db: { tasks: { count: mocks.count, get: mocks.get }, notes: { count: mocks.count }, focusSessions: { count: mocks.count }, diaryEntries: { count: mocks.count } } }))
vi.mock('../../data/repositories/tasksRepo', () => ({ tasksRepo: { add: mocks.add } }))
vi.mock('../../store/auth', () => ({ getAuth: mocks.auth }))
vi.mock('../../shared/i18n/useI18n', () => ({ useI18n: () => ({ language: 'en' }) }))
vi.mock('../focus/useSharedFocusTimer', () => ({ useSharedFocusTimer: () => ({ state: mocks.state, start: mocks.start, pause: vi.fn(), resume: vi.fn() }) }))
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocks.count.mockResolvedValue(0)
  mocks.get.mockResolvedValue(undefined)
  mocks.add.mockResolvedValue({ id: 'first-task' })
  mocks.start.mockResolvedValue(undefined)
  mocks.auth.mockReturnValue(null)
  mocks.state.status = 'idle'
})
describe('first focus onboarding', () => {
  it('creates one real task and starts a linked ten-minute session', async () => {
    render(<FirstFocus><div>Dashboard</div></FirstFocus>)
    fireEvent.change(await screen.findByLabelText('What will you work on?'), { target: { value: 'Write a paragraph' } })
    await act(async () => { fireEvent.click(screen.getByText('Start 10-minute focus')) })
    expect(mocks.add).toHaveBeenCalledTimes(1)
    expect(mocks.start).toHaveBeenCalledWith(10, 'first-task')
    expect(localStorage.getItem('focusgo.first-focus.v1')).toBe('started')
  })
  it('reuses a saved task when starting the timer failed', async () => {
    mocks.start.mockRejectedValueOnce(new Error('storage busy')).mockResolvedValueOnce(undefined)
    mocks.get.mockResolvedValue({ id: 'first-task' })
    render(<FirstFocus><div>Dashboard</div></FirstFocus>)
    fireEvent.change(await screen.findByLabelText('What will you work on?'), { target: { value: 'Write' } })
    await act(async () => { fireEvent.click(screen.getByText('Start 10-minute focus')) })
    expect(screen.getByRole('alert')).toBeDefined()
    await act(async () => { fireEvent.click(screen.getByText('Start 10-minute focus')) })
    expect(mocks.add).toHaveBeenCalledTimes(1)
    expect(mocks.start).toHaveBeenCalledTimes(2)
  })
  it('does not interrupt an existing workspace', async () => {
    mocks.count.mockResolvedValue(1)
    render(<FirstFocus><div>Dashboard</div></FirstFocus>)
    expect(await screen.findByText('Dashboard')).toBeDefined()
    expect(screen.queryByLabelText('What will you work on?')).toBeNull()
  })
  it('respects dismissal on subsequent visits', async () => {
    localStorage.setItem('focusgo.first-focus.v1', 'dismissed')
    render(<FirstFocus><div>Dashboard</div></FirstFocus>)
    expect(await screen.findByText('Dashboard')).toBeDefined()
    expect(mocks.count).not.toHaveBeenCalled()
  })
})
