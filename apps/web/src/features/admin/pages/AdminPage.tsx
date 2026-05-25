import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchApi } from '../../../shared/apiBase'
import { getAuth, useIsAdmin } from '../../../store/auth'
import { ROUTES } from '../../../app/routes/routes'
import { useVisibleInterval } from '../../../shared/hooks/usePageActivity'
import { useAdminI18n } from '../adminI18n'
import '../admin.css'

// ── Types ─────────────────────────────────────────────────────────────────────

type HealthScore = 'healthy' | 'dormant' | 'risk' | 'empty'
type SyncByType = Record<string, { count: number; bytes: number }>

type AdminUser = {
  id: number
  email: string | null
  plan: string
  status: string
  createdAt: string
  premiumExpiresAt: string | null
  deletionRequestedAt: number | null
  deletionPendingAt: number | null
  tags: string[]
  lastActiveAt: string | null
  active7d: boolean
  active30d: boolean
  syncRecordCount: number
  syncPayloadBytes: number
  syncByType: SyncByType
  healthScore: HealthScore
  latestNote: { body: string; adminEmail: string; createdAt: number; count: number } | null
}

type AdminOverview = {
  totals: { totalUsers: number; premiumUsers: number; active7dCount: number; active30dCount: number }
  users: AdminUser[]
  syncTotals: { grandTotalPayloadBytes: number; blobCount: number; blobTotalBytes: number }
  server: {
    uptimeSeconds: number; loadAvg1: number; loadAvg5: number; loadAvg15: number
    totalMemBytes: number; freeMemBytes: number; usedMemBytes: number
    processRssBytes: number; dbFileSizeBytes: number | null
  }
}

type Entitlement = { id: string; planId: string; source: string; startsAt: number; expiresAt: number | null; isLifetime: boolean; note: string | null; createdAt: number }
type AdminNote = { id: string; adminEmail: string; body: string; createdAt: number; updatedAt: number }
type AuditLog = { id: string; adminEmail: string; action: string; oldValue: unknown; newValue: unknown; reason: string | null; ip: string | null; createdAt: number }
type DiagnosticsMap = Record<string, { count: number; lastUpdated: number | null }>

type UserDetail = {
  user: AdminUser & { suspensionReason?: string | null }
  entitlements: Entitlement[]
  notes: AdminNote[]
  auditLogs: AuditLog[]
  diagnostics: DiagnosticsMap
  feedbackCount: number
}

type DeletionPreview = {
  userId: number; email: string | null; plan: string; status: string; createdAt: string
  premiumExpiresAt: number | null; syncCounts: Record<string, number>; totalSyncRows: number
  blobCount: number; blobBytes: number; feedbackCount: number; adminNoteCount: number
  auditLogCount: number; sessionCount: number
  willRetain: Record<string, unknown>; willPurge: string[]
}

type FeedbackItem = {
  id: string; userId: string | null; email: string | null; type: string
  title: string; body: string; pageContext: string | null; userAgent: string | null
  status: string; adminReply: string | null; priority: string
  createdAt: number; updatedAt: number
}

type AdminOrder = {
  orderNo: string; userId: string; email: string | null; planId: string; amount: string
  feeAmount: string | null; netAmount: string | null; currency: string; channel: string
  status: string; providerOrderId: string | null; providerPaymentId: string | null
  paidAt: string | null; createdAt: string; abnormalReason: string | null
}

type AdminOrdersResponse = {
  total: number; orders: AdminOrder[]
  summary: Array<{ channel: string; currency: string; count: number; gross: string }>
}

type AdminAnalytics = {
  summary: {
    totalUsers: number
    newUsers7d: number
    newUsers30d: number
    userGrowth7d: number
    userGrowth30d: number
    premiumUsers: number
    payingUsers: number
    paidOrders: number
    paidRate: number
    paidConversionRate: number
    active7dRate: number
    active30dRate: number
    revenueByCurrency: Record<string, number>
  }
  series: Array<{
    date: string
    newUsers: number
    activeUsers: number
    paidOrders: number
    revenueByCurrency: Record<string, number>
  }>
  funnels: { registeredUsers: number; activeUsers30d: number; orderUsers: number; paidUsers: number }
  channels: Array<{ channel: string; currency: string; paidOrders: number; gross: number; averageOrderValue: number }>
}

type View = 'overview' | 'growth' | 'users' | 'orders' | 'server' | 'feedback'
type Sort = 'records' | 'newest' | 'sync'

// ── Formatting helpers ────────────────────────────────────────────────────────

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

const fmtDate = (iso: string | number | null | undefined, lang: 'en' | 'zh'): string => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US')
}

const fmtDateTime = (ts: number | null | undefined, lang: 'en' | 'zh'): string => {
  if (!ts) return '—'
  return new Date(ts).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')
}

const fmtPct = (used: number, total: number): string => {
  if (!total) return '0%'
  return `${((used / total) * 100).toFixed(1)}%`
}

const fmtRate = (value: number): string => `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`

const fmtSignedRate = (value: number): string => `${value > 0 ? '+' : ''}${fmtRate(value)}`

const fmtMoney = (amount: number | string, currency: string): string => {
  const value = typeof amount === 'string' ? Number(amount) : amount
  return `${currency} ${(Number.isFinite(value) ? value : 0).toFixed(2)}`
}

const fmtRevenueMap = (values: Record<string, number>): string => {
  const entries = Object.entries(values)
  if (entries.length === 0) return '—'
  return entries.map(([currency, amount]) => fmtMoney(amount, currency)).join(' · ')
}

const shortDate = (date: string, lang: 'en' | 'zh'): string => {
  const d = new Date(`${date}T00:00:00`)
  return d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'numeric', day: 'numeric' })
}

const planKey = (plan: string) => plan.toLowerCase()
const statusKey = (status: string, active7d: boolean) => {
  const s = status.toLowerCase()
  if (['active', 'inactive', 'suspended', 'deletion_pending'].includes(s)) return s
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

// ── Health badge ──────────────────────────────────────────────────────────────

const HealthBadge = ({ score, t }: { score: HealthScore; t: ReturnType<typeof useAdminI18n>['t'] }) => {
  const labels: Record<HealthScore, string> = { healthy: t.healthy, dormant: t.dormant, risk: t.risk, empty: t.empty }
  return <span className={`admin-health-badge admin-health-badge--${score}`}>{labels[score]}</span>
}

// ── Status pill ───────────────────────────────────────────────────────────────

const StatusPill = ({ status, active7d, t }: { status: string; active7d: boolean; t: ReturnType<typeof useAdminI18n>['t'] }) => {
  const key = statusKey(status, active7d)
  const labels: Record<string, string> = {
    active: t.active, inactive: t.inactive, suspended: t.suspended, deletion_pending: t.deletionPending,
  }
  return <span className={`admin-pill admin-pill--status ${key}`}>{labels[key] ?? key}</span>
}

// ── User detail panel ─────────────────────────────────────────────────────────

const UserDetailPanel = ({
  userId, adminFetch, lang, t, onRefresh,
}: {
  userId: number
  adminFetch: (path: string, init?: RequestInit) => Promise<Response>
  lang: 'en' | 'zh'
  t: ReturnType<typeof useAdminI18n>['t']
  onRefresh: () => void
}) => {
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionInFlight, setActionInFlight] = useState<string | null>(null)
  const [preview, setPreview] = useState<DeletionPreview | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [purgeConfirm, setPurgeConfirm] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [grantReason, setGrantReason] = useState('')
  const [suspendReason, setSuspendReason] = useState('')

  const loadDetail = useCallback(() => {
    setLoading(true)
    setError(null)
    adminFetch(`/admin/users/${userId}/detail`)
      .then((r) => r.json() as Promise<UserDetail>)
      .then((d) => { setDetail(d); setLoading(false) })
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : 'Error'); setLoading(false) })
  }, [userId, adminFetch])

  useEffect(() => { loadDetail() }, [loadDetail])

  const act = async (key: string, fn: () => Promise<void>) => {
    setActionInFlight(key)
    try { await fn(); loadDetail(); onRefresh() } catch { /* errors shown inline */ } finally { setActionInFlight(null) }
  }

  if (loading) return <p className="admin-detail-loading">{t.loadingDetail}</p>
  if (error) return <p className="admin-banner admin-banner--error">{error}</p>
  if (!detail) return null

  const { user, entitlements, notes, auditLogs, diagnostics } = detail
  const isPendingDeletion = user.status === 'deletion_pending'
  const eligibleAt = user.deletionPendingAt ? user.deletionPendingAt + 7 * 24 * 60 * 60 * 1000 : null
  const canPurge = eligibleAt ? Date.now() >= eligibleAt : false

  return (
    <div className="admin-user-detail">

      {/* ── Diagnostics ── */}
      <section className="admin-detail-section">
        <h4 className="admin-detail-section__title">{t.diagnostics}</h4>
        <div className="admin-sync-grid">
          {Object.entries(diagnostics).map(([key, val]) => (
            <div key={key} className="admin-sync-item">
              <span>{key}</span>
              <span>{val.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Entitlements + Premium actions ── */}
      <section className="admin-detail-section">
        <h4 className="admin-detail-section__title">{t.entitlements}</h4>
        {entitlements.length === 0 ? (
          <p className="admin-empty-inline">{t.noEntitlements}</p>
        ) : (
          <div className="admin-entitlements-list">
            {entitlements.map((e) => (
              <div key={e.id} className="admin-entitlement-row">
                <span className={`admin-pill ${e.planId}`}>{e.planId}</span>
                <span className="admin-entitlement-meta">{t.source}: {e.source}</span>
                <span className="admin-entitlement-meta">
                  {e.isLifetime ? t.lifetime : `${t.expiresAt}: ${fmtDateTime(e.expiresAt, lang)}`}
                </span>
                {e.note && <span className="admin-entitlement-meta">{e.note}</span>}
                <button
                  type="button"
                  className="admin-btn admin-btn--danger-lite"
                  disabled={actionInFlight === `revoke-${e.id}`}
                  onClick={() => {
                    if (!window.confirm(t.revokeWarning)) return
                    void act(`revoke-${e.id}`, () =>
                      adminFetch(`/admin/users/${userId}/revoke-entitlement`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ entitlementId: e.id, reason: 'admin revoke' }),
                      }).then(() => undefined)
                    )
                  }}
                >
                  {t.revokeEntitlement}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="admin-detail-section__sub">
          <input
            className="admin-field admin-field--sm"
            placeholder={t.grantReason}
            value={grantReason}
            onChange={(e) => setGrantReason(e.target.value)}
          />
          <p className="admin-warning-hint">{t.revokeWarning}</p>
          <div className="admin-row-actions">
            {(['pro_monthly', 'pro_yearly', 'lifetime'] as const).map((planId) => (
              <button
                key={planId}
                type="button"
                className="admin-btn"
                disabled={actionInFlight === `grant-${planId}`}
                onClick={() => void act(`grant-${planId}`, () =>
                  adminFetch(`/admin/users/${userId}/entitlements`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      planId,
                      months: planId === 'pro_monthly' ? 1 : planId === 'pro_yearly' ? 12 : undefined,
                      note: grantReason || 'manual admin grant',
                      reason: grantReason,
                    }),
                  }).then(() => undefined)
                )}
              >
                {planId === 'pro_monthly' ? t.grantPro : planId === 'pro_yearly' ? t.grantProYearly : t.grantLifetime}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Lifecycle actions ── */}
      <section className="admin-detail-section">
        <h4 className="admin-detail-section__title">{t.status}</h4>
        <div className="admin-lifecycle-status">
          <StatusPill status={user.status} active7d={false} t={t} />
          {user.suspensionReason && <span className="admin-entitlement-meta">{user.suspensionReason}</span>}
          {isPendingDeletion && user.deletionPendingAt && (
            <span className="admin-entitlement-meta">
              {t.deletionEligibleAt}: {fmtDateTime(eligibleAt, lang)}
            </span>
          )}
        </div>

        <div className="admin-row-actions admin-row-actions--lifecycle">
          {user.status === 'active' && (
            <>
              <input
                className="admin-field admin-field--sm"
                placeholder={t.suspendReason}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
              <button
                type="button"
                className="admin-btn admin-btn--danger-lite"
                disabled={actionInFlight === 'suspend'}
                onClick={() => void act('suspend', () =>
                  adminFetch(`/admin/users/${userId}/suspend`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: suspendReason }),
                  }).then(() => undefined)
                )}
              >
                {t.suspend}
              </button>
            </>
          )}
          {user.status === 'suspended' && (
            <>
              <button
                type="button"
                className="admin-btn"
                disabled={actionInFlight === 'unsuspend'}
                onClick={() => void act('unsuspend', () =>
                  adminFetch(`/admin/users/${userId}/suspend`, { method: 'DELETE' }).then(() => undefined)
                )}
              >
                {t.unsuspend}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--danger-lite"
                disabled={actionInFlight === 'request-deletion'}
                onClick={() => void act('request-deletion', () =>
                  adminFetch(`/admin/users/${userId}/request-deletion`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: 'admin requested' }),
                  }).then(() => undefined)
                )}
              >
                {t.requestDeletion}
              </button>
            </>
          )}
          {user.status === 'active' && (
            <button
              type="button"
              className="admin-btn admin-btn--danger-lite"
              disabled={actionInFlight === 'request-deletion'}
              onClick={() => void act('request-deletion', () =>
                adminFetch(`/admin/users/${userId}/request-deletion`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reason: 'admin requested' }),
                }).then(() => undefined)
              )}
            >
              {t.requestDeletion}
            </button>
          )}
          {isPendingDeletion && (
            <button
              type="button"
              className="admin-btn"
              disabled={actionInFlight === 'cancel-deletion'}
              onClick={() => void act('cancel-deletion', () =>
                adminFetch(`/admin/users/${userId}/request-deletion`, { method: 'DELETE' }).then(() => undefined)
              )}
            >
              {t.cancelDeletion}
            </button>
          )}
        </div>
      </section>

      {/* ── Deletion Preview + Purge ── */}
      {(isPendingDeletion || user.status === 'active') && (
        <section className="admin-detail-section admin-detail-section--danger">
          <h4 className="admin-detail-section__title">{t.deletionPreview}</h4>
          <button
            type="button"
            className="admin-btn"
            disabled={actionInFlight === 'preview'}
            onClick={async () => {
              setActionInFlight('preview')
              try {
                const r = await adminFetch(`/admin/users/${userId}/deletion-preview`)
                const data = await r.json() as DeletionPreview
                setPreview(data)
                setShowPreview(true)
              } finally {
                setActionInFlight(null)
              }
            }}
          >
            {t.deletionPreview}
          </button>

          {showPreview && preview && (
            <div className="admin-deletion-preview">
              <div className="admin-sync-grid">
                <div className="admin-sync-item"><span>Sync rows</span><span>{preview.totalSyncRows.toLocaleString()}</span></div>
                <div className="admin-sync-item"><span>Blobs</span><span>{preview.blobCount.toLocaleString()} ({fmtBytes(preview.blobBytes)})</span></div>
                <div className="admin-sync-item"><span>Sessions</span><span>{preview.sessionCount}</span></div>
                <div className="admin-sync-item"><span>Feedback</span><span>{preview.feedbackCount}</span></div>
                <div className="admin-sync-item"><span>Admin notes</span><span>{preview.adminNoteCount}</span></div>
                <div className="admin-sync-item admin-sync-item--retain"><span>Audit logs (retained)</span><span>{preview.auditLogCount}</span></div>
                <div className="admin-sync-item admin-sync-item--retain"><span>Payment orders (scrubbed)</span><span>retained</span></div>
              </div>

              {isPendingDeletion && (
                <div className="admin-purge-zone">
                  <p className="admin-warning-hint admin-warning-hint--danger">
                    {t.coolingWindow} — {canPurge ? `eligible now` : `${t.deletionEligibleAt}: ${fmtDateTime(eligibleAt, lang)}`}
                  </p>
                  <input
                    className="admin-field"
                    placeholder={t.purgeConfirmPrompt}
                    value={purgeConfirm}
                    onChange={(e) => setPurgeConfirm(e.target.value)}
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger"
                    disabled={
                      !canPurge ||
                      purgeConfirm.trim().toLowerCase() !== (user.email ?? '').toLowerCase() ||
                      actionInFlight === 'purge'
                    }
                    onClick={() => void act('purge', () =>
                      adminFetch(`/admin/users/${userId}/purge`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ confirmEmail: purgeConfirm, reason: 'admin purge' }),
                      }).then(() => undefined)
                    )}
                  >
                    {t.purge}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Admin Notes ── */}
      <section className="admin-detail-section">
        <h4 className="admin-detail-section__title">{t.notes}</h4>
        {notes.length === 0 ? <p className="admin-empty-inline">{t.noNotes}</p> : (
          <div className="admin-notes-list">
            {notes.map((n) => (
              <div key={n.id} className="admin-note-row">
                <p className="admin-note-body">{n.body}</p>
                <p className="admin-note-meta">{n.adminEmail} · {fmtDateTime(n.createdAt, lang)}</p>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost-sm"
                  disabled={actionInFlight === `del-note-${n.id}`}
                  onClick={() => void act(`del-note-${n.id}`, () =>
                    adminFetch(`/admin/users/${userId}/notes/${n.id}`, { method: 'DELETE' }).then(() => undefined)
                  )}
                >
                  {t.deleteNote}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="admin-note-add">
          <textarea
            className="admin-field admin-field--textarea"
            placeholder={t.noteBodyPlaceholder}
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            rows={2}
          />
          <button
            type="button"
            className="admin-btn"
            disabled={!noteBody.trim() || actionInFlight === 'add-note'}
            onClick={() => void act('add-note', () =>
              adminFetch(`/admin/users/${userId}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body: noteBody }),
              }).then(() => { setNoteBody('') })
            )}
          >
            {t.addNote}
          </button>
        </div>
      </section>

      {/* ── Audit Log ── */}
      <section className="admin-detail-section">
        <h4 className="admin-detail-section__title">{t.auditLogs}</h4>
        {auditLogs.length === 0 ? <p className="admin-empty-inline">{t.noAuditLogs}</p> : (
          <div className="admin-audit-list">
            {auditLogs.map((l) => (
              <div key={l.id} className="admin-audit-row">
                <span className="admin-audit-action">{l.action}</span>
                <span className="admin-note-meta">{l.adminEmail} · {fmtDateTime(l.createdAt, lang)}</span>
                {l.reason && <span className="admin-note-meta">{l.reason}</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Growth analytics ─────────────────────────────────────────────────────────

const GrowthTab = ({
  analytics, loading, lang, t,
}: {
  analytics: AdminAnalytics | null
  loading: boolean
  lang: 'en' | 'zh'
  t: ReturnType<typeof useAdminI18n>['t']
}) => {
  if (loading && !analytics) return <div className="admin-banner">{t.loading}</div>
  if (!analytics) return <p className="admin-empty">{t.noGrowthData}</p>

  const primaryCurrency = Object.keys(analytics.summary.revenueByCurrency)[0] ?? 'CNY'
  const chartData = analytics.series.map((item) => ({
    ...item,
    label: shortDate(item.date, lang),
    revenue: item.revenueByCurrency[primaryCurrency] ?? 0,
  }))
  const maxFunnel = Math.max(analytics.funnels.registeredUsers, 1)
  const funnelItems = [
    { label: t.registeredUsers, value: analytics.funnels.registeredUsers },
    { label: t.activeUsers30d, value: analytics.funnels.activeUsers30d },
    { label: t.orderUsers, value: analytics.funnels.orderUsers },
    { label: t.paidUsers, value: analytics.funnels.paidUsers },
  ]
  const metricItems = [
    { label: t.userGrowth7d, value: fmtSignedRate(analytics.summary.userGrowth7d), meta: `${analytics.summary.newUsers7d.toLocaleString()} ${t.newUsers7d}` },
    { label: t.userGrowth30d, value: fmtSignedRate(analytics.summary.userGrowth30d), meta: `${analytics.summary.newUsers30d.toLocaleString()} ${t.newUsers30d}` },
    { label: t.paidRate, value: fmtRate(analytics.summary.paidRate), meta: `${analytics.summary.premiumUsers.toLocaleString()} / ${analytics.summary.totalUsers.toLocaleString()}` },
    { label: t.paidConversionRate, value: fmtRate(analytics.summary.paidConversionRate), meta: `${analytics.summary.payingUsers.toLocaleString()} ${t.paidUsers}` },
    { label: t.active7dRate, value: fmtRate(analytics.summary.active7dRate), meta: t.activeRateHint },
    { label: t.active30dRate, value: fmtRate(analytics.summary.active30dRate), meta: t.syncActivityHint },
    { label: t.paidRevenue, value: fmtRevenueMap(analytics.summary.revenueByCurrency), meta: `${analytics.summary.paidOrders.toLocaleString()} ${t.paidOrdersOnly}` },
  ]

  return (
    <section className="admin-panel admin-panel--enter">
      <div className="admin-growth-hero">
        <div>
          <p className="admin-section-kicker">{t.growthKicker}</p>
          <h2>{t.growthTitle}</h2>
        </div>
        <span className="admin-growth-hero__note">{t.paidRevenueHint}</span>
      </div>

      <div className="admin-kpis admin-kpis--growth">
        {metricItems.map((item) => (
          <article key={item.label} className="admin-kpi-card admin-kpi-card--growth">
            <p>{item.label}</p>
            <h3>{item.value}</h3>
            <p>{item.meta}</p>
          </article>
        ))}
      </div>

      <div className="admin-growth-layout">
        <article className="admin-growth-chart">
          <div className="admin-card-heading">
            <h3>{t.growthTrend}</h3>
            <span>{t.last30Days}</span>
          </div>
          <div className="admin-chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="adminNewUsers" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#4F746C" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#4F746C" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="adminActiveUsers" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#B9824B" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#B9824B" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(58,55,51,0.1)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#3A3733', fontSize: 11 }} minTickGap={14} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#3A3733', fontSize: 11 }} width={34} />
                <Tooltip
                  contentStyle={{ border: '1px solid rgba(58,55,51,0.12)', borderRadius: 8, color: '#3A3733', background: '#F5F3F0' }}
                  formatter={(value, name) => [Number(value).toLocaleString(), name === 'newUsers' ? t.newUsers : t.activeUsers]}
                />
                <Area type="monotone" dataKey="newUsers" stroke="#4F746C" strokeWidth={2} fill="url(#adminNewUsers)" name="newUsers" />
                <Area type="monotone" dataKey="activeUsers" stroke="#B9824B" strokeWidth={2} fill="url(#adminActiveUsers)" name="activeUsers" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="admin-growth-chart admin-growth-chart--revenue">
          <div className="admin-card-heading">
            <h3>{t.revenueTrend}</h3>
            <span>{primaryCurrency}</span>
          </div>
          <div className="admin-chart-frame admin-chart-frame--compact">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="rgba(58,55,51,0.1)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#3A3733', fontSize: 11 }} minTickGap={18} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#3A3733', fontSize: 11 }} width={34} />
                <Tooltip
                  contentStyle={{ border: '1px solid rgba(58,55,51,0.12)', borderRadius: 8, color: '#3A3733', background: '#F5F3F0' }}
                  formatter={(value) => fmtMoney(Number(value), primaryCurrency)}
                />
                <Bar dataKey="revenue" fill="#4F746C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <div className="admin-growth-bottom">
        <article className="admin-growth-card">
          <div className="admin-card-heading">
            <h3>{t.conversionFunnel}</h3>
            <span>{t.existingData}</span>
          </div>
          <div className="admin-funnel">
            {funnelItems.map((item) => (
              <div key={item.label} className="admin-funnel-row">
                <span>{item.label}</span>
                <strong>{item.value.toLocaleString()}</strong>
                <i style={{ width: `${Math.max(4, (item.value / maxFunnel) * 100)}%` }} />
              </div>
            ))}
          </div>
        </article>

        <article className="admin-growth-card">
          <div className="admin-card-heading">
            <h3>{t.channelPerformance}</h3>
            <span>{t.paidOrdersOnly}</span>
          </div>
          {analytics.channels.length === 0 ? (
            <p className="admin-empty-inline">{t.noPaidOrders}</p>
          ) : (
            <div className="admin-channel-list">
              {analytics.channels.map((item) => (
                <div key={`${item.channel}-${item.currency}`} className="admin-channel-row">
                  <span>{item.channel} · {item.currency}</span>
                  <strong>{fmtMoney(item.gross, item.currency)}</strong>
                  <em>{item.paidOrders.toLocaleString()} · AOV {fmtMoney(item.averageOrderValue, item.currency)}</em>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  )
}

// ── Feedback Inbox ────────────────────────────────────────────────────────────

const FeedbackTab = ({
  adminFetch, lang, t,
}: {
  adminFetch: (path: string, init?: RequestInit) => Promise<Response>
  lang: 'en' | 'zh'
  t: ReturnType<typeof useAdminI18n>['t']
}) => {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [actionInFlight, setActionInFlight] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (typeFilter !== 'all') params.set('type', typeFilter)
    adminFetch(`/admin/feedback?${params.toString()}`)
      .then((r) => r.json() as Promise<{ total: number; feedback: FeedbackItem[] }>)
      .then((d) => { setItems(d.feedback); setTotal(d.total); setLoading(false) })
      .catch(() => setLoading(false))
  }, [adminFetch, statusFilter, typeFilter])

  useEffect(() => { load() }, [load])

  const updateFeedback = async (id: string, patch: Record<string, string>) => {
    setActionInFlight(id)
    try {
      await adminFetch(`/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      load()
    } finally {
      setActionInFlight(null)
    }
  }

  const typeLabels: Record<string, string> = {
    feature_request: t.typeFeatureRequest, bug: t.typeBug, confusion: t.typeConfusion, praise: t.typePraise,
  }

  const statusLabels: Record<string, string> = {
    new: t.feedbackNew, reviewing: t.feedbackReviewing, planned: t.feedbackPlanned, shipped: t.feedbackShipped, closed: t.feedbackClosed,
  }

  return (
    <section className="admin-panel admin-panel--enter">
      <div className="admin-filters">
        <select className="admin-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">{t.allStatuses}</option>
          {(['new', 'reviewing', 'planned', 'shipped', 'closed'] as const).map((s) => (
            <option key={s} value={s}>{statusLabels[s]}</option>
          ))}
        </select>
        <select className="admin-field" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">{t.allTypes}</option>
          {(['feature_request', 'bug', 'confusion', 'praise'] as const).map((s) => (
            <option key={s} value={s}>{typeLabels[s]}</option>
          ))}
        </select>
        <span className="admin-deck__updated">{total} items</span>
      </div>

      {loading && <div className="admin-banner">{t.loading}</div>}
      {!loading && items.length === 0 && <p className="admin-empty">{t.noFeedback}</p>}

      {items.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t.feedbackType}</th>
                <th>{t.feedbackStatusLabel}</th>
                <th>{t.feedbackPriority}</th>
                <th>{t.email}</th>
                <th>{t.joined}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isOpen = expanded === item.id
                return (
                  <Fragment key={item.id}>
                    <tr className="admin-row">
                      <td><span className={`admin-pill admin-pill--feedback-type ${item.type}`}>{typeLabels[item.type] ?? item.type}</span></td>
                      <td><span className={`admin-pill admin-pill--feedback-status ${item.status}`}>{statusLabels[item.status] ?? item.status}</span></td>
                      <td><span className={`admin-pill admin-pill--priority ${item.priority}`}>{item.priority}</span></td>
                      <td className="admin-email">{item.email ?? '—'}</td>
                      <td>{fmtDate(item.createdAt, lang)}</td>
                      <td>
                        <button type="button" className="admin-row__toggle" onClick={() => setExpanded((c) => c === item.id ? null : item.id)}>
                          {isOpen ? t.collapse : t.details}
                        </button>
                      </td>
                    </tr>
                    <tr className={`admin-row-detail ${isOpen ? 'is-open' : ''}`}>
                      <td colSpan={6}>
                        <div className="admin-row-detail__body">
                          <div className="admin-row-detail__content admin-feedback-detail">
                            <p className="admin-feedback-title">{item.title}</p>
                            <p className="admin-feedback-body">{item.body}</p>
                            {item.pageContext && <p className="admin-note-meta">Page: {item.pageContext}</p>}
                            {item.adminReply && <p className="admin-feedback-reply">{item.adminReply}</p>}
                            <div className="admin-row-actions">
                              <select
                                className="admin-field admin-field--sm"
                                value={item.status}
                                disabled={actionInFlight === item.id}
                                onChange={(e) => void updateFeedback(item.id, { status: e.target.value })}
                              >
                                {(['new', 'reviewing', 'planned', 'shipped', 'closed'] as const).map((s) => (
                                  <option key={s} value={s}>{statusLabels[s]}</option>
                                ))}
                              </select>
                              <select
                                className="admin-field admin-field--sm"
                                value={item.priority}
                                disabled={actionInFlight === item.id}
                                onChange={(e) => void updateFeedback(item.id, { priority: e.target.value })}
                              >
                                {(['low', 'normal', 'high'] as const).map((p) => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                            </div>
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
  )
}

// ── AdminPage ─────────────────────────────────────────────────────────────────

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
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [ordersData, setOrdersData] = useState<AdminOrdersResponse | null>(null)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderQuery, setOrderQuery] = useState('')
  const [orderStatus, setOrderStatus] = useState('all')
  const [orderChannel, setOrderChannel] = useState('all')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [orderAction, setOrderAction] = useState<string | null>(null)

  useVisibleInterval(() => setTick((n) => n + 1), 20000, {
    enabled: autoRefresh,
    runOnVisible: true,
  })

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
      .then((d) => { setData(d); setUpdatedAt(new Date()); setLoading(false) })
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : t.unknownError); setLoading(false) })
  }, [isAdmin, tick, t.unknownError])

  useEffect(() => {
    if (!isAdmin || view !== 'orders') return
    const auth = getAuth()
    const headers: HeadersInit = auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}
    const params = new URLSearchParams({ limit: '100', status: orderStatus, channel: orderChannel })
    if (orderQuery.trim()) params.set('q', orderQuery.trim())
    setOrdersLoading(true)
    fetchApi(`/admin/orders?${params.toString()}`, { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<AdminOrdersResponse>
      })
      .then((next) => { setOrdersData(next); setOrdersLoading(false) })
      .catch(() => { setOrdersLoading(false) })
  }, [isAdmin, orderChannel, orderQuery, orderStatus, tick, view])

  useEffect(() => {
    if (!isAdmin || view !== 'growth') return
    const auth = getAuth()
    const headers: HeadersInit = auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}
    setAnalyticsLoading(true)
    fetchApi('/admin/analytics', { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<AdminAnalytics>
      })
      .then((next) => { setAnalytics(next); setAnalyticsLoading(false) })
      .catch(() => { setAnalyticsLoading(false) })
  }, [isAdmin, tick, view])

  const adminFetch = useCallback(async (path: string, init?: RequestInit) => {
    const auth = getAuth()
    const headers: HeadersInit = {
      ...(init?.headers ?? {}),
      ...(auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
    }
    const response = await fetchApi(path, { ...init, headers })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response
  }, [])

  const exportOrders = () => {
    const params = new URLSearchParams({ status: orderStatus, channel: orderChannel })
    if (orderQuery.trim()) params.set('q', orderQuery.trim())
    void adminFetch(`/admin/orders/export?${params.toString()}`)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = 'focusgo-orders.csv'
        anchor.click()
        URL.revokeObjectURL(url)
      })
  }

  const markAbnormal = async (orderNo: string) => {
    const reason = window.prompt(t.abnormalReasonPrompt)
    if (!reason) return
    setOrderAction(orderNo)
    try {
      await adminFetch(`/admin/orders/${orderNo}/mark-abnormal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      setTick((n) => n + 1)
    } finally {
      setOrderAction(null)
    }
  }

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
    overview: t.overview, growth: t.growth, users: t.users, orders: t.orders, server: t.server, feedback: t.feedback,
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
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            <span>{t.autoRefresh}</span>
          </label>
          <button type="button" className="admin-btn" disabled={loading} onClick={() => setTick((n) => n + 1)}>
            {loading ? t.refreshing : t.refresh}
          </button>
          <span className="admin-deck__updated">
            {t.updatedAt}: {updatedAt ? updatedAt.toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US') : '—'}
          </span>
        </div>
      </header>

      <nav className="admin-tabs" aria-label={t.tabAria}>
        {(Object.keys(viewLabels) as View[]).map((key) => (
          <button key={key} type="button" className={`admin-tab ${view === key ? 'is-active' : ''}`} onClick={() => setView(key)}>
            {viewLabels[key]}
          </button>
        ))}
      </nav>

      {error && <div className="admin-banner admin-banner--error">{t.loadFailed}: {error}</div>}
      {!data && loading && <div className="admin-banner">{t.loading}</div>}

      {/* ── Overview ── */}
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

      {/* ── Growth ── */}
      {view === 'growth' && (
        <GrowthTab analytics={analytics} loading={analyticsLoading} lang={lang} t={t} />
      )}

      {/* ── Users ── */}
      {data && view === 'users' && (
        <section className="admin-panel admin-panel--enter">
          <div className="admin-filters">
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="admin-field" type="search" placeholder={t.searchEmail} />
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
              <option value="suspended">{t.suspended}</option>
              <option value="deletion_pending">{t.deletionPending}</option>
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
                    <th>{t.latestNote}</th>
                    <th>{t.plan}</th>
                    <th>{t.status}</th>
                    <th>{t.health}</th>
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
                    return (
                      <Fragment key={u.id}>
                        <tr className="admin-row">
                          <td className="admin-email">
                            {u.email ?? '—'}
                            {(u.tags?.length ?? 0) > 0 && (
                              <span className="admin-user-tags">
                                {u.tags.map((tag) => <span key={tag} className="admin-tag">{tag}</span>)}
                              </span>
                            )}
                          </td>
                          <td className="admin-note-cell">
                            {u.latestNote && (
                              <div className="admin-user-note-inline" title={u.latestNote.body}>
                                <span className="admin-user-note-inline__body">{u.latestNote.body}</span>
                                <span className="admin-user-note-inline__meta">
                                  {u.latestNote.adminEmail} · {fmtDateTime(u.latestNote.createdAt, lang)}
                                  {u.latestNote.count > 1 ? ` · +${u.latestNote.count - 1}` : ''}
                                </span>
                              </div>
                            )}
                            {!u.latestNote && '—'}
                          </td>
                          <td><span className={`admin-pill ${planKey(u.plan)}`}>{planKey(u.plan) === 'premium' ? t.premium : t.free}</span></td>
                          <td><StatusPill status={u.status} active7d={u.active7d} t={t} /></td>
                          <td><HealthBadge score={u.healthScore} t={t} /></td>
                          <td>{fmtDate(u.createdAt, lang)}</td>
                          <td>{fmtDate(u.lastActiveAt, lang)}</td>
                          <td>{u.active7d ? t.yes : t.no}</td>
                          <td>{u.active30d ? t.yes : t.no}</td>
                          <td>{u.syncRecordCount.toLocaleString()}</td>
                          <td>{fmtBytes(u.syncPayloadBytes)}</td>
                          <td>
                            <button type="button" className="admin-row__toggle" onClick={() => setExpanded((curr) => (curr === u.id ? null : u.id))}>
                              {opened ? t.collapse : t.viewDetail}
                            </button>
                          </td>
                        </tr>
                        <tr className={`admin-row-detail ${opened ? 'is-open' : ''}`}>
                          <td colSpan={12}>
                            <div className="admin-row-detail__body">
                              {opened && (
                                <UserDetailPanel
                                  userId={u.id}
                                  adminFetch={adminFetch}
                                  lang={lang}
                                  t={t}
                                  onRefresh={() => setTick((n) => n + 1)}
                                />
                              )}
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

      {/* ── Feedback ── */}
      {view === 'feedback' && (
        <FeedbackTab adminFetch={adminFetch} lang={lang} t={t} />
      )}

      {/* ── Orders ── */}
      {view === 'orders' && (
        <section className="admin-panel admin-panel--enter">
          <div className="admin-filters admin-filters--orders">
            <input value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)} className="admin-field" type="search" placeholder={t.searchOrders} />
            <select className="admin-field" value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)}>
              <option value="all">{t.allStatuses}</option>
              {['pending', 'paid', 'failed', 'expired', 'abnormal', 'refunded'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="admin-field" value={orderChannel} onChange={(e) => setOrderChannel(e.target.value)}>
              <option value="all">{t.allChannels}</option>
              <option value="zpay_alipay">zpay_alipay</option>
              <option value="paypal_checkout">paypal_checkout</option>
            </select>
            <button type="button" className="admin-btn" onClick={exportOrders}>{t.exportCsv}</button>
          </div>

          {ordersData?.summary?.length ? (
            <div className="admin-kpis admin-kpis--orders">
              {ordersData.summary.map((item) => (
                <article key={`${item.channel}-${item.currency}`} className="admin-kpi-card">
                  <p>{item.channel} · {item.currency}</p>
                  <h3>{item.gross}</h3>
                  <p>{item.count.toLocaleString()} {t.orders}</p>
                </article>
              ))}
            </div>
          ) : null}

          {ordersLoading && <div className="admin-banner">{t.loading}</div>}
          {ordersData && ordersData.orders.length === 0 ? <p className="admin-empty">{t.noOrders}</p> : null}
          {ordersData && ordersData.orders.length > 0 ? (
            <div className="admin-table-wrap admin-table-wrap--orders">
              <table className="admin-table admin-table--orders">
                <thead>
                  <tr>
                    <th>{t.orderNo}</th><th>{t.email}</th><th>{t.plan}</th>
                    <th>{t.amount}</th><th>{t.channel}</th><th>{t.status}</th>
                    <th>{t.paidAt}</th><th />
                  </tr>
                </thead>
                <tbody>
                  {ordersData.orders.map((order) => {
                    const opened = expandedOrder === order.orderNo
                    return (
                      <Fragment key={order.orderNo}>
                        <tr className="admin-row">
                          <td className="admin-email">{order.orderNo}</td>
                          <td className="admin-email">{order.email ?? '—'}</td>
                          <td><span className={`admin-pill ${order.planId}`}>{order.planId}</span></td>
                          <td>{order.amount} {order.currency}</td>
                          <td>{order.channel}</td>
                          <td><span className={`admin-pill ${order.status}`}>{order.status}</span></td>
                          <td>{fmtDate(order.paidAt, lang)}</td>
                          <td>
                            <button type="button" className="admin-row__toggle" onClick={() => setExpandedOrder((curr) => (curr === order.orderNo ? null : order.orderNo))}>
                              {opened ? t.collapse : t.details}
                            </button>
                          </td>
                        </tr>
                        <tr className={`admin-row-detail ${opened ? 'is-open' : ''}`}>
                          <td colSpan={8}>
                            <div className="admin-row-detail__body">
                              <div className="admin-row-detail__content admin-order-detail">
                                <div className="admin-sync-item"><span>{t.providerOrder}</span><span>{order.providerOrderId ?? '—'}</span></div>
                                <div className="admin-sync-item"><span>{t.providerPayment}</span><span>{order.providerPaymentId ?? '—'}</span></div>
                                <div className="admin-sync-item"><span>{t.netAmount}</span><span>{order.netAmount ?? '—'} {order.currency}</span></div>
                                <div className="admin-sync-item"><span>{t.feeAmount}</span><span>{order.feeAmount ?? '—'} {order.currency}</span></div>
                                <div className="admin-sync-item"><span>{t.abnormalReason}</span><span>{order.abnormalReason ?? '—'}</span></div>
                                <div className="admin-row-actions">
                                  <button type="button" className="admin-btn" disabled={orderAction === order.orderNo} onClick={() => void markAbnormal(order.orderNo)}>{t.markAbnormal}</button>
                                </div>
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
          ) : null}
        </section>
      )}

      {/* ── Server ── */}
      {data && view === 'server' && (
        <section className="admin-panel admin-panel--enter">
          <div className="admin-server-grid">
            <article className="admin-server-card"><p>{t.uptime}</p><h3>{fmtUptime(data.server.uptimeSeconds, lang)}</h3></article>
            <article className="admin-server-card"><p>{t.loadAvg}</p><h3>{data.server.loadAvg1.toFixed(2)} / {data.server.loadAvg5.toFixed(2)} / {data.server.loadAvg15.toFixed(2)}</h3></article>
            <article className="admin-server-card"><p>{t.memory}</p><h3>{fmtBytes(data.server.usedMemBytes)} / {fmtBytes(data.server.totalMemBytes)} ({fmtPct(data.server.usedMemBytes, data.server.totalMemBytes)})</h3></article>
            <article className="admin-server-card"><p>{t.processRss}</p><h3>{fmtBytes(data.server.processRssBytes)}</h3></article>
            <article className="admin-server-card"><p>{t.dbFileSize}</p><h3>{fmtBytes(data.server.dbFileSizeBytes)}</h3></article>
          </div>
        </section>
      )}
    </div>
  )
}

export default AdminPage
