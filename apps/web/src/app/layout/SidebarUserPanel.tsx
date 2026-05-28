import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  User, LogOut, Crown, Zap, X, Timer, FileText, ArrowRight,
  ChevronRight, Flame, CheckSquare, Mail, Shield, CreditCard, Download,
  HelpCircle, ArrowLeft, Check, Loader2, AlertTriangle, Copy,
  Camera, MapPin, Cake, Sparkles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  clearAuth, getAuth, setAuth, useAuthPlan, useIsLoggedIn, upgradeToPremium,
} from '../../store/auth'
import {
  updateProfile, processAvatarFile, useUserProfile,
} from '../../store/userProfile'
import { authClient } from '../../config/authClient'
import { clearLocalUserData } from '../../data/sync/repository'
import { useI18n } from '../../shared/i18n/useI18n'
import { dbService } from '../../data/services/dbService'
import type { FocusSession } from '../../data/models/types'
import { ROUTES } from '../routes/routes'
import { db, requestCrossTabDbReset } from '../../data/db'
import { DB_NAME, DB_VERSION, TABLES } from '../../data/db/schema'

const LoginModal = lazy(() => import('./LoginModal'))

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

const ACCOUNT_ACTION_TIMEOUT_MS = 1200

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const clearLocalUserDataBestEffort = async () => {
  requestCrossTabDbReset()
  try {
    await Promise.race([
      clearLocalUserData(),
      wait(ACCOUNT_ACTION_TIMEOUT_MS),
    ])
  } catch {
    // ignore and continue auth transition
  }
}

const signOutBestEffort = async () => {
  try {
    await authClient.signOut()
  } catch {
    // local logout should still complete if the auth server is unavailable
  }
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

const EditProfilePanel = ({ userId, displayName, email, initial }: {
  userId: string; displayName: string; email: string; initial: string
}) => {
  const { t } = useI18n()
  const profile = useUserProfile(userId)

  const [editName, setEditName] = useState(displayName)
  const [pronouns, setPronouns] = useState(profile.pronouns ?? '')
  const [role, setRole] = useState(profile.role ?? '')
  const [location, setLocation] = useState(profile.location ?? '')
  const [birthday, setBirthday] = useState(profile.birthday ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [avatar, setAvatar] = useState<string | null | undefined>(profile.avatar ?? null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const dirty =
    editName.trim() !== displayName.trim() ||
    (pronouns.trim() || '') !== (profile.pronouns ?? '') ||
    (role.trim() || '') !== (profile.role ?? '') ||
    (location.trim() || '') !== (profile.location ?? '') ||
    (birthday || '') !== (profile.birthday ?? '') ||
    (bio.trim() || '') !== (profile.bio ?? '') ||
    (avatar ?? null) !== (profile.avatar ?? null)

  const handleSave = () => {
    if (saveState !== 'idle' || !dirty) return
    setSaveState('saving')
    const auth = getAuth()
    if (auth?.user) {
      const nextName = editName.trim() || displayName
      setAuth({ ...auth, user: { ...auth.user, name: nextName, nickname: nextName } })
    }
    updateProfile(userId, {
      avatar: avatar ?? '',
      pronouns: pronouns.trim(),
      role: role.trim(),
      location: location.trim(),
      birthday: birthday.trim(),
      bio: bio.trim(),
    })
    setTimeout(() => {
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1800)
    }, 400)
  }

  const handleAvatarPick = async (file: File) => {
    setAvatarError(null)
    setAvatarBusy(true)
    try {
      const dataUrl = await processAvatarFile(file)
      setAvatar(dataUrl)
    } catch (err) {
      const code = (err as Error)?.message || ''
      if (code === 'AVATAR_TOO_LARGE') setAvatarError(t('auth.account.edit.avatarTooLarge'))
      else if (code === 'AVATAR_BAD_TYPE') setAvatarError(t('auth.account.edit.avatarBadType'))
      else setAvatarError(t('auth.account.edit.avatarFailed'))
    } finally {
      setAvatarBusy(false)
    }
  }

  return (
    <div className="acct-subpanel-body acct-edit-body">
      <div className="acct-edit-avatar-row">
        <button
          type="button"
          className="acct-edit-avatar"
          onClick={() => fileInputRef.current?.click()}
          aria-label={t('auth.account.edit.avatarUpload')}
        >
          {avatar
            ? <img src={avatar} alt="" className="acct-edit-avatar-img" />
            : <span className="acct-edit-avatar-initial">{initial}</span>}
          <span className="acct-edit-avatar-overlay">
            {avatarBusy ? <Loader2 size={16} className="acct-spin" /> : <Camera size={16} />}
          </span>
        </button>
        <div className="acct-edit-avatar-meta">
          <div className="acct-edit-avatar-actions">
            <button
              type="button"
              className="acct-edit-avatar-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarBusy}
            >
              <Camera size={12} />
              {t('auth.account.edit.avatarUpload')}
            </button>
            {avatar && (
              <button
                type="button"
                className="acct-edit-avatar-btn acct-edit-avatar-btn--ghost"
                onClick={() => { setAvatar(null); setAvatarError(null) }}
                disabled={avatarBusy}
              >
                {t('auth.account.edit.avatarRemove')}
              </button>
            )}
          </div>
          <p className="acct-edit-avatar-hint">{t('auth.account.edit.avatarHint')}</p>
          {avatarError && <p className="acct-edit-avatar-error">{avatarError}</p>}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) handleAvatarPick(file)
            e.target.value = ''
          }}
        />
      </div>

      <h4 className="acct-edit-section-title">{t('auth.account.edit.sectionIdentity')}</h4>
      <div className="acct-field-grid">
        <div className="acct-field">
          <label className="acct-field-label">{t('auth.account.displayName')}</label>
          <input
            ref={inputRef}
            className="acct-field-input"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            maxLength={40}
          />
        </div>
        <div className="acct-field">
          <label className="acct-field-label">{t('auth.account.edit.pronouns')}</label>
          <input
            className="acct-field-input"
            value={pronouns}
            onChange={e => setPronouns(e.target.value)}
            placeholder={t('auth.account.edit.pronounsPlaceholder')}
            maxLength={16}
          />
        </div>
        <div className="acct-field acct-field--full">
          <label className="acct-field-label">{t('auth.account.edit.role')}</label>
          <input
            className="acct-field-input"
            value={role}
            onChange={e => setRole(e.target.value)}
            placeholder={t('auth.account.edit.rolePlaceholder')}
            maxLength={48}
          />
        </div>
        <div className="acct-field">
          <label className="acct-field-label">{t('auth.account.edit.location')}</label>
          <input
            className="acct-field-input"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder={t('auth.account.edit.locationPlaceholder')}
            maxLength={40}
          />
        </div>
        <div className="acct-field">
          <label className="acct-field-label">{t('auth.account.edit.birthday')}</label>
          <input
            type="date"
            className="acct-field-input"
            value={birthday}
            onChange={e => setBirthday(e.target.value)}
          />
        </div>
      </div>

      <h4 className="acct-edit-section-title">{t('auth.account.edit.sectionAbout')}</h4>
      <div className="acct-field">
        <label className="acct-field-label">{t('auth.account.edit.bio')}</label>
        <textarea
          className="acct-field-input acct-field-textarea"
          value={bio}
          onChange={e => setBio(e.target.value.slice(0, 200))}
          placeholder={t('auth.account.edit.bioPlaceholder')}
          rows={3}
          maxLength={200}
        />
        <div className="acct-field-counter">
          {t('auth.account.edit.bioCount', { n: bio.length })}
        </div>
      </div>

      <div className="acct-field">
        <label className="acct-field-label">{t('auth.account.currentEmail')}</label>
        <div className="acct-field-readonly">{email || '—'}</div>
      </div>

      <button
        type="button"
        className={`acct-save-btn${saveState === 'saved' ? ' acct-save-btn--saved' : ''}`}
        onClick={handleSave}
        disabled={saveState !== 'idle' || !dirty}
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

  return (
    <div className="acct-subpanel-body">
      <div className="acct-info-card">
        <div className="acct-info-row">
          <span className="acct-info-label">{t('auth.account.currentEmail')}</span>
          <span className="acct-info-value">{email || '—'}</span>
        </div>
        <div className="acct-info-row">
          <span className="acct-info-label">{t('auth.account.loginProvider')}</span>
          <span className="acct-info-value">Focus & Go / Google</span>
        </div>
      </div>
      <p className="acct-subpanel-hint">{t('auth.account.providerManaged')}</p>
    </div>
  )
}

// ─── Sub-panel: Account Security ─────────────────────────────────────────────

const SecurityPanel = () => {
  const { language, t } = useI18n()

  return (
    <div className="acct-subpanel-body">
      <div className="acct-info-card">
        <div className="acct-info-row">
          <span className="acct-info-label">{t('auth.account.loginProvider')}</span>
          <span className="acct-info-value">Better Auth</span>
        </div>
        <div className="acct-info-row">
          <span className="acct-info-label">Protocol</span>
          <span className="acct-info-value">Session + Google OAuth</span>
        </div>
      </div>
      <p className="acct-subpanel-hint">
        {language === 'zh'
          ? '密码登录已由 Focus & Go 托管。邮箱验证、手机号验证和设备管理会在后续版本开放。'
          : 'Password sign-in is now managed by Focus & Go. Email verification, phone verification, and device management will arrive later.'}
      </p>
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
    await signOutBestEffort()
    await clearLocalUserData()
    clearAuth()
    window.location.href = '/'
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
  const [accountAction, setAccountAction] = useState<'logout' | 'switch' | null>(null)

  const displayName = user?.name || user?.nickname || user?.email?.split('@')[0] || 'U'
  const email = user?.email || ''
  const initial = displayName[0].toUpperCase()
  const userId: string = user?.id || user?.email || 'guest'
  const profile = useUserProfile(userId)
  const hasMeta = Boolean(profile.pronouns || profile.location)

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
    if (accountAction) return
    setAccountAction('logout')
    await signOutBestEffort()
    await clearLocalUserDataBestEffort()
    clearAuth()
    onClose()
    window.location.href = '/'
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
      const {
        createBackupDownload,
        createBrowserStorageAdapter,
        createTableDatabaseAdapter,
        downloadBackupFile,
        exportLocalBackup,
      } = await import('../../shared/backup/localBackup')
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
    if (accountAction) return
    setAccountAction('switch')
    await signOutBestEffort()
    await clearLocalUserDataBestEffort()
    clearAuth()
    onClose()
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

  return createPortal(
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
              <EditProfilePanel
                userId={userId}
                displayName={displayName}
                email={email}
                initial={initial}
              />
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

            {/* Section 1: Profile hero (two-column on wide) */}
            <div className="acct-profile acct-profile--editorial">
              <button
                type="button"
                className="acct-avatar acct-avatar--clickable"
                onClick={() => setActivePanel('editProfile')}
                aria-label={t('auth.account.edit.avatarUpload')}
              >
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="acct-avatar-img" />
                  : <span>{initial}</span>}
                <span className="acct-avatar-overlay">
                  <Camera size={14} />
                </span>
              </button>
              <div className="acct-profile-text">
                <div className="acct-name">{displayName}</div>
                {profile.role && <div className="acct-role">{profile.role}</div>}
                {(email || hasMeta) && (
                  <div className="acct-meta-row">
                    {email && <span className="acct-meta-item acct-meta-item--email">{email}</span>}
                    {profile.pronouns && (
                      <span className="acct-meta-item">
                        <Sparkles size={11} />
                        {profile.pronouns}
                      </span>
                    )}
                    {profile.location && (
                      <span className="acct-meta-item">
                        <MapPin size={11} />
                        {profile.location}
                      </span>
                    )}
                    {profile.birthday && (
                      <span className="acct-meta-item">
                        <Cake size={11} />
                        {profile.birthday.slice(5)}
                      </span>
                    )}
                  </div>
                )}
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
                  {stats && stats.streak > 1 && (
                    <span className="acct-streak-line acct-streak-line--inline">
                      <Flame size={13} />
                      {t('auth.account.streakLine', { n: stats.streak })}
                    </span>
                  )}
                </div>
                {profile.bio && <p className="acct-bio">{profile.bio}</p>}
              </div>
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
                <button type="button" className="acct-footer-btn" onClick={handleSwitchAccount} disabled={accountAction !== null}>
                  {accountAction === 'switch' ? '…' : t('auth.account.switchAccount')}
                </button>
                <button type="button" className="acct-footer-btn acct-footer-btn--logout" onClick={handleLogout} disabled={accountAction !== null}>
                  <LogOut size={13} />
                  {accountAction === 'logout' ? '…' : t('auth.signOut')}
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
    </div>,
    document.body,
  )
}

// ─── Sidebar trigger ──────────────────────────────────────────────────────────

const SidebarUserTrigger = ({
  collapsed, isOpen, displayName, initial, userId, onClick,
}: {
  collapsed: boolean; isOpen: boolean; displayName: string; initial: string
  userId: string; onClick: () => void
}) => {
  const profile = useUserProfile(userId)
  return (
    <button
      type="button"
      className={`sidebar-user-panel sidebar-user-panel--signed-in${collapsed ? ' sidebar-user-panel--collapsed' : ''}${isOpen ? ' is-open' : ''}`}
      onClick={onClick}
      aria-label={displayName}
    >
      <div className="sidebar-user-panel__avatar">
        {profile.avatar
          ? <img src={profile.avatar} alt="" className="sidebar-user-panel__avatar-img" />
          : initial}
      </div>
      {!collapsed && (
        <div className="sidebar-user-panel__info">
          <div className="sidebar-user-panel__name">{displayName}</div>
        </div>
      )}
    </button>
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
    const userId: string = user?.id || user?.email || 'guest'

    return (
      <>
        <SidebarUserTrigger
          collapsed={collapsed}
          isOpen={showUserModal}
          displayName={displayName}
          initial={initial}
          userId={userId}
          onClick={() => setShowUserModal(true)}
        />
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
      {showLoginModal && (
        <Suspense fallback={null}>
          <LoginModal onClose={() => setShowLoginModal(false)} />
        </Suspense>
      )}
    </>
  )
}

export default SidebarUserPanel
