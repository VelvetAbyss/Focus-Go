// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NewsDashboard from './NewsDashboard'

const fetchApiMock = vi.fn()

vi.mock('../../shared/apiBase', () => ({
  fetchApi: (...args: unknown[]) => fetchApiMock(...args),
}))

const sources = [
  { id: 'zhihu', name: '知乎', category: 'hot', type: 'hottest', interval: 600000, home: 'https://zhihu.com', accent: '#3A3733' },
  { id: 'github', name: 'GitHub', category: 'tech', type: 'hottest', interval: 600000, home: 'https://github.com/trending', accent: '#3A3733' },
]

const jsonResponse = (payload: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => payload,
  text: async () => JSON.stringify(payload),
})

const pending = () => new Promise<never>(() => {})

describe('NewsDashboard', () => {
  beforeEach(() => {
    window.localStorage.clear()
    fetchApiMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders successful source stories as external links', async () => {
    fetchApiMock.mockImplementation((path: string) => {
      if (path === '/news/sources') return Promise.resolve(jsonResponse({ sources }))
      if (path.includes('id=zhihu')) {
        return Promise.resolve(jsonResponse({
          status: 'success',
          id: 'zhihu',
          updatedTime: 1000,
          items: [{ id: '1', title: '第一条新闻', url: 'https://example.com/1', extra: { info: '100 万热度' } }],
        }))
      }
      return Promise.resolve(jsonResponse({ status: 'success', id: 'github', updatedTime: 1000, items: [] }))
    })

    render(<NewsDashboard />)

    const link = await screen.findByRole('link', { name: /第一条新闻/ })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows empty and error states per source', async () => {
    fetchApiMock.mockImplementation((path: string) => {
      if (path === '/news/sources') return Promise.resolve(jsonResponse({ sources }))
      if (path.includes('id=zhihu')) return Promise.resolve(jsonResponse({ status: 'success', id: 'zhihu', updatedTime: 1000, items: [] }))
      return Promise.resolve(jsonResponse({ error: 'bad' }, false, 500))
    })

    render(<NewsDashboard />)

    await waitFor(() => expect(screen.getByText('暂无来源')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('暂时无法加载')).toBeInTheDocument())
  })

  it('shows a loading animation instead of empty state while source stories are loading', async () => {
    fetchApiMock.mockImplementation((path: string) => {
      if (path === '/news/sources') return Promise.resolve(jsonResponse({ sources }))
      if (path.includes('id=zhihu')) return pending()
      if (path.includes('id=github')) return pending()
      return pending()
    })

    render(<NewsDashboard />)

    expect(await screen.findByText('知乎')).toBeInTheDocument()
    expect(screen.getAllByRole('status', { name: '正在加载新闻' })).toHaveLength(2)
    expect(screen.queryByText('暂无来源')).not.toBeInTheDocument()
  })

  it('shows the shared page loading state while the source list is still loading', async () => {
    fetchApiMock.mockImplementation((path: string) => {
      if (path === '/news/sources') return pending()
      return pending()
    })

    render(<NewsDashboard />)

    expect(await screen.findByTestId('news-source-loader')).toBeInTheDocument()
    expect(screen.getByText('Loading')).toBeInTheDocument()
    expect(screen.queryByText('暂无来源')).not.toBeInTheDocument()
  })

  it('keeps source loading active after a stale source-list request is aborted', async () => {
    fetchApiMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path !== '/news/sources') return pending()
      const signal = init?.signal
      return new Promise((resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        })
        setTimeout(() => resolve(jsonResponse({ sources })), 40)
      })
    })

    const { unmount } = render(<NewsDashboard />)
    unmount()
    render(<NewsDashboard />)

    expect(await screen.findByTestId('news-source-loader')).toBeInTheDocument()
    expect(screen.queryByText('暂无来源')).not.toBeInTheDocument()
    expect(await screen.findByText('知乎')).toBeInTheDocument()
  })

  it('persists source preferences when sources are toggled', async () => {
    fetchApiMock.mockImplementation((path: string) => {
      if (path === '/news/sources') return Promise.resolve(jsonResponse({ sources }))
      return Promise.resolve(jsonResponse({ status: 'success', id: 'zhihu', updatedTime: 1000, items: [] }))
    })

    render(<NewsDashboard />)

    const [sourceManagerButton] = await screen.findAllByRole('button', { name: '管理来源' })
    fireEvent.click(sourceManagerButton)
    const manager = screen.getByLabelText('Manage news sources')
    fireEvent.click(within(manager).getByRole('button', { name: /GitHub/ }))

    const stored = JSON.parse(window.localStorage.getItem('focusgo.news.preferences.v1') ?? '{}')
    expect(stored.enabledSourceIds).not.toContain('github')
  })
})
