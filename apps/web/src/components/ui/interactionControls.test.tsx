// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Tabs, TabsList, TabsTrigger } from './tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Switch } from './switch'

const { play } = vi.hoisted(() => ({ play: vi.fn() }))
vi.mock('@/shared/sound/interactionSounds', () => ({ playInterfaceSound: play }))
beforeEach(() => {
  play.mockClear()
  Element.prototype.scrollIntoView = vi.fn()
})

const TabPair = ({ value }: { value?: string }) => (
  <Tabs defaultValue="a" value={value}>
    <TabsList><TabsTrigger value="a">First</TabsTrigger><TabsTrigger value="b">Second</TabsTrigger><TabsTrigger value="c" disabled>Disabled</TabsTrigger></TabsList>
  </Tabs>
)

describe('ordinary control feedback', () => {
  it('sounds a tab change once, but not mount, repeated selection, or disabled tabs', () => {
    render(<TabPair />)
    expect(play).not.toHaveBeenCalled()
    const second = screen.getByRole('tab', { name: 'Second' })
    fireEvent.mouseDown(second, { button: 0, ctrlKey: false })
    fireEvent.click(second)
    expect(second).toHaveAttribute('aria-selected', 'true')
    expect(play).toHaveBeenCalledTimes(1)
    fireEvent.mouseDown(second, { button: 0, ctrlKey: false })
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Disabled' }), { button: 0 })
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('keeps programmatic tab and switch updates silent', () => {
    const { rerender } = render(<><TabPair value="a" /><Switch checked={false} /></>)
    rerender(<><TabPair value="b" /><Switch checked /></>)
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(play).not.toHaveBeenCalled()
  })

  it('supports keyboard tab activation without a second click sound', () => {
    render(<TabPair />)
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Second' }), { key: 'Enter' })
    expect(play).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute('aria-selected', 'true')
  })

  it('sounds a new dropdown selection, not opening or selecting the current value', async () => {
    render(<Select defaultValue="a"><SelectTrigger aria-label="View"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a">First</SelectItem><SelectItem value="b">Second</SelectItem></SelectContent></Select>)
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(play).not.toHaveBeenCalled()
    await screen.findByRole('option', { name: 'Second' })
    fireEvent.keyDown(screen.getByRole('option', { name: 'Second' }), { key: 'Enter' })
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    fireEvent.keyDown(await screen.findByRole('option', { name: 'Second' }), { key: 'Enter' })
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('uses a quiet toggle cue and supports a silent control for the audio master switch', () => {
    const { rerender } = render(<Switch aria-label="Motion" />)
    fireEvent.click(screen.getByRole('switch'))
    expect(play).toHaveBeenCalledExactlyOnceWith('on')
    rerender(<Switch aria-label="Motion" sound={false} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(play).toHaveBeenCalledTimes(1)
  })
})
