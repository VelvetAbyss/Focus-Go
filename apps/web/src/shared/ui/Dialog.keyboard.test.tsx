// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Dialog from './Dialog'

afterEach(cleanup)

describe('Dialog keyboard scope', () => {
  it('closes only the upper dialog on Escape', async () => {
    const outer = vi.fn(), inner = vi.fn()
    render(<><Dialog open title="Outer" onClose={outer}>outer</Dialog><Dialog open title="Inner" onClose={inner}>inner</Dialog></>)
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(2))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
  })

  it('does not close for Escape owned by composition or an inner control', async () => {
    const close = vi.fn()
    render(<Dialog open title="Input" onClose={close}><input aria-label="Title" /></Dialog>)
    await screen.findByRole('dialog')
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape', isComposing: true })
    expect(close).not.toHaveBeenCalled()
    const handled = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    handled.preventDefault()
    window.dispatchEvent(handled)
    expect(close).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
  })
})
