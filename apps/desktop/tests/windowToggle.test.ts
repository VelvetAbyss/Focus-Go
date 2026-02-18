import { describe, expect, it, vi } from 'vitest'
import { toggleWindowVisibility } from '../electron/native/windowToggle'

describe('toggleWindowVisibility', () => {
  it('hides the window when currently visible', () => {
    const target = {
      isVisible: vi.fn(() => true),
      hide: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
    }

    toggleWindowVisibility(target)

    expect(target.hide).toHaveBeenCalledTimes(1)
    expect(target.show).not.toHaveBeenCalled()
  })

  it('shows and focuses the window when currently hidden', () => {
    const target = {
      isVisible: vi.fn(() => false),
      hide: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
    }

    toggleWindowVisibility(target)

    expect(target.show).toHaveBeenCalledTimes(1)
    expect(target.focus).toHaveBeenCalledTimes(1)
  })
})
