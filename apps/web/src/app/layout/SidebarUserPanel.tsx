import { PolicyNotice } from '../../shared/legal/PolicyNotice'
import { lazy, Suspense, useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import {
  User, LogOut, Crown, X, Timer, FileText, ArrowRight,
  ChevronRight, Flame, CheckSquare, Mail, Shield, Download, Heart, Settings,
  HelpCircle, ArrowLeft, Check, Loader2, Copy,
  Camera,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { clearAuth, getAuth, subscribeAuth, useIsLoggedIn } from '../../store/auth'
import {
  clearAccountProfile, saveAccountProfile, syncAccountProfile, startAccountProfileSync, useProfileSaveState, processAvatarFile, useUserProfile,
} from '../../store/userProfile'
import { authClient } from '../../config/authClient'
import { getPlatform } from '../../platform'
import { clearLocalUserData } from '../../data/sync/repository'
import { useI18n } from '../../shared/i18n/useI18n'
import { dbService } from '../../data/services/dbService'
import type { FocusSession } from '../../data/models/types'
import { db, requestCrossTabDbReset } from '../../data/db'
import { DB_NAME, DB_VERSION, TABLES } from '../../data/db/schema'
import { ROUTES } from '../routes/routes'

import { EmailLoginPanel, SecurityPanel, DeleteAccountPanel } from './AccountSecurityPanels'
import { useAccountCopy } from './accountCopy'

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
  | 'growth'
  | 'data'

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
  // Desktop: drop the persisted keychain token so the next launch is logged out.
  await getPlatform().clearAuthToken()
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

const EditProfilePanel = ({ userId, displayName, email, initial, onDirtyChange }: {
  userId: string; displayName: string; email: string; initial: string; onDirtyChange: (dirty: boolean) => void
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
  const saveState = useProfileSaveState(userId)
  const copy = useAccountCopy()
  const touched = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const baseline = useRef({ name: displayName, avatar: profile.avatar ?? null, pronouns: profile.pronouns ?? '', role: profile.role ?? '', location: profile.location ?? '', birthday: profile.birthday ?? '', bio: profile.bio ?? '' })
  const currentFields = { name: editName.trim(), avatar: avatar ?? null, pronouns: pronouns.trim(), role: role.trim(), location: location.trim(), birthday, bio: bio.trim() }
  const dirty = Object.entries(currentFields).some(([key, value]) => value !== baseline.current[key as keyof typeof currentFields])

  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false) }, [dirty, onDirtyChange])
  useEffect(() => {
    if (touched.current) return
    baseline.current = { name: displayName, avatar: profile.avatar ?? null, pronouns: profile.pronouns ?? '', role: profile.role ?? '', location: profile.location ?? '', birthday: profile.birthday ?? '', bio: profile.bio ?? '' }
    setEditName(displayName)
    setPronouns(profile.pronouns ?? '')
    setRole(profile.role ?? '')
    setLocation(profile.location ?? '')
    setBirthday(profile.birthday ?? '')
    setBio(profile.bio ?? '')
    setAvatar(profile.avatar ?? null)
  }, [displayName, profile])

  const handleSave = () => {
    if (!dirty || !editName.trim()) return
    const next = { name: editName.trim(), avatar: avatar ?? null, pronouns: pronouns.trim(), role: role.trim(), location: location.trim(), birthday, bio: bio.trim() }
    const previous = baseline.current
    const patch = Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== previous[key as keyof typeof previous]))
    try {
      saveAccountProfile(userId, patch)
      baseline.current = next
      touched.current = false
      setAvatarError(null)
    } catch { setAvatarError(copy('localSaveFailed')) }
  }

  const handleAvatarPick = async (file: File) => {
    setAvatarError(null)
    setAvatarBusy(true)
    try {
      const dataUrl = await processAvatarFile(file)
      touched.current = true
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
    <div className="acct-subpanel-body acct-edit-body" onChangeCapture={() => { touched.current = true }}>
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
                onClick={() => { touched.current = true; setAvatar(null); setAvatarError(null) }}
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
          <label className="acct-field-label" htmlFor="account-editName">{t('auth.account.displayName')}</label>
          <input
            ref={inputRef}
            className="acct-field-input"
            id="account-editName"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            maxLength={40}
          />
        </div>
        <div className="acct-field">
          <label className="acct-field-label" htmlFor="account-pronouns">{t('auth.account.edit.pronouns')}</label>
          <input
            className="acct-field-input"
            id="account-pronouns"
            value={pronouns}
            onChange={e => setPronouns(e.target.value)}
            placeholder={t('auth.account.edit.pronounsPlaceholder')}
            maxLength={16}
          />
        </div>
        <div className="acct-field acct-field--full">
          <label className="acct-field-label" htmlFor="account-role">{t('auth.account.edit.role')}</label>
          <input
            className="acct-field-input"
            id="account-role"
            value={role}
            onChange={e => setRole(e.target.value)}
            placeholder={t('auth.account.edit.rolePlaceholder')}
            maxLength={48}
          />
        </div>
        <div className="acct-field">
          <label className="acct-field-label" htmlFor="account-location">{t('auth.account.edit.location')}</label>
          <input
            className="acct-field-input"
            id="account-location"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder={t('auth.account.edit.locationPlaceholder')}
            maxLength={40}
          />
        </div>
        <div className="acct-field">
          <label className="acct-field-label" htmlFor="account-birthday">{t('auth.account.edit.birthday')}</label>
          <input
            type="date"
            className="acct-field-input"
            id="account-birthday"
            value={birthday}
            onChange={e => setBirthday(e.target.value)}
          />
        </div>
      </div>

      <h4 className="acct-edit-section-title">{t('auth.account.edit.sectionAbout')}</h4>
      <div className="acct-field">
        <label className="acct-field-label" htmlFor="account-bio">{t('auth.account.edit.bio')}</label>
        <textarea
          className="acct-field-input acct-field-textarea"
          id="account-bio"
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
        className="acct-save-btn"
        onClick={handleSave}
        disabled={!dirty || !editName.trim() || avatarBusy}
      >
        {t('auth.account.saveChanges')}
      </button>
      {!editName.trim() && <p role="alert">{copy('nameRequired')}</p>}
      <p className="acct-subpanel-hint" role="status">{copy(saveState)}</p>
      {(saveState === 'error' || saveState === 'pending') && <button className="acct-help-btn" type="button" onClick={() => void syncAccountProfile(userId)}>{copy('retry')}</button>}
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

// ─── Main UserModal ───────────────────────────────────────────────────────────

const UserModal = ({ onClose }: { onClose: () => void }) => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const authState = getAuth()
  const user = authState?.user
  const [stats, setStats] = useState<ExtendedUserStats | null>(null)
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const [exportState, setExportState] = useState<'idle' | 'exporting' | 'done'>('idle')
  const [accountAction, setAccountAction] = useState<'logout' | 'switch' | null>(null)

  const displayName = user?.name || user?.nickname || user?.email?.split('@')[0] || 'U'
  const email = user?.email || ''
  const initial = displayName[0].toUpperCase()
  const userId: string = user?.id || user?.email || 'guest'
  const profile = useUserProfile(userId)
  const copy = useAccountCopy()
  const saveState = useProfileSaveState(userId)
  const [profileDirty, setProfileDirty] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const close = () => { if (!profileDirty || window.confirm(copy('unsaved'))) onClose() }
  const changePanel = (panel: ActivePanel) => { if (!profileDirty || window.confirm(copy('unsaved'))) { setProfileDirty(false); setActivePanel(panel) } }
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    modalRef.current?.querySelector<HTMLElement>('button')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current() }
      if (event.key !== 'Tab') return
      const items = Array.from(modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []).filter(item => item.getClientRects().length > 0)
      const first = items[0], last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown, true)
    void syncAccountProfile(userId)
    return () => { document.removeEventListener('keydown', keydown, true); previous?.focus() }
  }, [userId])

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

  const handleSupport = () => {
    navigate(ROUTES.SUPPORT)
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
    deleteAccount: copy('deleteTitle'),
    growth: copy('growth'),
    data: copy('data'),
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

  const navigation = [
    { key: 'editProfile' as const, label: t('auth.account.panel.editProfile'), icon: User },
    { key: 'emailLogin' as const, label: t('auth.account.panel.emailLogin'), icon: Mail },
    { key: 'security' as const, label: t('auth.account.panel.security'), icon: Shield },
    { key: 'data' as const, label: copy('data'), icon: Download },
  ]
  const finishDeletion = async () => {
    await clearLocalUserDataBestEffort()
    try { await getPlatform().clearAuthToken() } finally {
      clearAuth()
      try { clearAccountProfile(userId) } catch { /* Continue signing out if browser storage is unavailable. */ }
      onClose()
      window.location.href = '/'
    }
  }

  return createPortal(
    <div className="user-modal-backdrop" onClick={close}>
      <div ref={modalRef} className={`user-modal user-modal--account-center acct-center-v2${activePanel ? '' : ' acct-center-v2--menu'}`} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="account-dialog-title">
        <div className="acct-subpanel-header">
          {activePanel && <button type="button" className="acct-subpanel-back" onClick={() => changePanel(null)}><ArrowLeft size={15} />{t('auth.account.backBtn')}</button>}
          <h2 id="account-dialog-title" className="acct-subpanel-title">{activePanel ? subPanelTitleMap[activePanel] : displayName}</h2>
          <button type="button" className="user-modal__close acct-subpanel-close" onClick={close} aria-label={t('common.close')}><X size={15} /></button>
        </div>
        {activePanel ? <div className="acct-center-layout">
          {navigation.some(item => item.key === activePanel) || activePanel === 'deleteAccount' ? <nav className="acct-center-nav" aria-label={copy('settings')}>
            {navigation.map(({ key, label, icon: Icon }) => <button key={key} type="button" aria-current={activePanel === key ? 'page' : undefined} onClick={() => changePanel(key)}><Icon size={15} />{label}</button>)}
          </nav> : null}
          <div className="acct-center-content" key={activePanel}>
            {activePanel === 'editProfile' && <EditProfilePanel userId={userId} displayName={displayName} email={email} initial={initial} onDirtyChange={setProfileDirty} />}
            {activePanel === 'emailLogin' && <EmailLoginPanel email={email} />}
            {activePanel === 'security' && <SecurityPanel />}
            {activePanel === 'helpFeedback' && <HelpFeedbackPanel />}
            {activePanel === 'deleteAccount' && <DeleteAccountPanel email={email} onDeleted={finishDeletion} />}
            {activePanel === 'data' && <div className="acct-subpanel-body">
              <p className="acct-subpanel-hint">{copy('dataHint')}</p>
              <button type="button" className="acct-help-btn" onClick={handleExport} disabled={exportState === 'exporting'}>{exportIcon()}{exportLabel()}</button>
              <hr />
              <button type="button" className="acct-footer-btn acct-footer-btn--danger" onClick={() => changePanel('deleteAccount')}>{copy('deleteTitle')}<ChevronRight size={14} /></button>
            </div>}
            {activePanel === 'growth' && <>
            {/* Section 2: Weekly Progress */}
            <div className="acct-section">
              <h3 className="acct-section-title">{copy('recentDays')}</h3>
              <div className="acct-stats-grid">
                <div className="acct-stat">
                  <div className="acct-stat-value">{stats != null ? `${stats.weeklyFocusHours}h` : '—'}</div>
                  <div className="acct-stat-label"><Timer size={11} />{copy('focusHours')}</div>
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
                  <div className="acct-stat-label"><FileText size={11} />{copy('totalNotes')}</div>
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
                  <span className="acct-recent-label">{copy('earned')}</span>
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

            </>}
          </div>
        </div> : <>
          <div className="acct-menu-profile">
            <button type="button" className="acct-avatar acct-avatar--clickable" onClick={() => changePanel('editProfile')} aria-label={t('auth.account.panel.editProfile')}>
              {profile.avatar ? <img src={profile.avatar} alt="" className="acct-avatar-img" /> : <span>{initial}</span>}
            </button>
            <div><p>{email}</p><span className="acct-plan-badge">{authState?.isSupporter ? <><Crown size={11} /> Early supporter</> : 'Free for everyone'}</span></div>
          </div>
          <p className="acct-menu-sync" role="status">{copy(saveState)}</p>
          <div className="acct-quick-menu">
            <button type="button" onClick={() => changePanel('editProfile')}><User size={16} />{copy('settings')}<ChevronRight size={14} /></button>
            <button type="button" onClick={() => changePanel('growth')}><Flame size={16} />{copy('growth')}<ChevronRight size={14} /></button>
            <button type="button" onClick={() => { navigate(ROUTES.SETTINGS); onClose() }}><Settings size={16} />{copy('preferences')}<ChevronRight size={14} /></button>
            <button type="button" onClick={handleSupport}><Heart size={16} />{t('auth.account.support')}<ChevronRight size={14} /></button>
            <button type="button" onClick={() => changePanel('helpFeedback')}><HelpCircle size={16} />{t('auth.account.helpFeedback')}<ChevronRight size={14} /></button>
          </div>
          <div className="acct-section acct-section--footer"><div className="acct-footer-actions">
            <button type="button" className="acct-footer-btn" onClick={handleSwitchAccount} disabled={accountAction !== null}>{accountAction === 'switch' ? '…' : t('auth.account.switchAccount')}</button>
            <button type="button" className="acct-footer-btn acct-footer-btn--logout" onClick={handleLogout} disabled={accountAction !== null}><LogOut size={13} />{accountAction === 'logout' ? '…' : t('auth.signOut')}</button>
          </div></div>
        </>}
      </div>
    </div>, document.body,
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
  const authSnapshot = useSyncExternalStore(subscribeAuth, () => JSON.stringify(getAuth()?.user ?? null), () => 'null')
  const accountId = (JSON.parse(authSnapshot) as { id?: string } | null)?.id
  useEffect(() => accountId ? startAccountProfileSync(accountId) : undefined, [accountId])

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
        <PolicyNotice key={userId} userId={userId} />
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
