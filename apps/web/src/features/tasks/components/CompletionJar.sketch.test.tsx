// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CompletionJar from './CompletionJar'
import type { JarShelf } from '../domain/completionJar'

const three = vi.hoisted(() => ({ mount: vi.fn(() => 'ready') }))
vi.mock('../../../shared/three/useThreeSurface', () => ({ useThreeSurface: three.mount }))
vi.mock('../../../shared/theme/useThemeMode', () => ({ useThemeMode: () => 'light' }))
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ language: 'en', t: (key: string) => key }) }))
const now = Date.now()
const shelf: JarShelf = {
  main: { key: '2026-10-05', startAt: now, endAt: now + 604800000, beads: [{ taskId: 'finished-task', completedAt: now }] },
  shelf: [{ key: '2026-09-28', startAt: now - 604800000, endAt: now, beads: [{ taskId: 'earlier-task', completedAt: now - 86400000 }] }],
}
beforeEach(() => {
  three.mount.mockClear()
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(120)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Lightweight completion history', () => {
  it('draws the actual completion beads without mounting a WebGL surface', () => {
    const { container } = render(<CompletionJar renderMode="sketch" shelf={shelf} isCurrentWeek onOpenWeek={vi.fn()} />)
    expect(container.querySelector('canvas')).toBeNull()
    expect(container.querySelectorAll('.recap-jar__sketch-bead')).toHaveLength(2)
    expect(three.mount).not.toHaveBeenCalled()
  })
  it('keeps earlier completed weeks navigable', () => {
    const onOpenWeek = vi.fn()
    render(<CompletionJar renderMode="sketch" shelf={shelf} isCurrentWeek onOpenWeek={onOpenWeek} />)
    fireEvent.click(screen.getByRole('button', { name: 'taskRecap.jar.openWeek' }))
    expect(onOpenWeek).toHaveBeenCalledWith(shelf.shelf[0].startAt)
  })
})
