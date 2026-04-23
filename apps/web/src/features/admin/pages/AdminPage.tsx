import { Fragment, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { fetchApi } from '../../../shared/apiBase'
import { getAuth, useIsAdmin } from '../../../store/auth'
import { ROUTES } from '../../../app/routes/routes'
import { useAdminI18n } from '../adminI18n'
import '../admin.css'

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

type View = 'overview' | 'users' | 'server'
type Sort = 'records' | 'newest' | 'sync'

const fmtBytes = (bytes: number | null | undefined): string => {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const fmtUptime = (seconds: number, lang: 'en' | 'zh'): string => {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (lang === 'zh') {
    const parts: string[] = []
    if (d > 0) parts.push(`${d}天`)
    if (h > 0) parts.push(`${h}小时`)
    parts.push(`${m}分钟`)
    return parts.join(' ')
  }
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}

const fmtDate = (iso: string | null | undefined, lang: 'en' | 'zh'): string => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US')
}

const fmtPct = (used: number, total: number): string => {
  if (!total) return '0%'
  return `${((used / total) * 100).toFixed(1)}%`
}

const planKey = (plan: string) => plan.toLowerCase()
const statusKey = (status: string, active7d: boolean) => {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'inactive') return s
  return active7d ? 'active' : 'inactive'
}

const kpiItems = (data: AdminOverview, t: ReturnType<typeof useAdminI18n>['t']) => [
  { label: t.totalUsers, value: data.totals.totalUsers.toLocaleString() },
  { label: t.premiumUsers, value: data.totals.premiumUsers.toLocaleString() },
  { label: t.activeUsers7d, value: data.totals.active7dCount.toLocaleString() },
  { label: t.activeUsers30d, value: data.totals.active30dCount.toLocaleString() },
  { label: t.payload, value: fmtBytes(data.syncTotals.grandTotalPayloadBytes) },
  { label: t.blobs, value: `${data.syncTotals.blobCount.toLocaleString()} · ${fmtBytes(data.syncTotals.blobTotalBytes)}` },
  { label: t.dbSize, value: fmtBytes(data.server.dbFileSizeBytes) },
]

const AdminPage = () => {
  const isAdmin = useIsAdmin()
  const { lang, t } = useAdminI18n()

  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const [view, setView] = useState<View>('overview')
  const [query, setQuery] = useState('')
  const [plan, setPlan] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState<Sort>('records')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    if (!autoRefresh) return
    const timer = window.setInterval(() => setTick((n) => n + 1), 20000)
    return () => window.clearInterval(timer)
  }, [autoRefresh])

  useEffect(() => {
    if (!isAdmin) return
    const auth = getAuth()
    const headers: HeadersInit = auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}

    setLoading(true)
    setError(null)
    fetchApi('/admin/overview', { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<AdminOverview>
      })
      .then((d) => {
        setData(d)
        setUpdatedAt(new Date())
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t.unknownError)
        setLoading(false)
      })
  }, [isAdmin, tick, t.unknownError])

  const planOptions = useMemo(() => {
    const options = new Set<string>(['all'])
    data?.users.forEach((u) => options.add(planKey(u.plan)))
    return [...options]
  }, [data])

  const filteredUsers = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()

    const rows = data.users.filter((u) => {
      if (plan !== 'all' && planKey(u.plan) !== plan) return false
      if (status !== 'all' && statusKey(u.status, u.active7d) !== status) return false
      if (q && !(u.email ?? '').toLowerCase().includes(q)) return false
      return true
    })

    rows.sort((a, b) => {
      if (sort === 'newest') return +new Date(b.createdAt) - +new Date(a.createdAt)
      if (sort === 'sync') return b.syncPayloadBytes - a.syncPayloadBytes
      return b.syncRecordCount - a.syncRecordCount
    })

    return rows
  }, [data, plan, query, sort, status])

  if (!isAdmin) return <Navigate to={ROUTES.DASHBOARD} replace />

  const viewLabels: Record<View, string> = {
    overview: t.overview,
    users: t.users,
    server: t.server,
  }

  const kpis = data ? kpiItems(data, t) : []

  return (
    <div className="admin-deck">
      <header className="admin-deck__hero">
        <div>
          <p className="admin-deck__eyebrow">Focus&go</p>
          <h1 className="admin-deck__title">{t.title}</h1>
          <p className="admin-deck__subtitle">{t.subtitle}</p>
        </div>
        <div className="admin-deck__actions">
          <label className="admin-switch">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>{t.autoRefresh}</span>
          </label>
          <button
            type="button"
            className="admin-btn"
            disabled={loading}
            onClick={() => setTick((n) => n + 1)}
          >
            {loading ? t.refreshing : t.refresh}
          </button>
          <span className="admin-deck__updated">
            {t.updatedAt}: {updatedAt ? updatedAt.toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US') : '—'}
          </span>
        </div>
      </header>

      <nav className="admin-tabs" aria-label={t.tabAria}>
        {(Object.keys(viewLabels) as View[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`admin-tab ${view === key ? 'is-active' : ''}`}
            onClick={() => setView(key)}
          >
            {viewLabels[key]}
          </button>
        ))}
      </nav>

      {error && <div className="admin-banner admin-banner--error">{t.loadFailed}: {error}</div>}
      {!data && loading && <div className="admin-banner">{t.loading}</div>}

      {data && view === 'overview' && (
        <section className="admin-panel admin-panel--enter">
          <div className="admin-kpis">
            {kpis.map((item) => (
              <article key={item.label} className="admin-kpi-card">
                <p>{item.label}</p>
                <h3>{item.value}</h3>
              </article>
            ))}
          </div>
        </section>
      )}

      {data && view === 'users' && (
        <section className="admin-panel admin-panel--enter">
          <div className="admin-filters">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="admin-field"
              type="search"
              placeholder={t.searchEmail}
            />

            <select className="admin-field" value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="all">{t.allPlans}</option>
              {planOptions.filter((x) => x !== 'all').map((key) => (
                <option key={key} value={key}>{key === 'premium' ? t.premium : t.free}</option>
              ))}
            </select>

            <select className="admin-field" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">{t.allStatuses}</option>
              <option value="active">{t.active}</option>
              <option value="inactive">{t.inactive}</option>
            </select>

            <select className="admin-field" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="records">{t.sortBy}: {t.sortRecords}</option>
              <option value="newest">{t.sortBy}: {t.sortNewest}</option>
              <option value="sync">{t.sortBy}: {t.sortSyncSize}</option>
            </select>
          </div>

          {filteredUsers.length === 0 ? (
            <p className="admin-empty">{t.noUsers}</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t.email}</th>
                    <th>{t.plan}</th>
                    <th>{t.status}</th>
                    <th>{t.joined}</th>
                    <th>{t.lastActive}</th>
                    <th>{t.active7d}</th>
                    <th>{t.active30d}</th>
                    <th>{t.records}</th>
                    <th>{t.syncSize}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const opened = expanded === u.id
                    const statusDisplay = statusKey(u.status, u.active7d) === 'active' ? t.active : t.inactive
                    return (
                      <Fragment key={u.id}>
                        <tr className="admin-row">
                          <td className="admin-email">{u.email ?? '—'}</td>
                          <td><span className={`admin-pill ${planKey(u.plan)}`}>{planKey(u.plan) === 'premium' ? t.premium : t.free}</span></td>
                          <td>{statusDisplay}</td>
                          <td>{fmtDate(u.createdAt, lang)}</td>
                          <td>{fmtDate(u.lastActiveAt, lang)}</td>
                          <td>{u.active7d ? t.yes : t.no}</td>
                          <td>{u.active30d ? t.yes : t.no}</td>
                          <td>{u.syncRecordCount.toLocaleString()}</td>
                          <td>{fmtBytes(u.syncPayloadBytes)}</td>
                          <td>
                            <button
                              type="button"
                              className="admin-row__toggle"
                              onClick={() => setExpanded((curr) => (curr === u.id ? null : u.id))}
                            >
                              {opened ? t.collapse : t.details}
                            </button>
                          </td>
                        </tr>
                        <tr className={`admin-row-detail ${opened ? 'is-open' : ''}`}>
                          <td colSpan={10}>
                            <div className="admin-row-detail__body">
                              <div className="admin-row-detail__content">
                                {Object.entries(u.syncByType).length === 0 && <p>{t.noSyncDetails}</p>}
                                {Object.entries(u.syncByType).map(([key, value]) => (
                                  <div key={key} className="admin-sync-item">
                                    <span>{key}</span>
                                    <span>{value.count.toLocaleString()} · {fmtBytes(value.bytes)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {data && view === 'server' && (
        <section className="admin-panel admin-panel--enter">
          <div className="admin-server-grid">
            <article className="admin-server-card">
              <p>{t.uptime}</p>
              <h3>{fmtUptime(data.server.uptimeSeconds, lang)}</h3>
            </article>
            <article className="admin-server-card">
              <p>{t.loadAvg}</p>
              <h3>{data.server.loadAvg1.toFixed(2)} / {data.server.loadAvg5.toFixed(2)} / {data.server.loadAvg15.toFixed(2)}</h3>
            </article>
            <article className="admin-server-card">
              <p>{t.memory}</p>
              <h3>{fmtBytes(data.server.usedMemBytes)} / {fmtBytes(data.server.totalMemBytes)} ({fmtPct(data.server.usedMemBytes, data.server.totalMemBytes)})</h3>
            </article>
            <article className="admin-server-card">
              <p>{t.processRss}</p>
              <h3>{fmtBytes(data.server.processRssBytes)}</h3>
            </article>
            <article className="admin-server-card">
              <p>{t.dbFileSize}</p>
              <h3>{fmtBytes(data.server.dbFileSizeBytes)}</h3>
            </article>
          </div>
        </section>
      )}
    </div>
  )
}

export default AdminPage
