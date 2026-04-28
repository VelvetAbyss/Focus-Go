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

    await waitFor(() => expect(screen.getByText('No stories yet')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('刷新失败')).toBeInTheDocument())
  })

  it('persists source preferences when sources are toggled', async () => {
    fetchApiMock.mockImplementation((path: string) => {
      if (path === '/news/sources') return Promise.resolve(jsonResponse({ sources }))
      return Promise.resolve(jsonResponse({ status: 'success', id: 'zhihu', updatedTime: 1000, items: [] }))
    })

    render(<NewsDashboard />)

    fireEvent.click(await screen.findByRole('button', { name: /来源/ }))
    const manager = screen.getByLabelText('Manage news sources')
    fireEvent.click(within(manager).getByRole('button', { name: /GitHub/ }))

    const stored = JSON.parse(window.localStorage.getItem('focusgo.news.preferences.v1') ?? '{}')
    expect(stored.enabledSourceIds).not.toContain('github')
  })
})
