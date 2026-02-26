// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RssPage from './RssPage'

const mockPushToast = vi.fn()

const mockGetSources = vi.fn()
const mockGetSourceGroups = vi.fn()
const mockGetEntriesView = vi.fn()
const mockGetReadStates = vi.fn()
const mockRefreshAll = vi.fn()
const mockRefreshSource = vi.fn()
const mockMarkRead = vi.fn()
const mockAddSource = vi.fn()
const mockRemoveSource = vi.fn()
const mockRestoreSource = vi.fn()
const mockCreateGroup = vi.fn()
const mockRenameGroup = vi.fn()
const mockDeleteGroup = vi.fn()
const mockAssignGroup = vi.fn()
const mockStarSource = vi.fn()
const mockUnstarSource = vi.fn()

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
    removed: 'Remove',
    premiumLocked: 'Premium required',
    install: 'Install',
    openRss: 'Open RSS',
    remove: 'Remove',
    restore: 'Restore',
    upgrade: 'Upgrade',
    comingSoon: 'Coming soon',
    upgradeTitle: 'Upgrade',
    upgradeDesc: 'desc',
    upgradeConfirm: 'Confirm',
    cancel: 'Cancel',
    removeTitle: 'Remove RSS?',
    removeDesc: 'remove',
  },
  rss: {
    title: 'RSS Reader',
    subtitle: 'In-app feed view',
    back: 'Back to Dashboard',
    refresh: 'Refresh',
    stale: 'Showing cached data',
    staleHint: 'Last successful sync',
    retry: 'Retry refresh',
    emptyError: 'Failed to load feed and no cache is available yet.',
    sourceInputRoute: 'Route',
    sourceInputName: 'Display name',
    addSource: 'Add source',
    addSourceTitle: 'Add source',
    addSourceDesc: 'desc',
    removedSources: 'Removed sources',
    restore: 'Restore',
    noRemoved: 'No removed sources',
    noEntries: 'No entries yet',
    noSelection: 'Select an entry',
    read: 'Read',
    closeSummary: 'Close summary',
    openSummary: 'Open summary',
    favorites: 'Favorites',
    list: 'List',
    subscriptions: 'Subscriptions',
    newGroup: 'New group',
    renameGroup: 'Rename group',
    deleteGroup: 'Delete group',
    assignGroup: 'Assign group',
    ungrouped: 'Ungrouped',
    star: 'Star source',
    unstar: 'Unstar source',
    today: 'Today',
    yesterday: 'Yesterday',
    sourceCount: 'sources',
    removeSourceTitle: 'Remove source?',
    removeSourceDesc: 'The source moves to removed list and can be restored later.',
  },
  toast: {
    rssAccessDenied: 'denied',
    upgraded: 'upgraded',
    installed: 'installed',
    removed: 'removed',
    restored: 'restored',
    groupCreated: 'group created',
    groupRenamed: 'group renamed',
    groupDeleted: 'group deleted',
    sourceStarred: 'source starred',
    sourceUnstarred: 'source unstarred',
  },
}

vi.mock('../../labs/labsI18n', () => ({
  useLabsI18n: () => i18n,
}))

vi.mock('../rssModel', () => ({
  isCacheExpired: () => false,
  groupEntriesByDay: (entries: Array<{ publishedAt: number }>) => [
    {
      key: 'today',
      type: 'today',
      dateMs: Date.now(),
      entries,
    },
  ],
}))

vi.mock('../rssApi', () => ({
  RSS_TTL_MINUTES: 30,
  addSource: (...args: unknown[]) => mockAddSource(...args),
  assignSourceGroup: (...args: unknown[]) => mockAssignGroup(...args),
  createSourceGroup: (...args: unknown[]) => mockCreateGroup(...args),
  deleteSourceGroup: (...args: unknown[]) => mockDeleteGroup(...args),
  getEntriesView: (...args: unknown[]) => mockGetEntriesView(...args),
  getReadStates: (...args: unknown[]) => mockGetReadStates(...args),
  getSourceGroups: (...args: unknown[]) => mockGetSourceGroups(...args),
  getSources: (...args: unknown[]) => mockGetSources(...args),
  markEntriesAsRead: (...args: unknown[]) => mockMarkRead(...args),
  refreshAll: (...args: unknown[]) => mockRefreshAll(...args),
  refreshSource: (...args: unknown[]) => mockRefreshSource(...args),
  removeSource: (...args: unknown[]) => mockRemoveSource(...args),
  renameSourceGroup: (...args: unknown[]) => mockRenameGroup(...args),
  restoreSource: (...args: unknown[]) => mockRestoreSource(...args),
  starSource: (...args: unknown[]) => mockStarSource(...args),
  unstarSource: (...args: unknown[]) => mockUnstarSource(...args),
}))

const sourceA = {
  id: 'source-1',
  userId: 'local-user',
  route: '/github/trending/daily',
  displayName: 'GitHub Trending Daily',
  isPreset: true,
  enabled: true,
  groupId: null,
  starredAt: null,
  deletedAt: null,
  lastSuccessAt: Date.now(),
  lastEntryAt: Date.now(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const sourceB = {
  ...sourceA,
  id: 'source-2',
  route: '/producthunt/posts',
  displayName: 'Product Hunt',
  groupId: 'group-1',
}

const removedSource = {
  ...sourceA,
  id: 'source-3',
  route: '/removed/source',
  displayName: 'Removed Source',
  deletedAt: Date.now(),
  enabled: false,
}

const group1 = {
  id: 'group-1',
  userId: 'local-user',
  name: 'AI',
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const entryA = {
  id: 'entry-1',
  sourceId: 'source-1',
  route: sourceA.route,
  guidOrLink: 'post-1',
  title: 'Entry A',
  summary: 'Entry A summary',
  url: 'https://example.com/post-a',
  publishedAt: Date.now(),
  cachedAt: Date.now(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const entryB = {
  ...entryA,
  id: 'entry-2',
  sourceId: 'source-2',
  title: 'Entry B',
  summary: 'Entry B summary',
  url: 'https://example.com/post-b',
}

type TestSource = {
  id: string
  userId: string
  route: string
  displayName: string
  isPreset: boolean
  enabled: boolean
  groupId: string | null
  starredAt: number | null
  deletedAt: number | null
  lastSuccessAt: number
  lastEntryAt: number
  createdAt: number
  updatedAt: number
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <RssPage />
    </MemoryRouter>,
  )

describe('RssPage', () => {
  let sourcesState: TestSource[] = [sourceA, sourceB, removedSource]
  let groupsState = [group1]
  let entriesAll = [entryA, entryB]

  beforeEach(() => {
    sourcesState = [sourceA, sourceB, removedSource]
    groupsState = [group1]
    entriesAll = [entryA, entryB]

    mockPushToast.mockReset()
    mockGetSources.mockReset()
    mockGetSourceGroups.mockReset()
    mockGetEntriesView.mockReset()
    mockGetReadStates.mockReset()
    mockRefreshAll.mockReset()
    mockRefreshSource.mockReset()
    mockMarkRead.mockReset()
    mockAddSource.mockReset()
    mockRemoveSource.mockReset()
    mockRestoreSource.mockReset()
    mockCreateGroup.mockReset()
    mockRenameGroup.mockReset()
    mockDeleteGroup.mockReset()
    mockAssignGroup.mockReset()
    mockStarSource.mockReset()
    mockUnstarSource.mockReset()

    mockGetSources.mockImplementation((options?: { includeRemoved?: boolean; groupId?: string | null; onlyStarred?: boolean }) => {
      let list = sourcesState
      if (!options?.includeRemoved) list = list.filter((item) => !item.deletedAt)
      if (options?.onlyStarred) list = list.filter((item) => Boolean(item.starredAt))
      if (options?.groupId !== undefined) {
        list = options.groupId === null ? list.filter((item) => !item.groupId) : list.filter((item) => item.groupId === options.groupId)
      }
      return Promise.resolve(list)
    })

    mockGetSourceGroups.mockImplementation(() => Promise.resolve(groupsState))

    mockGetEntriesView.mockImplementation((scope?: { scope: string; sourceId?: string; groupId?: string | null }) => {
      if (!scope || scope.scope === 'all-active') return Promise.resolve(entriesAll)
      if (scope.scope === 'source') return Promise.resolve(entriesAll.filter((item) => item.sourceId === scope.sourceId))
      if (scope.scope === 'group') {
        const ids = sourcesState.filter((item) => item.groupId === scope.groupId && !item.deletedAt).map((item) => item.id)
        return Promise.resolve(entriesAll.filter((item) => ids.includes(item.sourceId)))
      }
      if (scope.scope === 'starred') {
        const ids = sourcesState.filter((item) => Boolean(item.starredAt) && !item.deletedAt).map((item) => item.id)
        return Promise.resolve(entriesAll.filter((item) => ids.includes(item.sourceId)))
      }
      return Promise.resolve([])
    })

    mockGetReadStates.mockResolvedValue([])
    mockRefreshAll.mockResolvedValue({ ok: true, stale: false })
    mockRefreshSource.mockResolvedValue({ ok: true, stale: false })
    mockMarkRead.mockResolvedValue([{ entryId: entryA.id, userId: 'local-user', readAt: Date.now() }])

    mockAddSource.mockImplementation(async ({ route, displayName }: { route: string; displayName: string }) => {
      const next = {
        ...sourceA,
        id: `source-${sourcesState.length + 1}`,
        route,
        displayName: displayName || route,
      }
      sourcesState = [...sourcesState, next]
      return next
    })

    mockCreateGroup.mockImplementation(async (name: string) => {
      groupsState = [...groupsState, { ...group1, id: `group-${groupsState.length + 1}`, name }]
      return groupsState.at(-1)
    })

    mockRenameGroup.mockImplementation(async (id: string, name: string) => {
      groupsState = groupsState.map((item) => (item.id === id ? { ...item, name } : item))
      return groupsState.find((item) => item.id === id)
    })

    mockDeleteGroup.mockImplementation(async (id: string) => {
      groupsState = groupsState.filter((item) => item.id !== id)
      sourcesState = sourcesState.map((item) => (item.groupId === id ? { ...item, groupId: null } : item))
    })

    mockRemoveSource.mockImplementation(async (id: string) => {
      sourcesState = sourcesState.map((item) => (item.id === id ? { ...item, deletedAt: Date.now(), enabled: false } : item))
    })

    mockRestoreSource.mockImplementation(async (id: string) => {
      sourcesState = sourcesState.map((item) => (item.id === id ? { ...item, deletedAt: null, enabled: true } : item))
    })

    mockStarSource.mockImplementation(async (id: string) => {
      sourcesState = sourcesState.map((item) => (item.id === id ? { ...item, starredAt: Date.now() } : item))
    })

    mockUnstarSource.mockImplementation(async (id: string) => {
      sourcesState = sourcesState.map((item) => (item.id === id ? { ...item, starredAt: null } : item))
    })

    mockAssignGroup.mockImplementation(async (id: string, groupId: string | null) => {
      sourcesState = sourcesState.map((item) => (item.id === id ? { ...item, groupId } : item))
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders left/middle/right layout and marks entry as read on click', async () => {
    renderPage()

    expect(await screen.findByText(i18n.rss.favorites)).toBeInTheDocument()
    expect(screen.getByText('Summary')).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /Entry A/i }))
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith([entryA.id]))
    expect(await screen.findByText(i18n.rss.read)).toBeInTheDocument()
  })

  it('adds source via dialog from left header plus button', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: i18n.rss.addSource }))
    await userEvent.type(screen.getByPlaceholderText(i18n.rss.sourceInputRoute), '/my/new/feed')
    await userEvent.type(screen.getByPlaceholderText(i18n.rss.sourceInputName), 'My Feed')

    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: i18n.rss.addSource }))
    await waitFor(() => expect(mockAddSource).toHaveBeenCalled())
  })

  it('switches to favorites scope and requests starred entries', async () => {
    sourcesState = sourcesState.map((item) => (item.id === 'source-2' ? { ...item, starredAt: Date.now() } : item))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /Favorites/i }))
    await waitFor(() => {
      expect(mockGetEntriesView).toHaveBeenLastCalledWith({ scope: 'starred' })
    })
  })

  it('supports create/rename/delete source group flow', async () => {
    renderPage()

    await userEvent.type(await screen.findByPlaceholderText(i18n.rss.newGroup), 'News')
    await userEvent.click(screen.getByRole('button', { name: i18n.rss.newGroup }))
    await waitFor(() => expect(mockCreateGroup).toHaveBeenCalledWith('News'))

    await userEvent.click(screen.getAllByRole('button', { name: i18n.rss.renameGroup })[0])
    const renameInput = await screen.findByDisplayValue('AI')
    await userEvent.clear(renameInput)
    await userEvent.type(renameInput, 'AI Updated')
    await userEvent.click(screen.getAllByRole('button', { name: i18n.rss.renameGroup })[0])
    await waitFor(() => expect(mockRenameGroup).toHaveBeenCalled())

    const deleteButtons = screen.getAllByRole('button', { name: i18n.rss.deleteGroup })
    await userEvent.click(deleteButtons[0])
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: i18n.rss.deleteGroup }))
    await waitFor(() => expect(mockDeleteGroup).toHaveBeenCalled())
  })

  it('restores source from removed fold section', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /Removed sources/i }))
    const restoreButtons = await screen.findAllByRole('button', { name: i18n.rss.restore })
    await userEvent.click(restoreButtons[0])
    await waitFor(() => expect(mockRestoreSource).toHaveBeenCalled())
  })

  it('shows stale banner and supports dismiss', async () => {
    const staleAt = Date.now() - 60_000
    mockRefreshAll.mockResolvedValue({ ok: true, stale: true, lastSuccessAt: staleAt })

    renderPage()
    await userEvent.click((await screen.findAllByRole('button', { name: i18n.rss.refresh }))[0])

    expect(await screen.findByText(new RegExp(i18n.rss.stale))).toBeInTheDocument()
    expect(screen.getByTitle(new Date(staleAt).toLocaleString())).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '×' }))
    await waitFor(() => expect(screen.queryByText(new RegExp(i18n.rss.stale))).not.toBeInTheDocument())
  })

  it('renders hard error empty state and allows retry', async () => {
    mockGetEntriesView.mockResolvedValue([])
    mockRefreshAll.mockResolvedValue({ ok: false, stale: false })

    renderPage()
    await userEvent.click((await screen.findAllByRole('button', { name: i18n.rss.refresh }))[0])
    expect(await screen.findByText(i18n.rss.emptyError)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: i18n.rss.retry }))
    expect(mockRefreshAll).toHaveBeenCalledTimes(2)
  })
})
