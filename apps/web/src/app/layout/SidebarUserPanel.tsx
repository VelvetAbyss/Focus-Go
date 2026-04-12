import { useState, useEffect } from 'react'
import {
  User, LogOut, Crown, Zap, X, Timer, FileText, ArrowRight,
  ChevronRight, Flame, CheckSquare, Mail, Shield, CreditCard, Download,
  HelpCircle,
} from 'lucide-react'
import { clearAuth, getAuth, useAuthPlan, useIsLoggedIn, upgradeToPremium } from '../../store/auth'
import { getLogoutUrl } from '../../config/auth'
import { useI18n } from '../../shared/i18n/useI18n'
import LoginModal from './LoginModal'
import { dbService } from '../../data/services/dbService'
import type { FocusSession } from '../../data/models/types'

type SidebarUserPanelProps = {
  collapsed: boolean
}

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

const UserModal = ({ onClose }: { onClose: () => void }) => {
  const { t } = useI18n()
  const plan = useAuthPlan()
  const isPremium = plan === 'premium'
  const authState = getAuth()
  const user = authState?.user
  const expiresAt: string | null = authState?.expiresAt ?? null
  const [stats, setStats] = useState<ExtendedUserStats | null>(null)
  const [upgrading, setUpgrading] = useState(false)

  const displayName = user?.name || user?.nickname || user?.email?.split('@')[0] || 'U'
  const email = user?.email || ''
  const initial = displayName[0].toUpperCase()

  const expiryLabel = (() => {
    if (!expiresAt) return null
    try {
      return new Date(expiresAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return null
    }
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
      const weeklyTasks = tasks
        .filter(t => t.status === 'done' && t.updatedAt >= weekAgo)
        .length

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

  const handleLogout = () => {
    clearAuth()
    window.location.href = getLogoutUrl()
  }

  const handleUpgrade = async () => {
    setUpgrading(true)
    await upgradeToPremium()
    setUpgrading(false)
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

  const settingsItems: { key: 'editProfile' | 'emailLogin' | 'security' | 'billing' | 'exportData' | 'helpFeedback'; icon: typeof User }[] = [
    { key: 'editProfile', icon: User },
    { key: 'emailLogin', icon: Mail },
    { key: 'security', icon: Shield },
    { key: 'billing', icon: CreditCard },
    { key: 'exportData', icon: Download },
    { key: 'helpFeedback', icon: HelpCircle },
  ]

  return (
    <div className="user-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('auth.userInfo')}>
      <div className="user-modal user-modal--account-center" onClick={e => e.stopPropagation()}>
        <button type="button" className="user-modal__close" onClick={onClose} aria-label={t('common.close')}>
          <X size={15} />
        </button>

        {/* ── Section 1: Profile ── */}
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

        {/* ── Section 2: Weekly Progress ── */}
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

        {/* ── Section 3: Achievements ── */}
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
          <button type="button" className="acct-growth-btn" onClick={onClose}>
            {t('auth.account.viewGrowth')}
            <ChevronRight size={13} />
          </button>
        </div>

        {/* ── Section 4: Account & Settings ── */}
        <div className="acct-section">
          <h3 className="acct-section-title">{t('auth.account.section.settings')}</h3>
          <ul className="acct-menu">
            {settingsItems.map(({ key, icon: Icon }) => (
              <li key={key} className="acct-menu-item">
                <span className="acct-menu-icon"><Icon size={14} /></span>
                <span className="acct-menu-label">{t(`auth.account.${key}`)}</span>
                <ChevronRight size={13} className="acct-menu-arrow" />
              </li>
            ))}
          </ul>
        </div>

        {/* ── Section 5: Other ── */}
        <div className="acct-section acct-section--footer">
          <div className="acct-footer-actions">
            <button type="button" className="acct-footer-btn">{t('auth.account.switchAccount')}</button>
            <button type="button" className="acct-footer-btn acct-footer-btn--logout" onClick={handleLogout}>
              <LogOut size={13} />
              {t('auth.signOut')}
            </button>
            <button type="button" className="acct-footer-btn acct-footer-btn--danger">{t('auth.account.deleteAccount')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
