// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { markFeatureSeen, setPendingCoachmark } from './onboarding.runtime'

const navigateMock = vi.fn()

vi.mock('../../shared/i18n/useI18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'coachmark.focus.title': 'Next: move into Focus',
        'coachmark.focus.description': 'Focus description',
        'coachmark.focus.cta': 'Open Focus',
        'coachmark.focus.timerTitle': 'This is your focus timer',
        'coachmark.focus.timerDescription': 'Timer description',
        'coachmark.diary.title': 'Diary title',
        'coachmark.diary.description': 'Diary description',
        'coachmark.diary.cta': 'Open Diary',
      }[key] ?? key),
  }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

import OnboardingProgressiveRuntime from './OnboardingProgressiveRuntime'

describe('OnboardingProgressiveRuntime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    navigateMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('shows focus coachmark when pending on tasks route', () => {
    window.localStorage.clear()
    setPendingCoachmark('focus')
    document.body.innerHTML = '<div data-coachmark-anchor="tasks-entry" style="height:10px"></div>'

    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <OnboardingProgressiveRuntime />
      </MemoryRouter>,
    )

    expect(screen.getByText('Next: move into Focus')).toBeInTheDocument()
  })

  it('marks focus seen when timer coachmark is dismissed', () => {
    window.localStorage.clear()
    document.body.innerHTML = '<div data-coachmark-anchor="focus-page" style="height:10px"></div>'

    render(
      <MemoryRouter initialEntries={['/focus']}>
        <OnboardingProgressiveRuntime />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByLabelText('Dismiss coachmark'))
    expect(JSON.parse(window.localStorage.getItem('focusgo.onboarding.feature-seen') ?? '{}').focus).toBe(true)
  })

  it('shows diary coachmark after 18:00 when unseen', () => {
    window.localStorage.clear()
    markFeatureSeen('focus')
    document.body.innerHTML = '<div data-coachmark-anchor="diary-page" style="height:10px"></div>'
    const eveningTime = new Date()
    eveningTime.setHours(19, 0, 0, 0)
    vi.setSystemTime(eveningTime)

    render(
      <MemoryRouter initialEntries={['/diary']}>
        <OnboardingProgressiveRuntime />
      </MemoryRouter>,
    )

    expect(screen.getByText('Diary title')).toBeInTheDocument()
  })
})
