// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
const auth = vi.hoisted(() => ({ owner: 'owner-a', listeners: new Set<() => void>() }))
vi.mock('../../store/auth', () => ({
 getAuth: () => ({ user: { id: auth.owner } }),
 subscribeAuth: (listener: () => void) => { auth.listeners.add(listener); return () => auth.listeners.delete(listener) },
}))
vi.mock('./storage', () => ({ querySymbolicState: vi.fn(), migrateSymbolicRecords: vi.fn() }))
vi.mock('./sync', () => ({
 symbolicNow: (owner: string) => new Date(owner === 'owner-a' ? '2026-10-12T15:59:00Z' : '2026-10-12T16:01:00Z'),
 getSymbolicSyncStatus: vi.fn(), startSymbolicSync: vi.fn(), subscribeSymbolicSync: vi.fn(),
}))
import { useSymbolicNow } from './useSymbolic'
afterEach(() => { cleanup(); auth.owner = 'owner-a' })
it('switches immediately to the new account clock without waiting for a timer or focus event', () => {
 const { result } = renderHook(useSymbolicNow)
 expect(result.current.toISOString()).toBe('2026-10-12T15:59:00.000Z')
 act(() => { auth.owner = 'owner-b'; auth.listeners.forEach(listener => listener()) })
 expect(result.current.toISOString()).toBe('2026-10-12T16:01:00.000Z')
})
