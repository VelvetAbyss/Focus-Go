import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { fetchApi } from '../../../shared/apiBase'
import { getAuth, useIsAdmin } from '../../../store/auth'
import { ROUTES } from '../../../app/routes/routes'
import '../admin.css'

// ── Types ──────────────────────────────────────────────────────────────────

type SyncByType = Record<string, { count: number; bytes: number }>

type AdminUser = {
  id: number
  email: string | null
  plan: string
  status: string
  createdAt: string
  premiumExpiresAt: string | null
  lastActiveAt: string | null
  active7d: boolean
  active30d: boolean
  syncRecordCount: number
  syncPayloadBytes: number
  syncByType: SyncByType
}

type AdminOverview = {
  totals: {
    totalUsers: number
    premiumUsers: number
    active7dCount: number
    active30dCount: number
  }
  users: AdminUser[]
  syncTotals: {
    grandTotalPayloadBytes: number
    blobCount: number
    blobTotalBytes: number
  }
  server: {
    uptimeSeconds: number
    loadAvg1: number
    loadAvg5: number
    loadAvg15: number
    totalMemBytes: number
    freeMemBytes: number
    usedMemBytes: number
    processRssBytes: number
    dbFileSizeBytes: number | null
  }
}

// ── Formatting helpers ─────────────────────────────────────────────────────

const fmtBytes = (bytes: number | null | undefined): string => {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const fmtUptime = (seconds: number): string => {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

const fmtPct = (used: number, total: number): string => {
  if (!total) return '0%'
  return `${((used / total) * 100).toFixed(1)}%`
}

// ── KPI Card ───────────────────────────────────────────────────────────────

const KpiCard = ({ label, value }: { label: string; value: string | number }) => (
  <div className="admin-kpi">
    <span className="admin-kpi__value">{value}</span>
    <span className="admin-kpi__label">{label}</span>
  </div>
)

// ── Section header ─────────────────────────────────────────────────────────

const SectionHeader = ({ title }: { title: string }) => (
  <h2 className="admin-section-header">{title}</h2>
)

// ── Server card ────────────────────────────────────────────────────────────

const ServerCard = ({ server }: { server: AdminOverview['server'] }) => (
  <div className="admin-server-grid">
    <div className="admin-server-item">
      <span className="admin-server-item__label">Uptime</span>
      <span className="admin-server-item__value">{fmtUptime(server.uptimeSeconds)}</span>
    </div>
    <div className="admin-server-item">
      <span className="admin-server-item__label">Load avg (1/5/15m)</span>
      <span className="admin-server-item__value">
        {server.loadAvg1.toFixed(2)} / {server.loadAvg5.toFixed(2)} / {server.loadAvg15.toFixed(2)}
      </span>
    </div>
    <div className="admin-server-item">
      <span className="admin-server-item__label">Memory</span>
      <span className="admin-server-item__value">
        {fmtBytes(server.usedMemBytes)} / {fmtBytes(server.totalMemBytes)} ({fmtPct(server.usedMemBytes, server.totalMemBytes)})
      </span>
    </div>
    <div className="admin-server-item">
      <span className="admin-server-item__label">Process RSS</span>
      <span className="admin-server-item__value">{fmtBytes(server.processRssBytes)}</span>
    </div>
    <div className="admin-server-item">
      <span className="admin-server-item__label">DB file size</span>
      <span className="admin-server-item__value">{fmtBytes(server.dbFileSizeBytes)}</span>
    </div>
  </div>
)

// ── User table ─────────────────────────────────────────────────────────────

const UserTable = ({ users }: { users: AdminUser[] }) => (
  <div className="admin-table-wrap">
    <table className="admin-table">
      <thead>
        <tr>
          <th>Email</th>
          <th>Plan</th>
          <th>Status</th>
          <th>Joined</th>
          <th>Last active</th>
          <th>7d</th>
          <th>30d</th>
          <th>Records</th>
          <th>Sync size</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id}>
            <td className="admin-table__email">{u.email ?? '—'}</td>
            <td>
              <span className={`admin-badge admin-badge--${u.plan}`}>{u.plan}</span>
            </td>
            <td>{u.status}</td>
            <td>{fmtDate(u.createdAt)}</td>
            <td>{fmtDate(u.lastActiveAt)}</td>
            <td className={u.active7d ? 'admin-table__active' : 'admin-table__inactive'}>{u.active7d ? '✓' : '—'}</td>
            <td className={u.active30d ? 'admin-table__active' : 'admin-table__inactive'}>{u.active30d ? '✓' : '—'}</td>
            <td>{u.syncRecordCount.toLocaleString()}</td>
            <td>{fmtBytes(u.syncPayloadBytes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// ── Main page ──────────────────────────────────────────────────────────────

const AdminPage = () => {
  const isAdmin = useIsAdmin()
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!isAdmin) return
    const auth = getAuth()
    const headers: HeadersInit = auth?.accessToken
      ? { Authorization: `Bearer ${auth.accessToken}` }
      : {}
    setLoading(true)
    setError(null)
    fetchApi('/admin/overview', { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<AdminOverview>
      })
      .then((d) => { setData(d); setLoading(false) })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
      })
  }, [isAdmin, tick])

  if (!isAdmin) return <Navigate to={ROUTES.DASHBOARD} replace />

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1 className="admin-page__title">Admin</h1>
        <button
          type="button"
          className="admin-page__refresh"
          disabled={loading}
          onClick={() => setTick((n) => n + 1)}
        >
          Refresh
        </button>
      </header>

      {loading && <div className="admin-page__state">Loading…</div>}
      {error && <div className="admin-page__state admin-page__state--error">Error: {error}</div>}

      {data && (
        <>
          <section className="admin-section">
            <SectionHeader title="Overview" />
            <div className="admin-kpi-row">
              <KpiCard label="Total users" value={data.totals.totalUsers} />
              <KpiCard label="Premium" value={data.totals.premiumUsers} />
              <KpiCard label="Active 7d" value={data.totals.active7dCount} />
              <KpiCard label="Active 30d" value={data.totals.active30dCount} />
              <KpiCard label="Sync payload" value={fmtBytes(data.syncTotals.grandTotalPayloadBytes)} />
              <KpiCard label="Blobs" value={`${data.syncTotals.blobCount} (${fmtBytes(data.syncTotals.blobTotalBytes)})`} />
              <KpiCard label="DB size" value={fmtBytes(data.server.dbFileSizeBytes)} />
            </div>
          </section>

          <section className="admin-section">
            <SectionHeader title="Users" />
            {data.users.length === 0
              ? <p className="admin-page__state">No users yet.</p>
              : <UserTable users={data.users} />}
          </section>

          <section className="admin-section">
            <SectionHeader title="Server" />
            <ServerCard server={data.server} />
          </section>
        </>
      )}
    </div>
  )
}

export default AdminPage
