// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
const { requireAuth } = vi.hoisted(() => ({ requireAuth: vi.fn() }))
vi.mock('../../features/auth/AuthGateContext', () => ({ useAuthGate: () => ({ isGated: true, requireAuth }) }))
vi.mock('../sound/interactionSounds', () => ({ playInterfaceSound: vi.fn() }))
import AuthInteractionGate from '../../features/auth/AuthInteractionGate'
import AnonymousCountsSetting from './AnonymousCountsSetting'
import { setAnonymousCountsEnabled } from './anonymousCounts'
afterEach(() => { cleanup(); requireAuth.mockClear() })
describe('anonymous opt-out with production guest gating active', () => {
  it.each(['en', 'zh'])('lets a signed-out visitor opt out in %s without unlocking other actions', language => {
    setAnonymousCountsEnabled(true)
    const privateAction = vi.fn()
    render(<AuthInteractionGate><AnonymousCountsSetting language={language} /><button onClick={privateAction}>Private action</button></AuthInteractionGate>)
    const control = screen.getByRole('switch')
    expect(control).toBeChecked()
    fireEvent.pointerDown(control); fireEvent.click(control)
    expect(control).not.toBeChecked()
    expect(localStorage.getItem('focusgo.anonymous-counts.enabled')).toBe('false')
    expect(requireAuth).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Private action'))
    expect(requireAuth).toHaveBeenCalledTimes(1)
    expect(privateAction).not.toHaveBeenCalled()
  })
})
