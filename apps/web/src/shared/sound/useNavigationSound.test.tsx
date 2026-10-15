// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNavigationSound } from './useNavigationSound'

const { play } = vi.hoisted(() => ({ play: vi.fn() }))
vi.mock('./interactionSounds', () => ({ playInterfaceSound: play }))
beforeEach(() => play.mockClear())

function Link({ to, dragging = false, cancel = false, target }: { to: string; dragging?: boolean; cancel?: boolean; target?: string }) {
  const sound = useNavigationSound(to)
  return <a href={to} target={target} onClick={(event) => {
    if (cancel) event.preventDefault()
    sound(event, dragging)
    event.preventDefault()
  }}>Destination</a>
}
const mount = (from: string, props: Parameters<typeof Link>[0]) => render(<MemoryRouter initialEntries={[from]}><Link {...props} /></MemoryRouter>)

describe('navigation sound guards', () => {
  it.each([
    ['/tasks', '/focus'], ['/tasks?task=123', '/tasks'], ['/projects/123', '/projects'], ['/tasks#details', '/tasks'],
  ])('sounds navigation from %s to %s', (from, to) => {
    mount(from, { to })
    expect(play).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('link'))
    expect(play).toHaveBeenCalledTimes(1)
  })
  it('keeps an unchanged destination silent', () => {
    mount('/tasks', { to: '/tasks' })
    fireEvent.click(screen.getByRole('link'))
    expect(play).not.toHaveBeenCalled()
  })
  it.each([{ dragging: true }, { cancel: true }, { target: '_blank' }])('keeps non-navigation actions silent: %j', (options) => {
    mount('/tasks', { to: '/focus', ...options })
    fireEvent.click(screen.getByRole('link'))
    expect(play).not.toHaveBeenCalled()
  })
  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])('ignores modified clicks: %j', (options) => {
    mount('/tasks', { to: '/focus' })
    fireEvent.click(screen.getByRole('link'), options)
    expect(play).not.toHaveBeenCalled()
  })
})
