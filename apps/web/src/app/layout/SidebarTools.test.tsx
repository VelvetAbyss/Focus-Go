// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NOISE_SCENE_PRESETS } from '../../features/focus/noise'
import SidebarWhiteNoise from './SidebarWhiteNoise'
import SidebarFocusTimer from './SidebarFocusTimer'

const mocks = vi.hoisted(() => ({
  allowed: true,
  requireAuth: vi.fn((action: () => void) => action()),
  upgrade: vi.fn(),
  noise: { playing: false, masterVolume: 0.6, tracks: {} },
  setNoise: vi.fn(), toggleNoise: vi.fn(), setVolume: vi.fn(),
  timer: { durationMinutes: 25, remainingSeconds: 1500, running: false, status: 'idle' },
  start: vi.fn(), pause: vi.fn(), resume: vi.fn(), setDuration: vi.fn(),
}))
vi.mock('../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/focus/SharedNoiseProvider', () => ({
  useSharedNoise: () => ({ noise: mocks.noise, setNoise: mocks.setNoise, toggleNoisePlaying: mocks.toggleNoise, setNoiseMasterVolume: mocks.setVolume }),
}))
vi.mock('../../features/premium/PremiumProvider', () => ({ usePremiumGate: () => ({ canUse: () => ({ allowed: mocks.allowed }), openUpgradeModal: mocks.upgrade }) }))
vi.mock('../../features/auth/AuthGateContext', () => ({ useAuthGate: () => ({ requireAuth: mocks.requireAuth }) }))
vi.mock('./AmbientSettingsPopover', () => ({ default: () => <button>Background settings</button> }))
vi.mock('../../features/focus/useSharedFocusTimer', () => ({
  useSharedFocusTimer: () => ({ state: mocks.timer, start: mocks.start, pause: mocks.pause, resume: mocks.resume, setDuration: mocks.setDuration }),
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.allowed = true
  mocks.noise = { playing: false, masterVolume: 0.6, tracks: NOISE_SCENE_PRESETS[0].tracks }
  mocks.timer = { durationMinutes: 25, remainingSeconds: 1500, running: false, status: 'idle' }
})
afterEach(cleanup)

describe('sidebar tools', () => {
  it('keeps native volume control and scene reset behind the existing access gate', () => {
    render(<SidebarWhiteNoise collapsed={false} />)
    const volume = screen.getByRole('slider', { name: 'focus.volume' })
    expect(volume).toHaveAttribute('type', 'range')
    fireEvent.change(volume, { target: { value: '72' } })
    expect(mocks.requireAuth).toHaveBeenCalled()
    expect(mocks.setVolume).toHaveBeenCalledWith(.72)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    const tracks = mocks.setNoise.mock.calls[0][0].tracks
    expect(Object.values(tracks).every((track) => !(track as { enabled: boolean }).enabled)).toBe(true)
  })

  it('does not bypass unavailable sound controls and stays usable when collapsed', () => {
    mocks.allowed = false
    const view = render(<SidebarWhiteNoise collapsed={false} />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '80' } })
    expect(mocks.upgrade).toHaveBeenCalled()
    expect(mocks.setVolume).not.toHaveBeenCalled()
    view.rerender(<SidebarWhiteNoise collapsed />)
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.getByRole('button', { name: 'focus.playNoise' })).toBeVisible()
  })

  it('retains duration selection and start/pause/resume behavior in the new layout', () => {
    const view = render(<SidebarFocusTimer collapsed={false} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'focus.modes' }), { target: { value: 'deep-work' } })
    expect(mocks.setDuration).toHaveBeenCalledWith(50)
    fireEvent.click(screen.getByRole('button', { name: 'focus.startFocus' }))
    expect(mocks.start).toHaveBeenCalledWith(25)
    mocks.timer = { ...mocks.timer, running: true, status: 'running' }
    view.rerender(<SidebarFocusTimer collapsed />)
    fireEvent.click(screen.getByRole('button', { name: 'focus.pause' }))
    expect(mocks.pause).toHaveBeenCalledOnce()
    expect(screen.getByText('25:00')).toBeVisible()
    mocks.timer = { ...mocks.timer, running: false, status: 'paused' }
    view.rerender(<SidebarFocusTimer collapsed />)
    fireEvent.click(screen.getByRole('button', { name: 'focus.resume' }))
    expect(mocks.resume).toHaveBeenCalledOnce()
  })
})
