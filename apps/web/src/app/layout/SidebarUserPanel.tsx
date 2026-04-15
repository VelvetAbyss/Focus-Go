import { useState, useEffect, useRef } from 'react'
import {
  User, LogOut, Crown, Zap, X, Timer, FileText, ArrowRight,
  ChevronRight, Flame, CheckSquare, Mail, Shield, CreditCard, Download,
  HelpCircle, ArrowLeft, Check, Loader2, AlertTriangle, Copy, ExternalLink,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  clearAuth, getAuth, setAuth, useAuthPlan, useIsLoggedIn, upgradeToPremium,
} from '../../store/auth'
import { getLogoutUrl, prepareAuthSession } from '../../config/auth'
import { clearLocalUserData } from '../../data/sync/repository'
import { useI18n } from '../../shared/i18n/useI18n'
import LoginModal from './LoginModal'
import { dbService } from '../../data/services/dbService'
import type { FocusSession } from '../../data/models/types'
import { ROUTES } from '../routes/routes'
import { db } from '../../data/db'
import { DB_NAME, DB_VERSION, TABLES } from '../../data/db/schema'
import {
  createBackupDownload,
  createBrowserStorageAdapter,
  createTableDatabaseAdapter,
  downloadBackupFile,
  exportLocalBackup,
} from '../../shared/backup/localBackup'

type SidebarUserPanelProps = {
  collapsed: boolean
}

type ActivePanel =
  | null
  | 'editProfile'
  | 'emailLogin'
  | 'security'
  | 'helpFeedback'
  | 'deleteAccount'

type ExtendedUserStats = {
  tasksCompleted: number
  focusHours: number
  notesCount: number
  diaryDays: number
  weeklyFocusHours: number
  weeklyTasks: number
  streak: number
  level: number
  levelProgress: number
  sessionsToNextLevel: number
}

function computeStreak(sessions: FocusSession[]): number {
  const completed = sessions.filter(s => s.status === 'completed' && (s.completedAt ?? s.updatedAt))
  if (completed.length === 0) return 0
  const daySet = new Set(
    completed.map(s => new Date(s.completedAt ?? s.updatedAt).toLocaleDateString('en-CA'))
  )
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (daySet.has(d.toLocaleDateString('en-CA'))) {
      streak++
    } else {
      break
    }
  }
  return streak
}

// ─── Sub-panel: Edit Profile ──────────────────────────────────────────────────

const EditProfilePanel = ({ displayName, email }: {
  displayName: string; email: string
}) => {
  const { t } = useI18n()
  const [editName, setEditName] = useState(displayName)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSave = () => {
    if (saveState !== 'idle') return
    setSaveState('saving')
    const auth = getAuth()
    if (auth?.user) {
      setAuth({ ...auth, user: { ...auth.user, nickname: editName } })
    }
    setTimeout(() => {
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1800)
    }, 400)
  }

  return (
    <div className="acct-subpanel-body">
      <div className="acct-field">
        <label className="acct-field-label">{t('auth.account.displayName')}</label>
        <input
          ref={inputRef}
          className="acct-field-input"
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          maxLength={40}
        />
      </div>
      <div className="acct-field">
        <label className="acct-field-label">{t('auth.account.currentEmail')}</label>
        <div className="acct-field-readonly">{email || '—'}</div>
      </div>
      <button
        type="button"
        className={`acct-save-btn${saveState === 'saved' ? ' acct-save-btn--saved' : ''}`}
        onClick={handleSave}
        disabled={saveState !== 'idle' || editName.trim() === displayName.trim()}
      >
        {saveState === 'saving' && <Loader2 size={14} className="acct-spin" />}
        {saveState === 'saved' && <Check size={14} />}
        {saveState === 'idle' && t('auth.account.saveChanges')}
        {saveState === 'saving' && '…'}
        {saveState === 'saved' && t('auth.account.changesSaved')}
      </button>
    </div>
  )
}

// ─── Sub-panel: Email & Login ─────────────────────────────────────────────────

const EmailLoginPanel = ({ email }: { email: string }) => {
  const { t } = useI18n()
  const domain = 'https://nestflow.authing.cn'

  return (
    <div className="acct-subpanel-body">
      <div className="acct-info-card">
        <div className="acct-info-row">
          <span className="acct-info-label">{t('auth.account.currentEmail')}</span>
          <span className="acct-info-value">{email || '—'}</span>
        </div>
        <div className="acct-info-row">
          <span className="acct-info-label">{t('auth.account.loginProvider')}</span>
          <span className="acct-info-value">Authing (OIDC)</span>
        </div>
      </div>
      <p className="acct-subpanel-hint">{t('auth.account.providerManaged')}</p>
      <a
        href={domain}
        target="_blank"
        rel="noopener noreferrer"
        className="acct-portal-link"
      >
        {t('auth.account.openPortal')}
        <ExternalLink size={12} />
      </a>
    </div>
  )
}

// ─── Sub-panel: Account Security ─────────────────────────────────────────────

const SecurityPanel = () => {
  const { t } = useI18n()
  const domain = 'https://nestflow.authing.cn'

  return (
    <div className="acct-subpanel-body">
      <div className="acct-info-card">
        <div className="acct-info-row">
          <span className="acct-info-label">{t('auth.account.loginProvider')}</span>
          <span className="acct-info-value">Authing (OIDC)</span>
        </div>
        <div className="acct-info-row">
          <span className="acct-info-label">Protocol</span>
          <span className="acct-info-value">OAuth 2.0 + PKCE</span>
        </div>
      </div>
      <p className="acct-subpanel-hint">
        Password changes, two-factor authentication, and connected devices are managed through your Authing account portal.
      </p>
      <a
        href={`${domain}/profile`}
        target="_blank"
        rel="noopener noreferrer"
        className="acct-portal-link"
      >
        {t('auth.account.openPortal')}
        <ExternalLink size={12} />
      </a>
    </div>
  )
}

// ─── Sub-panel: Help & Feedback ───────────────────────────────────────────────

const HelpFeedbackPanel = () => {
  const { t } = useI18n()
  const supportEmail = 'support@nestflow.art'
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(supportEmail)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div className="acct-subpanel-body">
      <div className="acct-info-card">
        <div className="acct-info-row">
          <span className="acct-info-label">{t('auth.account.emailSupport')}</span>
          <span className="acct-info-value acct-info-value--mono">{supportEmail}</span>
        </div>
      </div>
      <div className="acct-help-actions">
        <button type="button" className="acct-help-btn" onClick={handleCopy}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? t('auth.account.copied') : t('auth.account.copyEmail')}
        </button>
        <a
          href={`mailto:${supportEmail}?subject=Focus%20%26%20Go%20Feedback`}
          className="acct-help-btn acct-help-btn--primary"
        >
          <Mail size={13} />
          {t('auth.account.sendEmail')}
        </a>
      </div>
      <p className="acct-subpanel-hint" style={{ marginTop: 16 }}>
        We typically respond within 1–2 business days. For bug reports, please include your device and app version.
      </p>
    </div>
  )
}

// ─── Sub-panel: Delete Account ────────────────────────────────────────────────

const DeleteAccountPanel = ({ email }: { email: string }) => {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const confirmed = input.trim().toLowerCase() === email.trim().toLowerCase() && email !== ''

  const handleDelete = async () => {
    if (!confirmed || deleting) return
    setDeleting(true)
    // No backend deletion API yet — clear auth and log out
    await clearLocalUserData()
    clearAuth()
    window.location.href = getLogoutUrl()
  }

  return (
    <div className="acct-subpanel-body">
      <div className="acct-delete-warning">
        <AlertTriangle size={16} />
        <p>{t('auth.account.deleteWarning')}</p>
      </div>
      <div className="acct-field">
        <label className="acct-field-label">{t('auth.account.deleteConfirmLabel')}</label>
        <input
          className="acct-field-input acct-field-input--danger"
          type="email"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={email}
          autoComplete="off"
        />
      </div>
      <button
        type="button"
        className="acct-delete-btn"
        disabled={!confirmed || deleting}
        onClick={handleDelete}
      >
        {deleting ? <Loader2 size={14} className="acct-spin" /> : null}
        {t('auth.account.deleteConfirmBtn')}
      </button>
      <p className="acct-subpanel-hint acct-subpanel-hint--sm">{t('auth.account.deleteNote')}</p>
    </div>
  )
}

// ─── Main UserModal ───────────────────────────────────────────────────────────

const UserModal = ({ onClose }: { onClose: () => void }) => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const plan = useAuthPlan()
  const isPremium = plan === 'premium'
  const authState = getAuth()
  const user = authState?.user
  const expiresAt: string | null = authState?.expiresAt ?? null
  const [stats, setStats] = useState<ExtendedUserStats | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const [exportState, setExportState] = useState<'idle' | 'exporting' | 'done'>('idle')

  const displayName = user?.name || user?.nickname || user?.email?.split('@')[0] || 'U'
  const email = user?.email || ''
  const initial = displayName[0].toUpperCase()

  const expiryLabel = (() => {
    if (!expiresAt) return null
    try {
      return new Date(expiresAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    } catch { return null }
  })()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [tasks, sessions, notes, diary] = await Promise.all([
        dbService.tasks.list().catch(() => []),
        dbService.focusSessions.list().catch(() => []),
        dbService.notes.list().catch(() => []),
        dbService.diary.listActive().catch(() => []),
      ])
      if (cancelled) return
      const completedSessions = sessions.filter(s => s.status === 'completed')
      const tasksCompleted = tasks.filter(t => t.status === 'done').length
      const totalFocusMinutes = completedSessions.reduce((sum, s) => sum + (s.actualMinutes ?? 0), 0)
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      const weeklyMinutes = completedSessions
        .filter(s => (s.completedAt ?? s.updatedAt) >= weekAgo)
        .reduce((sum, s) => sum + (s.actualMinutes ?? 0), 0)
      const weeklyTasks = tasks.filter(t => t.status === 'done' && t.updatedAt >= weekAgo).length
      const streak = computeStreak(sessions)
      const totalSessions = completedSessions.length
      const level = Math.floor(totalSessions / 5) + 1
      const levelProgress = totalSessions % 5
      setStats({
        tasksCompleted,
        focusHours: Math.round((totalFocusMinutes / 60) * 10) / 10,
        notesCount: notes.length,
        diaryDays: diary.length,
        weeklyFocusHours: Math.round((weeklyMinutes / 60) * 10) / 10,
        weeklyTasks,
        streak,
        level,
        levelProgress,
        sessionsToNextLevel: 5 - levelProgress,
      })
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleLogout = async () => {
    await clearLocalUserData()
    clearAuth()
    window.location.href = getLogoutUrl()
  }

  const handleUpgrade = async () => {
    setUpgrading(true)
    await upgradeToPremium()
    setUpgrading(false)
    onClose()
  }

  const handleBilling = () => {
    navigate(ROUTES.PREMIUM)
    onClose()
  }

  const handleExport = async () => {
    if (exportState !== 'idle') return
    setExportState('exporting')
    try {
      const tableNames = Object.values(TABLES)
      const payload = await exportLocalBackup({
        db: createTableDatabaseAdapter(db, tableNames),
        storage: createBrowserStorageAdapter(window.localStorage),
        tableNames,
        dbName: DB_NAME,
        dbVersion: DB_VERSION,
      })
      downloadBackupFile(await createBackupDownload(payload))
      setExportState('done')
      setTimeout(() => setExportState('idle'), 3000)
    } catch {
      setExportState('idle')
    }
  }

  const handleSwitchAccount = async () => {
    await clearLocalUserData()
    clearAuth()
    const authUrl = await prepareAuthSession()
    window.location.href = authUrl
  }

  const handleViewGrowth = () => {
    navigate(ROUTES.DIARY)
    onClose()
  }

  const achievements = stats ? [
    { key: 'deepWorker', label: t('auth.account.badge.deepWorker'), unlocked: stats.focusHours >= 5 },
    { key: 'actionHero', label: t('auth.account.badge.actionHero'), unlocked: stats.tasksCompleted >= 10 },
    { key: 'chronicler', label: t('auth.account.badge.chronicler'), unlocked: stats.notesCount >= 5 },
    { key: 'streakMaster', label: t('auth.account.badge.streakMaster'), unlocked: stats.streak >= 7 },
    { key: 'lifeObserver', label: t('auth.account.badge.lifeObserver'), unlocked: stats.diaryDays >= 5 },
  ] : []
  const unlockedBadges = achievements.filter(a => a.unlocked)
  const recentBadge = unlockedBadges[unlockedBadges.length - 1]

  const subPanelTitleMap: Record<NonNullable<ActivePanel>, string> = {
    editProfile: t('auth.account.panel.editProfile'),
    emailLogin: t('auth.account.panel.emailLogin'),
    security: t('auth.account.panel.security'),
    helpFeedback: t('auth.account.panel.helpFeedback'),
    deleteAccount: t('auth.account.panel.deleteAccount'),
  }

  const exportIcon = () => {
    if (exportState === 'exporting') return <Loader2 size={14} className="acct-spin" />
    if (exportState === 'done') return <Check size={14} />
    return <Download size={14} />
  }
  const exportLabel = () => {
    if (exportState === 'exporting') return t('auth.account.exportingData')
    if (exportState === 'done') return t('auth.account.exportDone')
    return t('auth.account.exportData')
  }

  const settingsItems: {
    key: 'editProfile' | 'emailLogin' | 'security' | 'billing' | 'exportData' | 'helpFeedback'
    icon: React.FC<{ size?: number; className?: string }>
    onClick: () => void
    trailingNode?: React.ReactNode
  }[] = [
    { key: 'editProfile', icon: User, onClick: () => setActivePanel('editProfile') },
    { key: 'emailLogin', icon: Mail, onClick: () => setActivePanel('emailLogin') },
    { key: 'security', icon: Shield, onClick: () => setActivePanel('security') },
    { key: 'billing', icon: CreditCard, onClick: handleBilling },
    {
      key: 'exportData',
      icon: () => exportIcon(),
      onClick: handleExport,
      trailingNode: exportState !== 'idle' ? null : <ChevronRight size={13} className="acct-menu-arrow" />,
    },
    { key: 'helpFeedback', icon: HelpCircle, onClick: () => setActivePanel('helpFeedback') },
  ]

  return (
    <div className="user-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('auth.userInfo')}>
      <div className="user-modal user-modal--account-center" onClick={e => e.stopPropagation()}>

        {activePanel ? (
          /* ── Sub-panel view ── */
          <>
            <div className="acct-subpanel-header">
              <button type="button" className="acct-subpanel-back" onClick={() => setActivePanel(null)}>
                <ArrowLeft size={15} />
                {t('auth.account.backBtn')}
              </button>
              <h2 className="acct-subpanel-title">{subPanelTitleMap[activePanel]}</h2>
              <button type="button" className="user-modal__close acct-subpanel-close" onClick={onClose} aria-label="Close">
                <X size={15} />
              </button>
            </div>

            {activePanel === 'editProfile' && (
              <EditProfilePanel displayName={displayName} email={email} />
            )}
            {activePanel === 'emailLogin' && <EmailLoginPanel email={email} />}
            {activePanel === 'security' && <SecurityPanel />}
            {activePanel === 'helpFeedback' && <HelpFeedbackPanel />}
            {activePanel === 'deleteAccount' && (
              <DeleteAccountPanel email={email} />
            )}
          </>
        ) : (
          /* ── Main account center ── */
          <>
            <button type="button" className="user-modal__close" onClick={onClose} aria-label={t('common.close')}>
              <X size={15} />
            </button>

            {/* Section 1: Profile */}
            <div className="acct-profile">
              <div className="acct-avatar">{initial}</div>
              <div className="acct-name">{displayName}</div>
              {email && <div className="acct-email">{email}</div>}
              <div className="acct-plan-row">
                {isPremium ? (
                  <span className="acct-plan-badge acct-plan-badge--premium">
                    <Crown size={11} />
                    {t('auth.premium')}
                    {expiryLabel && <span className="acct-plan-expiry">· {expiryLabel}</span>}
                  </span>
                ) : (
                  <button type="button" className="acct-plan-badge acct-plan-badge--free" onClick={handleUpgrade} disabled={upgrading}>
                    <Zap size={11} />
                    {t('auth.free')}
                    <span className="acct-plan-upgrade-hint">{upgrading ? '…' : t('auth.upgradePlan')}</span>
                  </button>
                )}
              </div>
              {stats && stats.streak > 1 && (
                <div className="acct-streak-line">
                  <Flame size={13} />
                  {t('auth.account.streakLine', { n: stats.streak })}
                </div>
              )}
            </div>

            {/* Section 2: Weekly Progress */}
            <div className="acct-section">
              <h3 className="acct-section-title">{t('auth.account.section.progress')}</h3>
              <div className="acct-stats-grid">
                <div className="acct-stat">
                  <div className="acct-stat-value">{stats != null ? `${stats.weeklyFocusHours}h` : '—'}</div>
                  <div className="acct-stat-label"><Timer size={11} />{t('auth.account.weeklyFocus')}</div>
                </div>
                <div className="acct-stat">
                  <div className="acct-stat-value">{stats?.weeklyTasks ?? '—'}</div>
                  <div className="acct-stat-label"><CheckSquare size={11} />{t('auth.account.tasksOut')}</div>
                </div>
                <div className="acct-stat">
                  <div className="acct-stat-value">{stats?.streak ?? '—'}</div>
                  <div className="acct-stat-label"><Flame size={11} />{t('auth.account.streakDays')}</div>
                </div>
                <div className="acct-stat">
                  <div className="acct-stat-value">{stats?.notesCount ?? '—'}</div>
                  <div className="acct-stat-label"><FileText size={11} />{t('auth.account.notesOut')}</div>
                </div>
              </div>
              {stats && (
                <div className="acct-level">
                  <div className="acct-level-meta">
                    <span className="acct-level-label">Lv.{stats.level}</span>
                    <span className="acct-level-hint">{t('auth.account.levelNext', { n: stats.sessionsToNextLevel })}</span>
                  </div>
                  <div className="acct-level-track">
                    <div className="acct-level-fill" style={{ width: `${(stats.levelProgress / 5) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Achievements */}
            <div className="acct-section">
              <h3 className="acct-section-title">{t('auth.account.section.achievements')}</h3>
              {recentBadge && (
                <div className="acct-recent-badge">
                  <span className="acct-recent-label">{t('auth.account.recentBadge')}</span>
                  <span className="acct-recent-name">{recentBadge.label}</span>
                </div>
              )}
              {unlockedBadges.length > 0 ? (
                <div className="acct-badges">
                  {unlockedBadges.map(badge => (
                    <span key={badge.key} className="acct-badge-pill">{badge.label}</span>
                  ))}
                </div>
              ) : (
                <p className="acct-badges-empty">{t('auth.account.noBadges')}</p>
              )}
              <button type="button" className="acct-growth-btn" onClick={handleViewGrowth}>
                {t('auth.account.viewGrowth')}
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Section 4: Account & Settings */}
            <div className="acct-section">
              <h3 className="acct-section-title">{t('auth.account.section.settings')}</h3>
              <ul className="acct-menu">
                {settingsItems.map(({ key, icon: Icon, onClick, trailingNode }) => (
                  <li key={key} className="acct-menu-item" onClick={onClick} role="button" tabIndex={0}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}>
                    <span className="acct-menu-icon"><Icon size={14} /></span>
                    <span className="acct-menu-label">
                      {key === 'exportData' ? exportLabel() : t(`auth.account.${key}`)}
                    </span>
                    {trailingNode !== undefined
                      ? trailingNode
                      : <ChevronRight size={13} className="acct-menu-arrow" />}
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 5: Footer */}
            <div className="acct-section acct-section--footer">
              <div className="acct-footer-actions">
                <button type="button" className="acct-footer-btn" onClick={handleSwitchAccount}>
                  {t('auth.account.switchAccount')}
                </button>
                <button type="button" className="acct-footer-btn acct-footer-btn--logout" onClick={handleLogout}>
                  <LogOut size={13} />
                  {t('auth.signOut')}
                </button>
                <button type="button" className="acct-footer-btn acct-footer-btn--danger"
                  onClick={() => setActivePanel('deleteAccount')}>
                  {t('auth.account.deleteAccount')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Sidebar trigger ──────────────────────────────────────────────────────────

const SidebarUserPanel = ({ collapsed }: SidebarUserPanelProps) => {
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const { t } = useI18n()
  const isLoggedIn = useIsLoggedIn()

  if (isLoggedIn) {
    const authState = getAuth()
    const user = authState?.user
    const displayName = user?.name || user?.nickname || user?.email || 'U'
    const initial = displayName[0].toUpperCase()

    return (
      <>
        <button
          type="button"
          className={`sidebar-user-panel sidebar-user-panel--signed-in${collapsed ? ' sidebar-user-panel--collapsed' : ''}${showUserModal ? ' is-open' : ''}`}
          onClick={() => setShowUserModal(true)}
          aria-label={displayName}
        >
          <div className="sidebar-user-panel__avatar">{initial}</div>
          {!collapsed && (
            <div className="sidebar-user-panel__info">
              <div className="sidebar-user-panel__name">{displayName}</div>
            </div>
          )}
        </button>
        {showUserModal && <UserModal onClose={() => setShowUserModal(false)} />}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        className={`sidebar-user-panel sidebar-user-panel--guest${collapsed ? ' sidebar-user-panel--collapsed' : ''}`}
        onClick={() => setShowLoginModal(true)}
        aria-label={t('auth.signIn')}
      >
        <div className="sidebar-user-panel__icon">
          <User size={15} />
        </div>
        {!collapsed && (
          <>
            <span className="sidebar-user-panel__copy">
              <span className="sidebar-user-panel__label">{t('auth.signIn')}</span>
              <span className="sidebar-user-panel__hint">{t('auth.modal.sync.title')}</span>
            </span>
            <span className="sidebar-user-panel__cta" aria-hidden="true">
              <ArrowRight size={14} />
            </span>
          </>
        )}
      </button>
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </>
  )
}

export default SidebarUserPanel
