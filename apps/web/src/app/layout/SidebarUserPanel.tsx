import { useState, useEffect } from 'react'
import { User, LogOut, Crown, Zap, X, CheckSquare, Timer, FileText, BookOpen, Sparkles } from 'lucide-react'
import { clearAuth, getAuth, useAuthPlan, useIsLoggedIn, upgradeToPremium } from '../../store/auth'
import { useI18n } from '../../shared/i18n/useI18n'
import LoginModal from './LoginModal'
import { dbService } from '../../data/services/dbService'

type SidebarUserPanelProps = {
  collapsed: boolean
}

type UserStats = {
  tasksCompleted: number
  focusHours: number
  notesCount: number
  diaryDays: number
}

const UserModal = ({ onClose }: { onClose: () => void }) => {
  const { t } = useI18n()
  const plan = useAuthPlan()
  const isPremium = plan === 'premium'
  const authState = getAuth()
  const user = authState?.user
  const [stats, setStats] = useState<UserStats | null>(null)
  const [upgrading, setUpgrading] = useState(false)

  const displayName = user?.name || user?.nickname || user?.email || 'U'
  const email = user?.email || ''
  const initial = displayName[0].toUpperCase()

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
      const tasksCompleted = tasks.filter((t) => t.status === 'done').length
      const focusMinutes = sessions
        .filter((s) => s.status === 'completed')
        .reduce((sum, s) => sum + (s.actualMinutes ?? 0), 0)
      setStats({
        tasksCompleted,
        focusHours: Math.round((focusMinutes / 60) * 10) / 10,
        notesCount: notes.length,
        diaryDays: diary.length,
      })
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleLogout = () => {
    clearAuth()
    window.location.reload()
  }

  const handleUpgrade = async () => {
    setUpgrading(true)
    await upgradeToPremium()
    setUpgrading(false)
    onClose()
  }

  const statItems = [
    { icon: CheckSquare, label: t('auth.stats.tasks'), value: stats?.tasksCompleted ?? '—' },
    { icon: Timer, label: t('auth.stats.focus'), value: stats != null ? `${stats.focusHours}h` : '—' },
    { icon: FileText, label: t('auth.stats.notes'), value: stats?.notesCount ?? '—' },
    { icon: BookOpen, label: t('auth.stats.diary'), value: stats?.diaryDays ?? '—' },
  ]

  return (
    <div className="user-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('auth.userInfo')}>
      <div className="user-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="user-modal__close" onClick={onClose} aria-label={t('common.close')}>
          <X size={15} />
        </button>

        {/* Identity */}
        <div className="user-modal__avatar">{initial}</div>
        <div className="user-modal__name">{displayName}</div>
        {email && <div className="user-modal__email">{email}</div>}

        <div className="user-modal__badge-row">
          {isPremium ? (
            <span className="user-modal__badge user-modal__badge--premium">
              <Crown size={11} />
              {t('auth.premium')}
            </span>
          ) : (
            <span className="user-modal__badge user-modal__badge--free">
              <Zap size={11} />
              {t('auth.free')}
            </span>
          )}
        </div>

        {/* Stats grid */}
        <div className="user-modal__stats">
          {statItems.map(({ icon: Icon, label, value }) => (
            <div key={label} className="user-modal__stat">
              <div className="user-modal__stat-value">{value}</div>
              <div className="user-modal__stat-label">
                <Icon size={11} />
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        {!isPremium && (
          <button type="button" className="user-modal__upgrade" onClick={handleUpgrade} disabled={upgrading}>
            <Sparkles size={14} />
            {upgrading ? '…' : t('auth.upgradePlan')}
          </button>
        )}

        <button type="button" className="user-modal__logout" onClick={handleLogout}>
          <LogOut size={13} />
          {t('auth.signOut')}
        </button>
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
        {!collapsed && <span className="sidebar-user-panel__label">{t('auth.signIn')}</span>}
      </button>
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </>
  )
}

export default SidebarUserPanel
