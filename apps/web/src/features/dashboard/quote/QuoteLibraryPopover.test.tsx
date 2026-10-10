// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastContext, type ToastPushArgs } from '../../../shared/ui/toast/toast'
import QuoteLibraryPopover from './QuoteLibraryPopover'
import { readQuoteState, writeQuoteState } from './quoteStorage'
import { useQuoteState } from './useQuoteState'

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
  }),
}))

vi.mock('../../../data/repositories/syncedPreferencesRepo', () => ({
  SYNCED_PREFERENCES_UPDATED_EVENT: 'focusgo:synced-preferences-updated',
  syncedPreferencesRepo: { persistFromLocal: vi.fn(async () => undefined) },
}))

const toasts: ToastPushArgs[] = []

const Harness = ({ onAdded = vi.fn() }: { onAdded?: (index: number, count: number) => void }) => {
  const state = useQuoteState()
  return (
    <ToastContext.Provider value={{ push: (args) => toasts.push(args) }}>
      <QuoteLibraryPopover state={state} onAdded={onAdded} />
    </ToastContext.Provider>
  )
}

const open = () => fireEvent.click(screen.getByRole('button', { name: 'dashboard.quote.open' }))
const input = () => screen.getByRole('textbox', { name: 'dashboard.quote.compose' })

beforeEach(() => {
  window.localStorage.clear()
  toasts.length = 0
})

afterEach(cleanup)

describe('QuoteLibraryPopover', () => {
  it('adds a line on Enter, switches to your lines and asks the header to show it', () => {
    const onAdded = vi.fn()
    render(<Harness onAdded={onAdded} />)
    open()

    fireEvent.change(input(), { target: { value: '“先做十分钟，再决定要不要停。”' } })
    fireEvent.keyDown(input(), { key: 'Enter' })

    const state = readQuoteState()
    expect(state.library).toBe('mine')
    expect(state.mine.map((line) => line.text)).toEqual(['先做十分钟，再决定要不要停。'])
    expect(onAdded).toHaveBeenCalledWith(0, 1)
    expect(input()).toHaveValue('')
    expect(screen.getByText('先做十分钟，再决定要不要停。')).toBeInTheDocument()
  })

  it('leaves Enter to the IME while it is composing', () => {
    render(<Harness />)
    open()
    fireEvent.change(input(), { target: { value: 'xian zuo' } })
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true })
    expect(readQuoteState().mine).toEqual([])
  })

  it('switches the library without closing', () => {
    writeQuoteState({ library: 'mine', mine: [{ id: 'a', text: '慢一点也没关系。', addedAt: 1 }] })
    render(<Harness />)
    open()

    const library = screen.getByRole('button', { name: /dashboard\.quote\.library\.default/ })
    expect(library).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(library)
    expect(readQuoteState().library).toBe('default')
    expect(library).toHaveAttribute('aria-pressed', 'true')
    expect(input()).toBeInTheDocument()
  })

  it('deletes a line with an undo that puts it back where it was', () => {
    writeQuoteState({
      library: 'mine',
      mine: [
        { id: 'a', text: '第一句', addedAt: 1 },
        { id: 'b', text: '第二句', addedAt: 2 },
        { id: 'c', text: '第三句', addedAt: 3 },
      ],
    })
    render(<Harness />)
    open()

    // The list shows the newest first: 第三句, 第二句, 第一句.
    fireEvent.click(screen.getAllByRole('button', { name: 'dashboard.quote.remove' })[1])
    expect(readQuoteState().mine.map((line) => line.id)).toEqual(['a', 'c'])
    expect(toasts).toHaveLength(1)

    act(() => toasts[0].onAction?.())
    expect(readQuoteState().mine.map((line) => line.id)).toEqual(['a', 'b', 'c'])
  })
})
