// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StartupGate from './StartupGate'
import { STORAGE_MODE_KEY } from '../data/storageMode'
const mocks = vi.hoisted(() => ({ bootstrap: vi.fn(), auth: vi.fn(), seed: vi.fn() }))
vi.mock('./authBootstrap', () => ({ bootstrapAuth: mocks.bootstrap }))
vi.mock('../store/auth', () => ({ getAuth: mocks.auth }))
vi.mock('../data/seed', () => ({ seedDatabase: mocks.seed }))
beforeEach(() => {
  mocks.bootstrap.mockReset()
  mocks.auth.mockReturnValue(null)
  mocks.seed.mockReset()
  mocks.seed.mockResolvedValue(false)
  localStorage.clear()
  // These cases all exercise cloud mode, where a session has to be restored.
  localStorage.setItem(STORAGE_MODE_KEY, 'cloud')
})
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
describe('storage mode', () => {
  it('asks a brand-new device where its data should live, before touching the network', () => {
    localStorage.removeItem(STORAGE_MODE_KEY)
    render(<StartupGate><div>Workspace</div></StartupGate>)
    expect(screen.getByRole('heading', { name: 'Where should your data live?' })).toBeDefined()
    expect(screen.queryByText('Workspace')).toBeNull()
    expect(mocks.bootstrap).not.toHaveBeenCalled()
  })
  it('opens the workspace in local mode without any session restore', async () => {
    localStorage.setItem(STORAGE_MODE_KEY, 'local')
    render(<StartupGate><div>Workspace</div></StartupGate>)
    expect(await screen.findByText('Workspace')).toBeDefined()
    expect(mocks.bootstrap).not.toHaveBeenCalled()
  })

  it('seeds the first-run workspace before revealing it to a local device', async () => {
    localStorage.setItem(STORAGE_MODE_KEY, 'local')
    let finishSeed!: (value: boolean) => void
    mocks.seed.mockReturnValue(new Promise<boolean>((done) => { finishSeed = done }))
    render(<StartupGate><div>Workspace</div></StartupGate>)
    // Nothing may mount while the seed is in flight: once the shell renders, its
    // own writes make the seeder think the workspace already has data.
    expect(screen.queryByText('Workspace')).toBeNull()
    await act(async () => finishSeed(true))
    expect(screen.getByText('Workspace')).toBeDefined()
  })

  it('still opens the workspace when seeding fails', async () => {
    localStorage.setItem(STORAGE_MODE_KEY, 'local')
    mocks.seed.mockRejectedValue(new Error('quota exceeded'))
    render(<StartupGate><div>Workspace</div></StartupGate>)
    expect(await screen.findByText('Workspace')).toBeDefined()
  })
  it('remembers the local choice and goes straight in', async () => {
    localStorage.removeItem(STORAGE_MODE_KEY)
    render(<StartupGate><div>Workspace</div></StartupGate>)
    fireEvent.click(screen.getByRole('button', { name: 'Start using it now' }))
    expect(localStorage.getItem(STORAGE_MODE_KEY)).toBe('local')
    expect(await screen.findByText('Workspace')).toBeDefined()
    expect(mocks.bootstrap).not.toHaveBeenCalled()
  })
  it('restores a session after the cloud choice', async () => {
    localStorage.removeItem(STORAGE_MODE_KEY)
    mocks.bootstrap.mockResolvedValue(true)
    render(<StartupGate><div>Workspace</div></StartupGate>)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in and sync' }))
    expect(localStorage.getItem(STORAGE_MODE_KEY)).toBe('cloud')
    expect(await screen.findByText('Workspace')).toBeDefined()
    expect(mocks.bootstrap).toHaveBeenCalled()
  })
})
