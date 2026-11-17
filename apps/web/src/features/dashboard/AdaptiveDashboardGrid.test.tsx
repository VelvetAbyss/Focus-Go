// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useEffect, useState } from 'react'
import AdaptiveDashboardGrid from './AdaptiveDashboardGrid'
import { useWidgetSummary } from './widgetPresentation'
vi.mock('../../shared/i18n/useI18n', () => ({ useI18n: () => ({ language: 'en' }) }))
let resize: ResizeObserverCallback
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { constructor(callback: ResizeObserverCallback) { resize = callback } observe() {} disconnect() {} unobserve() {} }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const measure = (width: number, height: number) => act(() => resize([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver))
it('keeps one component and its draft while expanding, closing, and resizing', async () => {
  const mount = vi.fn()
  function DraftWidget() {
    const [draft, setDraft] = useState('')
    useEffect(() => { mount() }, [])
    useWidgetSummary({ value: draft || 'Ready' })
    return <input aria-label="Widget draft" value={draft} onChange={event => setDraft(event.target.value)} />
  }
  const cards = [{ id: 'tasks', title: 'Tasks', defaultSize: { w: 12, h: 4 }, render: () => <DraftWidget /> }]
  render(<AdaptiveDashboardGrid layout={[{ key: 'tasks', x: 0, y: 0, w: 12, h: 4 }]} cards={cards} columns={12} label="Focus widgets" />)
  measure(390, 600)
  fireEvent.click(await screen.findByRole('button', { name: 'Open Tasks' }))
  const input = await screen.findByRole('textbox', { name: 'Widget draft' })
  fireEvent.change(input, { target: { value: 'A draft survives' } })
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  fireEvent.click(screen.getByRole('button', { name: 'Open Tasks' }))
  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  expect(screen.getByRole('textbox', { name: 'Widget draft' })).toBe(input)
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByText('A draft survives')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Open Tasks' })).toHaveFocus()
  measure(0, 0)
  measure(1400, 600)
  expect(screen.getByRole('textbox', { name: 'Widget draft' })).toBe(input)
  expect(input).toHaveValue('A draft survives')
  measure(390, 600)
  fireEvent.click(screen.getByRole('button', { name: 'Open Tasks' }))
  expect(await screen.findByRole('textbox', { name: 'Widget draft' })).toBe(input)
  expect(mount).toHaveBeenCalledTimes(1)
})
