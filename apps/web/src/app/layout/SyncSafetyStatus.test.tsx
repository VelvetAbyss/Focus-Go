// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SyncSafetyStatus from './SyncSafetyStatus'
const mock = vi.hoisted(() => ({ pending: 0, confirmed: null as number | null, failed: false, online: true, status: 'idle', enabled: true, now: 120000, account: 'a', blobPending: false }))
vi.mock('../../store/auth', () => ({ useIsLoggedIn: () => true, getAuth: () => ({ user: { id: 'a' } }) }))
vi.mock('../../data/sync/service', () => ({ useSyncActions: () => ({ enabled: mock.enabled, syncNow: vi.fn() }) }))
vi.mock('../../data/sync/useSyncSafety', () => ({ useSyncSafety: () => ({
  failed: mock.failed, online: mock.online, now: mock.now,
  safety: { pendingCount: mock.pending, oldestPendingAt: mock.pending ? 1 : null, conflictCount: 0,
    state: { status: mock.status, lastCloudConfirmedAt: mock.confirmed, cloudConfirmedAccountId: mock.account, pendingBlobPush: mock.blobPending } },
}) }))
vi.mock('../../shared/i18n/useI18n', () => ({ useI18n: () => ({ language: 'zh' }) }))
afterEach(() => { cleanup(); mock.pending = 0; mock.confirmed = null; mock.failed = false; mock.online = true; mock.enabled = true; mock.status = 'idle'; mock.account = 'a'; mock.blobPending = false })
const show = () => render(<MemoryRouter><SyncSafetyStatus /></MemoryRouter>)
describe('truthful save status', () => {
  it('does not call an empty outbox cloud confirmed', () => {
    show(); expect(screen.getByRole('status').textContent).toContain('尚未获得云端确认')
  })
  it('keeps warning and count visible when sync is disabled and offline', () => {
    mock.pending = 3; mock.enabled = false; mock.online = false; mock.confirmed = 1
    show(); expect(screen.getByRole('alert').textContent).toContain('待上传 3 项')
    expect(screen.queryByText('云端已确认')).toBeNull()
    expect(screen.queryByRole('button', { name: '重试上传' })).toBeNull()
  })
  it('does not claim a save succeeded when storage inspection failed', () => {
    mock.failed = true; mock.confirmed = 1
    show(); expect(screen.getByRole('alert').textContent).toContain('保存状态待核对')
    expect(screen.queryByText('云端已确认')).toBeNull()
  })
  it('shows a confirmed time only after a successful cloud cycle', () => {
    mock.confirmed = 10000
    show(); expect(screen.getByRole('status').textContent).toContain('云端已确认')
  })
  it('does not reuse another account’s confirmation', () => {
    mock.confirmed = 10000; mock.account = 'other-account'
    show(); expect(screen.getByRole('status').textContent).toContain('尚未获得云端确认')
  })
  it('waits for attachments before showing cloud confirmation', () => {
    mock.confirmed = 10000; mock.blobPending = true
    show(); expect(screen.getByRole('status').textContent).toContain('尚未获得云端确认')
  })
  it('opens details on demand and offers the backup route', () => {
    mock.pending = 2
    show()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByTestId('sync-status-trigger'))
    expect(screen.getByRole('dialog').textContent).toContain('待上传 2 项')
    expect(screen.getByRole('link', { name: '同步与备份' }).getAttribute('href')).toBe('/workspace/settings?section=data')
  })
  it('animates only while an online sync is actually running', () => {
    mock.status = 'syncing'
    show()
    expect(screen.getByTestId('sync-status-trigger').querySelector('.sidebar-sync__spinner')).toBeTruthy()
    expect(screen.getByRole('status').textContent).not.toContain('云端已确认')
  })
  it('exposes retry for a failed pre-replication cycle even with an empty queue', () => {
    mock.status = 'error'; mock.confirmed = 10000
    show(); fireEvent.click(screen.getByTestId('sync-status-trigger')); expect(screen.getByRole('button', { name: '重试上传' })).toBeTruthy()
    expect(screen.queryByText('云端已确认')).toBeNull()
  })
})
