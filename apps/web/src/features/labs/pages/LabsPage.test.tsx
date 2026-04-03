// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest'
import LabsPage from './LabsPage'
import type { FeatureCatalogItem } from '../labsApi'

const mockPushToast = vi.fn()
const mockInstall = vi.fn(async () => undefined)
const mockRemove = vi.fn(async () => undefined)
const mockRestore = vi.fn(async () => undefined)
const mockOpenUpgradeModal = vi.fn()

const mockUseLabs = vi.fn()

vi.mock('../LabsContext', () => ({
  useLabs: () => mockUseLabs(),
}))

vi.mock('../../../shared/ui/toast/toast', () => ({
  useToast: () => ({ push: mockPushToast }),
}))

vi.mock('../UpgradeModalContext', () => ({
  useUpgradeModal: () => ({ openModal: mockOpenUpgradeModal }),
}))

const i18n = {
  nav: {
    dashboard: 'Dashboard',
    tasks: 'Tasks',
    note: 'Note',
    calendar: 'Calendar',
    focus: 'Focus',
    review: 'Review',
    settings: 'Settings',
    labs: 'Labs',
  },
  labs: {
    title: 'Labs',
    subtitle: 'subtitle',
    available: 'Available',
    installed: 'Installed',
    removed: 'Removed',
    premiumLocked: 'Premium required',
    install: 'Install',
    openHabits: 'Open Habits',
    remove: 'Remove',
    restore: 'Restore',
    upgrade: 'Upgrade to Premium',
    comingSoon: 'Coming soon',
    upgradeTitle: 'Upgrade to Premium?',
    upgradeDesc: 'desc',
    upgradeConfirm: 'Activate mock Premium',
    cancel: 'Cancel',
    removeTitle: 'Remove feature?',
    removeDesc: 'remove desc',
  },
  toast: {
    habitAccessDenied: 'denied',
    upgraded: 'upgraded',
    installed: 'installed',
    removed: 'removed',
    restored: 'restored',
  },
}

vi.mock('../labsI18n', () => ({
  useLabsI18n: () => i18n,
}))

const makeFeature = (
  state: FeatureCatalogItem['state'],
  overrides: Partial<FeatureCatalogItem> = {},
): FeatureCatalogItem => ({
  featureKey: 'habit-tracker',
  title: 'Habit Tracker',
  description: 'desc',
  premiumOnly: true,
  comingSoon: false,
  state,
  requiresPremium: false,
  ...overrides,
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <LabsPage />
    </MemoryRouter>,
  )

describe('LabsPage', () => {
  beforeEach(() => {
    mockPushToast.mockReset()
    mockInstall.mockClear()
    mockRemove.mockClear()
    mockRestore.mockClear()
    mockOpenUpgradeModal.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('installs Habit Tracker', async () => {
    mockUseLabs.mockReturnValue({
      ready: true,
      catalog: [makeFeature('available')],
      subscription: { tier: 'premium', role: 'admin' },
      install: mockInstall,
      remove: mockRemove,
      restore: mockRestore,
    })

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: i18n.labs.install }))

    await waitFor(() => expect(mockInstall).toHaveBeenCalledWith('habit-tracker'))
  })

  it('shows upgrade dialog for free user', async () => {
    mockUseLabs.mockReturnValue({
      ready: true,
      catalog: [makeFeature('available', { requiresPremium: true })],
      subscription: { tier: 'free', role: 'member' },
      install: mockInstall,
      remove: mockRemove,
      restore: mockRestore,
    })

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: i18n.labs.upgrade }))
    expect(mockOpenUpgradeModal).toHaveBeenCalledWith('Habit Tracker')
  })

  it('removes and restores features with confirm flow', async () => {
    mockUseLabs.mockReturnValue({
      ready: true,
      catalog: [makeFeature('installed'), makeFeature('removed', { featureKey: 'ai-digest', title: 'AI Digest' })],
      subscription: { tier: 'premium', role: 'admin' },
      install: mockInstall,
      remove: mockRemove,
      restore: mockRestore,
    })

    renderPage()

    const habitCard = screen.getByText('Habit Tracker').closest('.rounded-xl')
    expect(habitCard).not.toBeNull()
    await userEvent.click(within(habitCard as HTMLElement).getByRole('button', { name: i18n.labs.remove }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: i18n.labs.remove }))
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('habit-tracker'))

    await userEvent.click(screen.getByRole('button', { name: i18n.labs.restore }))
    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith('ai-digest'))
  })

  it('shows mind map as coming soon', () => {
    mockUseLabs.mockReturnValue({
      ready: true,
      catalog: [makeFeature('available', { featureKey: 'mind-map', title: 'Mind Map', premiumOnly: false, comingSoon: true })],
      subscription: { tier: 'premium', role: 'admin' },
      install: mockInstall,
      remove: mockRemove,
      restore: mockRestore,
    })

    renderPage()
    expect(screen.getAllByText(i18n.labs.comingSoon).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: i18n.labs.comingSoon })).toBeDisabled()
  })
})
