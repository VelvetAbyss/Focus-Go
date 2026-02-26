// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest'
import LabsPage from './LabsPage'
import type { FeatureCatalogItem } from '../labsApi'

const mockNavigate = vi.fn()
const mockPushToast = vi.fn()
const mockInstall = vi.fn(async () => undefined)
const mockRemove = vi.fn(async () => undefined)
const mockRestore = vi.fn(async () => undefined)
const mockUpgrade = vi.fn(async () => undefined)

const mockUseLabs = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../LabsContext', () => ({
  useLabs: () => mockUseLabs(),
}))

vi.mock('../../../shared/ui/toast/toast', () => ({
  useToast: () => ({ push: mockPushToast }),
}))

const i18n = {
  nav: {
    dashboard: 'Dashboard',
    rss: 'RSS',
    tasks: 'Tasks',
    calendar: 'Calendar',
    focus: 'Focus',
    notes: 'Notes',
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
    openRss: 'Open RSS',
    remove: 'Remove',
    restore: 'Restore',
    upgrade: 'Upgrade to Premium',
    comingSoon: 'Coming soon',
    upgradeTitle: 'Upgrade to Premium?',
    upgradeDesc: 'desc',
    upgradeConfirm: 'Activate mock Premium',
    cancel: 'Cancel',
    removeTitle: 'Remove RSS?',
    removeDesc: 'remove desc',
  },
  rss: {
    title: 'RSS Reader',
    subtitle: 'rss subtitle',
    back: 'Back',
    refresh: 'Refresh',
    stale: 'stale',
    staleHint: 'hint',
    retry: 'Retry',
    emptyError: 'empty',
    sourceInputRoute: 'route',
    sourceInputName: 'name',
    addSource: 'Add source',
    removedSources: 'Removed sources',
    restore: 'Restore',
    noRemoved: 'No removed',
    noEntries: 'No entries',
    noSelection: 'No selection',
    read: 'Read',
    closeSummary: 'Close summary',
    openSummary: 'Open summary',
  },
  toast: {
    rssAccessDenied: 'denied',
    upgraded: 'upgraded',
    installed: 'installed',
    removed: 'removed',
    restored: 'restored',
  },
}

vi.mock('../labsI18n', () => ({
  useLabsI18n: () => i18n,
}))

const makeFeature = (state: FeatureCatalogItem['state'], overrides: Partial<FeatureCatalogItem> = {}): FeatureCatalogItem => ({
  featureKey: 'rss',
  title: 'RSS Reader',
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
    mockNavigate.mockReset()
    mockPushToast.mockReset()
    mockInstall.mockClear()
    mockRemove.mockClear()
    mockRestore.mockClear()
    mockUpgrade.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('installs RSS and redirects to /rss', async () => {
    mockUseLabs.mockReturnValue({
      ready: true,
      catalog: [makeFeature('available')],
      subscription: { tier: 'premium' },
      install: mockInstall,
      remove: mockRemove,
      restore: mockRestore,
      upgradeMock: mockUpgrade,
    })

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: i18n.labs.install }))

    await waitFor(() => expect(mockInstall).toHaveBeenCalledWith('rss'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/rss'))
  })

  it('shows upgrade dialog for free user', async () => {
    mockUseLabs.mockReturnValue({
      ready: true,
      catalog: [makeFeature('available', { requiresPremium: true })],
      subscription: { tier: 'free' },
      install: mockInstall,
      remove: mockRemove,
      restore: mockRestore,
      upgradeMock: mockUpgrade,
    })

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: i18n.labs.upgrade }))
    expect(await screen.findByText(i18n.labs.upgradeTitle)).toBeInTheDocument()
  })

  it('removes and restores RSS with confirm flow', async () => {
    mockUseLabs.mockReturnValue({
      ready: true,
      catalog: [makeFeature('installed'), makeFeature('removed', { featureKey: 'ai-digest', title: 'AI Digest' })],
      subscription: { tier: 'premium' },
      install: mockInstall,
      remove: mockRemove,
      restore: mockRestore,
      upgradeMock: mockUpgrade,
    })

    renderPage()

    const rssCard = screen.getByText('RSS Reader').closest('.rounded-xl')
    expect(rssCard).not.toBeNull()
    await userEvent.click(within(rssCard as HTMLElement).getByRole('button', { name: i18n.labs.remove }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: i18n.labs.remove }))
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('rss'))

    await userEvent.click(screen.getByRole('button', { name: i18n.labs.restore }))
    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith('ai-digest'))
  })
})
