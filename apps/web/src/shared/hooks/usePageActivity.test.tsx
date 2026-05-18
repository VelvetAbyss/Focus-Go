// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useVisibleInterval } from './usePageActivity'

const setVisibility = (visibilityState: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibilityState,
  })
}

const setFocused = (focused: boolean) => {
  Object.defineProperty(document, 'hasFocus', {
    configurable: true,
    value: () => focused,
  })
}

const Counter = ({ runOnVisible = false }: { runOnVisible?: boolean }) => {
  const tick = vi.fn()
  useVisibleInterval(tick, 1000, { runOnVisible })
  return <span data-testid="count">{tick.mock.calls.length}</span>
}

describe('useVisibleInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
    setFocused(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs while visible and pauses while hidden', () => {
    const tick = vi.fn()
    const Probe = () => {
      useVisibleInterval(tick, 1000)
      return null
    }
    render(<Probe />)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(tick).toHaveBeenCalledTimes(1)

    act(() => {
      setVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(tick).toHaveBeenCalledTimes(1)
  })

  it('can run once when the page becomes visible again', () => {
    const tick = vi.fn()
    const Probe = () => {
      useVisibleInterval(tick, 1000, { runOnVisible: true })
      return null
    }
    render(<Probe />)

    act(() => {
      setVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(tick).toHaveBeenCalledTimes(0)

    act(() => {
      setVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(tick).toHaveBeenCalledTimes(1)
  })

  it('treats an unfocused visible page as background', () => {
    render(<Counter />)

    act(() => {
      setFocused(false)
      window.dispatchEvent(new Event('blur'))
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })
})
