// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StartupGate from './StartupGate'
const mocks = vi.hoisted(() => ({ bootstrap: vi.fn(), auth: vi.fn() }))
vi.mock('./authBootstrap', () => ({ bootstrapAuth: mocks.bootstrap }))
vi.mock('../store/auth', () => ({ getAuth: mocks.auth }))
beforeEach(() => { mocks.bootstrap.mockReset(); mocks.auth.mockReturnValue(null) })
describe('startup recovery', () => {
  it('renders a loading screen while session restoration is pending', async () => {
    let resolve!: (value: boolean) => void
    mocks.bootstrap.mockReturnValue(new Promise<boolean>((done) => { resolve = done }))
    render(<StartupGate><div>Private workspace</div></StartupGate>)
    expect(screen.queryByText('Private workspace')).toBeNull()
    expect(screen.getByRole('status')).toBeDefined()
    await act(async () => resolve(true))
    expect(screen.getByText('Private workspace')).toBeDefined()
  })
  it('offers retry without opening private data after a failed restore', async () => {
    mocks.bootstrap.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(true)
    render(<StartupGate><div>Workspace</div></StartupGate>)
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Workspace')).toBeDefined()
  })
  it('allows explicitly opening only the existing local account when offline', async () => {
    mocks.auth.mockReturnValue({ user: { id: 'a' } })
    mocks.bootstrap.mockRejectedValue(new Error('offline'))
    render(<StartupGate><div>Existing local data</div></StartupGate>)
    fireEvent.click(await screen.findByRole('button', { name: 'Open existing local workspace' }))
    expect(screen.getByText('Existing local data')).toBeDefined()
    expect(screen.getByRole('status').textContent).toContain('Cloud session unavailable')
  })
})
