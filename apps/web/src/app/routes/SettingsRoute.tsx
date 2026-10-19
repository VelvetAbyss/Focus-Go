import { LEGAL_DOCUMENTS, policyUrl, type LegalDocument, type LegalDocumentKey } from '../../shared/legal/policies'
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  Brush,
  CheckCircle2,
  Database,
  KeyRound,
  LayoutGrid,
  LocateFixed,
  Scale,
  Shield,
  Sparkles,
  SunMedium,
  Waves,
  AlertTriangle,
  BellRing,
  Clock3,
  Lightbulb,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { fetchApi } from '../../shared/apiBase'
import { pauseSymbolicSyncForReset, resumeSymbolicSyncAfterResetFailure } from '../../features/symbolic/sync'
import { dashboardRepo } from '../../data/repositories/dashboardRepo'
import { db, requestCrossTabDbReset } from '../../data/db'
import { DB_NAME, DB_VERSION, TABLES } from '../../data/db/schema'
import { applyTheme, readStoredThemePreference, resolveTheme, subscribeTheme, writeStoredThemePreference } from '../../shared/theme/theme'
import {
  applyThemePackPreview,
  clearThemePackPreview,
  THEME_BEFORE_MODE_TOGGLE_EVENT,
  type ThemePackId,
} from '../../shared/theme/themePack'
import type { DashboardLayout } from '../../data/models/types'
import { usePreferences } from '../../shared/prefs/usePreferences'
import InteractionSoundSettings from './InteractionSoundSettings'
import {
  disableWebPush,
  enableWebPush,
  fetchWebPushConfig,
  isWebPushSupported,
  readWebPushEnabled,
  sendWebPushTest,
} from '../../shared/push/webPush'
import { useI18n } from '../../shared/i18n/useI18n'
import type { LanguageCode } from '../../shared/i18n/types'
import { useToast } from '../../shared/ui/toast/toast'
import {
  createBackupDownload,
  createBrowserStorageAdapter,
  createTableDatabaseAdapter,
  downloadBackupFile,
  exportLocalBackup,
  importLocalBackup,
  readBackupFile,
  type ParsedLocalBackup,
} from '../../shared/backup/localBackup'
import { BACKUP_SUMMARY_KINDS, countLocalData, summarizeBackup, type BackupCounts } from '../../shared/backup/backupSummary'
import { useSyncActions, useSyncStatus } from '../../data/sync/service'
import { restampLocalSnapshotForRestore } from '../../data/sync/repository'
import { requestRxdbSyncReset, resetRxdbSyncDatabase } from '../../data/sync/rxdb'
import { wipeServerData } from '../../data/sync/wipeServerData'
import { listSyncConflicts, markSyncConflictReviewed, restoreNoteConflictAsCopy, type SyncConflictRecord } from '../../data/sync/conflicts'
import { getAuth, useCloudSyncQuota, useIsLoggedIn } from '../../store/auth'
import { buildNoteDetailRoute, ROUTES } from './routes'
import { useDiscoveryReset } from '../../shared/discovery/useDiscoveryHint'
import { useAuthGate } from '../../features/auth/AuthGateContext'
import {
  buildLocalSuggestions,
  MAX_CITY_SUGGESTIONS,
  MIN_CITY_QUERY_LENGTH,
  normalizeQuery,
  searchRemoteCitySuggestions,
  type CitySuggestion,
} from '../../shared/location/citySuggestions'
import { readLayoutLocked, writeLayoutLocked } from '../../shared/prefs/dashboardLayoutLock'
import { readAutoPageEnabled, writeAutoPageEnabled } from '../../features/dashboard/autoPage'
import { syncedPreferencesRepo, SYNCED_PREFERENCES_UPDATED_EVENT } from '../../data/repositories/syncedPreferencesRepo'
import AmbientSettingsSection from './AmbientSettingsSection'
import {
  clearPersonalApiKey,
  readPersonalApiKey,
  writePersonalApiKey,
  type PersonalApiKeyService,
} from '../../shared/integrations/personalApiKeys'

const LoginModal = lazy(() => import('../layout/LoginModal'))
import { appIntlLocale } from '../../shared/i18n/format'
import ActiveIndicator from '../../shared/motion/ActiveIndicator'
import { DURATION, EASE } from '../../shared/motion/tokens'
const RESET_TIMEOUT_MS = 30_000

const conflictPreview = (document: Record<string, unknown>, entityType: string) => {
  if (entityType === 'notes') {
    const title = typeof document.title === 'string' ? document.title : ''
    const body = typeof document.contentMd === 'string' ? document.contentMd : ''
    return [title, body].filter(Boolean).join('\n\n') || JSON.stringify(document, null, 2)
  }
  if (entityType === 'tasks') {
    const fields = ['title', 'description', 'status', 'priority', 'dueDate', 'taskNoteContentMd']
    return fields.filter((field) => document[field] != null && document[field] !== '')
      .map((field) => `${field}: ${String(document[field])}`).join('\n') || JSON.stringify(document, null, 2)
  }
  return JSON.stringify(document, null, 2)
}

type ThemeSelection = 'system' | 'light' | 'dark'
type SettingsSection = 'appearance' | 'experience' | 'weather' | 'integrations' | 'data' | 'legal' | 'feedback'
type BaseSettingsSection = Exclude<SettingsSection, 'legal'>


const SECTION_META_KEYS: Array<{
  key: SettingsSection
  titleKey:
    | 'settings.module.appearance.title'
    | 'settings.module.experience.title'
    | 'settings.module.weather.title'
    | 'settings.module.integrations.title'
    | 'settings.module.data.title'
    | 'settings.module.legal.title'
    | 'settings.module.feedback.title'
  hintKey:
    | 'settings.module.appearance.hint'
    | 'settings.module.experience.hint'
    | 'settings.module.weather.hint'
    | 'settings.module.integrations.hint'
    | 'settings.module.data.hint'
    | 'settings.module.legal.hint'
    | 'settings.module.feedback.hint'
  icon: typeof Brush
  badgeKey:
    | 'settings.badge.visual'
    | 'settings.badge.motion'
    | 'settings.badge.widget'
    | 'settings.badge.private'
    | 'settings.badge.safety'
    | 'settings.badge.legal'
    | 'settings.badge.feedback'
}> = [
  { key: 'appearance', titleKey: 'settings.module.appearance.title', hintKey: 'settings.module.appearance.hint', icon: Brush, badgeKey: 'settings.badge.visual' },
  { key: 'experience', titleKey: 'settings.module.experience.title', hintKey: 'settings.module.experience.hint', icon: Sparkles, badgeKey: 'settings.badge.motion' },
  { key: 'weather', titleKey: 'settings.module.weather.title', hintKey: 'settings.module.weather.hint', icon: SunMedium, badgeKey: 'settings.badge.widget' },
  { key: 'integrations', titleKey: 'settings.module.integrations.title', hintKey: 'settings.module.integrations.hint', icon: KeyRound, badgeKey: 'settings.badge.private' },
  { key: 'data', titleKey: 'settings.module.data.title', hintKey: 'settings.module.data.hint', icon: Database, badgeKey: 'settings.badge.safety' },
  { key: 'legal', titleKey: 'settings.module.legal.title', hintKey: 'settings.module.legal.hint', icon: Shield, badgeKey: 'settings.badge.legal' },
  { key: 'feedback', titleKey: 'settings.module.feedback.title', hintKey: 'settings.module.feedback.hint', icon: Bell, badgeKey: 'settings.badge.feedback' },
]

const LEGAL_ROOT_PATH = `${ROUTES.SETTINGS}/legal`


const FEEDBACK_TYPES = ['feature_request', 'bug', 'confusion', 'praise'] as const
type FeedbackType = (typeof FEEDBACK_TYPES)[number]

const FeedbackForm = () => {
  const { t } = useI18n()
  const [fbType, setFbType] = useState<FeedbackType>('feature_request')
  const [fbTitle, setFbTitle] = useState('')
  const [fbBody, setFbBody] = useState('')
  const [fbEmail, setFbEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setFbTitle('')
    setFbBody('')
    setFbEmail('')
    setFbType('feature_request')
    setSubmitted(false)
    setError(null)
  }

  const submit = async () => {
    if (!fbTitle.trim()) { setError(t('settings.feedback.error.title.required')); return }
    if (!fbBody.trim()) { setError(t('settings.feedback.error.body.required')); return }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetchApi('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: fbType,
          title: fbTitle.trim(),
          body: fbBody.trim(),
          email: fbEmail.trim() || undefined,
          pageContext: typeof window !== 'undefined' ? window.location.pathname : undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      setSubmitted(true)
    } catch {
      setError(t('settings.feedback.error.generic'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <motion.div
        className="flex flex-col items-center gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_90%,transparent)] p-8 text-center text-[var(--text-primary)] shadow-sm dark:border-white/10 dark:bg-background/50 dark:text-foreground"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: DURATION.medium, ease: EASE.emphasized }}
      >
        <CheckCircle2 className="h-10 w-10 text-[color:var(--accent)]" />
        <div className="space-y-1">
          <h3 className="text-base font-semibold">{t('settings.feedback.success.title')}</h3>
          <p className="text-sm text-[color-mix(in_srgb,var(--text-primary)_68%,transparent)] dark:text-muted-foreground">{t('settings.feedback.success.body')}</p>
        </div>
        <Button type="button" variant="outline" onClick={reset}>
          {t('settings.feedback.success.again')}
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="space-y-5 rounded-2xl border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_90%,transparent)] p-6 text-[var(--text-primary)] shadow-sm dark:border-white/10 dark:bg-background/50 dark:text-foreground"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE.emphasized }}
    >
      <div>
        <h2 className="type-section-title">{t('settings.feedback.title')}</h2>
        <p className="mt-1 text-sm leading-6 text-[color-mix(in_srgb,var(--text-primary)_68%,transparent)] dark:text-muted-foreground">{t('settings.feedback.description')}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[var(--tracking-caps)] text-[var(--text-tertiary)] dark:text-muted-foreground">
            {t('settings.feedback.type.label')}
          </label>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFbType(type)}
                className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                  fbType === type
                    ? 'border-[color-mix(in_srgb,var(--text-primary)_60%,transparent)] bg-[var(--text-primary)] text-[var(--bg-elevated)] dark:border-white/60 dark:bg-white dark:text-background'
                    : 'border-[color-mix(in_srgb,var(--text-primary)_14%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_60%,transparent)] text-[color-mix(in_srgb,var(--text-primary)_72%,transparent)] hover:border-[color-mix(in_srgb,var(--text-primary)_28%,transparent)] dark:border-white/14 dark:bg-white/10 dark:text-foreground/72'
                }`}
              >
                {t(`settings.feedback.type.${type}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[var(--tracking-caps)] text-[var(--text-tertiary)] dark:text-muted-foreground">
            {t('settings.feedback.title.label')}
          </label>
          <Input
            value={fbTitle}
            onChange={(e) => { setFbTitle(e.target.value); setError(null) }}
            placeholder={t('settings.feedback.title.placeholder')}
            maxLength={200}
            className="border-[color-mix(in_srgb,var(--text-primary)_14%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] dark:bg-white/10"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[var(--tracking-caps)] text-[var(--text-tertiary)] dark:text-muted-foreground">
            {t('settings.feedback.body.label')}
          </label>
          <textarea
            value={fbBody}
            onChange={(e) => { setFbBody(e.target.value); setError(null) }}
            placeholder={t('settings.feedback.body.placeholder')}
            maxLength={5000}
            rows={5}
            className="w-full resize-y rounded-md border border-[color-mix(in_srgb,var(--text-primary)_14%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[color-mix(in_srgb,var(--text-primary)_38%,transparent)] outline-none transition focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] dark:border-white/14 dark:bg-white/10 dark:text-foreground dark:placeholder-white/38"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[var(--tracking-caps)] text-[var(--text-tertiary)] dark:text-muted-foreground">
            {t('settings.feedback.email.label')}
          </label>
          <Input
            type="email"
            value={fbEmail}
            onChange={(e) => setFbEmail(e.target.value)}
            placeholder={t('settings.feedback.email.placeholder')}
            className="border-[color-mix(in_srgb,var(--text-primary)_14%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] dark:bg-white/10"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button
          type="button"
          disabled={submitting}
          onClick={() => void submit()}
          className="w-full sm:w-auto"
        >
          {submitting ? t('settings.feedback.submitting') : t('settings.feedback.submit')}
        </Button>
      </div>
    </motion.div>
  )
}

type SettingRowProps = {
  icon: typeof Brush
  title: string
  description: string
  children: ReactNode
}

const DesktopNotificationRow = () => {
  const { t } = useI18n()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission
  })

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
    } catch (error) {
      console.warn('[Settings] notification permission request failed', error)
    }
  }

  let content: ReactNode
  if (permission === 'unsupported') {
    content = <span className="text-xs text-muted-foreground">—</span>
  } else if (permission === 'granted') {
    content = <span className="text-xs font-semibold text-tone-done">✓</span>
  } else if (permission === 'denied') {
    content = (
      <span className="text-xs text-tone-urgent">{t('tasks.reminder.desktopBlocked')}</span>
    )
  } else {
    content = (
      <Button variant="outline" size="sm" onClick={() => void requestPermission()}>
        {t('tasks.reminder.enableDesktopButton')}
      </Button>
    )
  }

  return (
    <SettingRow
      icon={Bell}
      title={t('tasks.reminder.enableDesktopTitle')}
      description={t('tasks.reminder.enableDesktopHint')}
    >
      {content}
    </SettingRow>
  )
}

/** Server-sent reminders for this device (Web Push), for when every tab is closed. */
const WebPushRow = () => {
  const { t, language } = useI18n()
  const { taskReminderEnabled, taskReminderLeadMinutes } = usePreferences()
  const isLoggedIn = useIsLoggedIn()
  const supported = isWebPushSupported()
  const [enabled, setEnabled] = useState(readWebPushEnabled)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    void Promise.all([navigator.serviceWorker.getRegistration().catch(() => undefined), fetchWebPushConfig()]).then(([registration, config]) => {
      if (!cancelled) setAvailable(Boolean(registration) && config.enabled)
    })
    return () => {
      cancelled = true
    }
  }, [supported])

  // Turning reminders off elsewhere turns this off too (useWebPushLifecycle).
  useEffect(() => {
    if (!taskReminderEnabled) setEnabled(false)
  }, [taskReminderEnabled])

  const blockedReason = !supported
    ? t('settings.webPush.unsupported')
    : !isLoggedIn
      ? t('settings.webPush.signIn')
      : !taskReminderEnabled
        ? t('settings.webPush.needsReminders')
        : available === false
          ? t('settings.webPush.unavailable')
          : null

  const handleToggle = async (checked: boolean) => {
    setBusy(true)
    setNote(null)
    try {
      if (!checked) {
        await disableWebPush()
        setEnabled(false)
        return
      }
      const result = await enableWebPush({ leadMinutes: taskReminderLeadMinutes, language })
      setEnabled(result === 'on')
      if (result === 'denied') setNote(t('settings.webPush.denied'))
      else if (result === 'unavailable') setAvailable(false)
      else if (result === 'failed') setNote(t('settings.webPush.failed'))
      else if (result === 'signed-out') setNote(t('settings.webPush.signIn'))
      else if (result === 'update-needed') setNote(t('settings.webPush.updateNeeded'))
    } finally {
      setBusy(false)
    }
  }

  const handleTest = async () => {
    setBusy(true)
    const ok = await sendWebPushTest()
    setNote(ok ? t('settings.webPush.testSent') : t('settings.webPush.testFailed'))
    setBusy(false)
  }

  return (
    <SettingRow
      icon={BellRing}
      title={t('settings.webPush.title')}
      description={note ?? blockedReason ?? t('settings.webPush.description')}
    >
      <div className="flex items-center gap-2">
        {enabled && !blockedReason ? (
          <Button variant="outline" size="sm" onClick={() => void handleTest()} disabled={busy}>
            {t('settings.webPush.test')}
          </Button>
        ) : null}
        <Switch
          checked={enabled && !blockedReason}
          disabled={busy || Boolean(blockedReason) || available === null}
          onCheckedChange={(checked) => void handleToggle(checked)}
          aria-label={t('settings.webPush.title')}
        />
      </div>
    </SettingRow>
  )
}

const SettingRow = ({ icon: Icon, title, description, children }: SettingRowProps) => (
  <motion.div
    layout
    className="grid gap-4 rounded-xl bg-background/40 p-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
    initial={{ opacity: 0, y: 18, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: DURATION.slow, ease: EASE.emphasized }}
    whileHover={{ y: -2 }}
  >
    <div className="flex gap-3">
      <div className="mt-0.5 rounded-md border border-border/80 bg-muted/60 p-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="space-y-1">
        <h3 className="type-label text-foreground">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
    <div className="w-full lg:w-auto lg:justify-self-end">{children}</div>
  </motion.div>
)

const LegalEntryCard = ({
  icon: Icon,
  title,
  summary,
  onClick,
}: {
  icon: typeof Shield
  title: string
  summary: string
  onClick: () => void
}) => (
  <motion.button
    type="button"
    data-auth-preview-allowed="true"
    onClick={onClick}
    className="w-full rounded-2xl border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_90%,transparent)] p-5 text-left text-[var(--text-primary)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-background/50 dark:text-foreground"
    initial={{ opacity: 0, y: 18, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: DURATION.slow, ease: EASE.emphasized }}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] text-[var(--text-primary)] dark:border-white/10 dark:bg-white/10 dark:text-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-[color-mix(in_srgb,var(--text-primary)_72%,transparent)] dark:text-muted-foreground">{summary}</p>
        </div>
      </div>
      <ArrowLeft className="h-4 w-4 rotate-180 text-[color-mix(in_srgb,var(--text-primary)_48%,transparent)] dark:text-muted-foreground" />
    </div>
  </motion.button>
)

const LegalDocumentView = ({
  title,
  summary,
  updatedAt,
  sections,
  backLabel,
  onBack,
}: LegalDocument & {
  backLabel: string
  onBack: () => void
}) => (
  <motion.div
    className="space-y-5"
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: DURATION.slow, ease: EASE.emphasized }}
  >
    <div className="sticky top-0 z-10 pb-1">
      <Button
        type="button"
        variant="outline"
        className="rounded-full border-[color-mix(in_srgb,var(--text-primary)_12%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] dark:border-white/10 dark:bg-background/40 dark:text-foreground"
        onClick={onBack}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {backLabel}
      </Button>
    </div>

    <div className="rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] p-6 text-[var(--text-primary)] shadow-lg dark:border-white/10 dark:bg-background/50 dark:text-foreground">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[var(--tracking-caps)] text-[var(--text-tertiary)] dark:text-muted-foreground">Focus&go</p>
          <h2 className="type-section-title">{title}</h2>
          <p className="max-w-2xl text-sm leading-7 text-[color-mix(in_srgb,var(--text-primary)_72%,transparent)] dark:text-muted-foreground">{summary}</p>
          <div className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] px-3 py-1 text-xs text-[color-mix(in_srgb,var(--text-primary)_72%,transparent)] dark:border-white/10 dark:bg-white/10 dark:text-muted-foreground">
            {updatedAt}
          </div>
        </div>

        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h3 className="type-section-title">{section.heading}</h3>
              <div className="space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-[color-mix(in_srgb,var(--text-primary)_78%,transparent)] dark:text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  </motion.div>
)

const SettingsRoute = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { language, t } = useI18n()
  const { requireAuth, isGated } = useAuthGate()
  const isLoggedIn = useIsLoggedIn()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const cloudSyncQuota = useCloudSyncQuota()
  const toast = useToast()
  const syncState = useSyncStatus()
  const [syncConflicts, setSyncConflicts] = useState<SyncConflictRecord[]>([])
  const [restoringConflictId, setRestoringConflictId] = useState<string | null>(null)
  const { enabled: cloudSyncEnabled, setEnabled: setCloudSyncEnabled, syncNow } = useSyncActions()
  const [activeSection, setActiveSection] = useState<BaseSettingsSection>(() => location.hash === '#sounds' ? 'experience' : 'appearance')
  const [layoutLocked, setLayoutLocked] = useState(() => readLayoutLocked())
  const [autoPage, setAutoPage] = useState(() => readAutoPageEnabled())
  const [theme, setTheme] = useState<ThemeSelection>('system')
  const [themePackSelection, setThemePackSelection] = useState<ThemePackId>('theme-a')
  const [themePackPreview, setThemePackPreview] = useState<ThemePackId | null>(null)
  const [pageEntered, setPageEntered] = useState(false)
  const [dashboard, setDashboard] = useState<DashboardLayout | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [pendingImport, setPendingImport] = useState<{
    fileName: string
    payload: ParsedLocalBackup
    takenAt: number | null
    backupCounts: BackupCounts
    deviceCounts: BackupCounts | null
  } | null>(null)
  const [importStep, setImportStep] = useState<'saving' | 'restoring' | null>(null)
  const [discoveryResetDone, setDiscoveryResetDone] = useState(false)
  const discoveryReset = useDiscoveryReset()
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const {
    setLanguage,
    uiAnimationsEnabled,
    setUiAnimationsEnabled,
    numberAnimationsEnabled,
    setNumberAnimationsEnabled,
    defaultCurrency,
    setDefaultCurrency,
    weatherAutoLocationEnabled,
    setWeatherAutoLocationEnabled,
    weatherManualCity,
    setWeatherManualCity,
    weatherTemperatureUnit,
    setWeatherTemperatureUnit,
    focusCompletionSoundEnabled,
    setFocusCompletionSoundEnabled,
    neteaseExperimentalPlaybackConfirmed,
    neteaseExperimentalPlaybackEnabled,
    setNeteaseExperimentalPlaybackConfirmed,
    setNeteaseExperimentalPlaybackEnabled,
    taskReminderEnabled,
    setTaskReminderEnabled,
    taskReminderLeadMinutes,
    setTaskReminderLeadMinutes,
  } = usePreferences()

  const [manualCityInput, setManualCityInput] = useState(weatherManualCity)
  const [pendingNeteaseExperimentalToggle, setPendingNeteaseExperimentalToggle] = useState(false)
  const [manualCityOpen, setManualCityOpen] = useState(false)
  const [manualCityHasPendingSelection, setManualCityHasPendingSelection] = useState(false)
  const [manualCityRemoteSearch, setManualCityRemoteSearch] = useState<{ query: string; suggestions: CitySuggestion[] }>({
    query: '',
    suggestions: [],
  })
  const [manualCityActiveIndex, setManualCityActiveIndex] = useState(-1)
  const [personalApiKeys, setPersonalApiKeys] = useState<Record<PersonalApiKeyService, string>>(() => ({
    tmdb: readPersonalApiKey('tmdb'),
    twelveData: readPersonalApiKey('twelveData'),
  }))

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPageEntered(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const accountId = getAuth()?.user?.id
    if (!isLoggedIn || typeof accountId !== 'string') {
      setSyncConflicts([])
      return
    }
    let active = true
    void listSyncConflicts(accountId).then((items) => {
      if (active) setSyncConflicts(items)
    })
    return () => { active = false }
  }, [isLoggedIn, syncState?.updatedAt])

  useEffect(() => {
    dashboardRepo.get().then((stored) => {
      setDashboard(stored)
      // The applied theme comes from the local (synced) preference, so the
      // selector must mirror it. dashboard.themeOverride is a legacy mirror
      // that new layouts seed with 'light' — reading it first made Settings
      // show "Light" while the app was actually dark.
      const storedPreference = readStoredThemePreference()
      if (storedPreference) {
        setTheme(storedPreference)
        return
      }
      const override = stored?.themeOverride
      setTheme(override === 'light' || override === 'dark' ? override : 'system')
    })
  }, [])

  const legalDocumentKey = useMemo<LegalDocumentKey | null>(() => {
    if (location.pathname === ROUTES.SETTINGS_LEGAL_PRIVACY) return 'privacy-policy'
    if (location.pathname === ROUTES.SETTINGS_LEGAL_TERMS) return 'terms-of-service'
    return null
  }, [location.pathname])

  const isLegalSection = location.pathname === LEGAL_ROOT_PATH || legalDocumentKey !== null
  const resolvedSection: SettingsSection = isLegalSection ? 'legal' : activeSection
  const legalDocument = legalDocumentKey ? LEGAL_DOCUMENTS[language][legalDocumentKey] : null
  const syncStatusLabel = !cloudSyncEnabled
    ? t('settings.data.sync.status.paused')
    : syncState ? t(`settings.data.sync.status.${syncState.status}`) : t('settings.data.sync.status.idle')
  const lastSyncedLabel = syncState?.lastPulledAt
    ? t('settings.data.sync.lastSynced', { time: new Date(syncState.lastPulledAt).toLocaleString(appIntlLocale()) })
    : t('settings.data.sync.lastSynced.never')

  const openSection = (section: SettingsSection) => {
    if (section === 'legal') {
      navigate(LEGAL_ROOT_PATH)
      return
    }
    setActiveSection(section)
    if (isLegalSection) navigate(ROUTES.SETTINGS)
  }

  const savePersonalApiKey = (service: PersonalApiKeyService) => {
    writePersonalApiKey(service, personalApiKeys[service])
    setPersonalApiKeys((current) => ({ ...current, [service]: readPersonalApiKey(service) }))
    toast.push({ variant: 'success', message: t('settings.integrations.saved') })
  }

  const removePersonalApiKey = (service: PersonalApiKeyService) => {
    clearPersonalApiKey(service)
    setPersonalApiKeys((current) => ({ ...current, [service]: '' }))
    toast.push({ variant: 'success', message: t('settings.integrations.removed') })
  }

  const themeHelp = useMemo(() => {
    if (theme === 'system') return t('settings.theme.systemHelp')
    return t('settings.theme.forceHelp', { theme: t(theme === 'dark' ? 'settings.theme.dark' : 'settings.theme.light').toLowerCase() })
  }, [theme, t])
  const resolvedThemeMode = useMemo(() => (theme === 'system' ? resolveTheme() : theme), [theme])

  const saveThemeOverride = async (next: ThemeSelection) => {
    // Apply intent immediately; a slow legacy dashboard write must not replace
    // a newer choice made with the sidebar control while it was pending.
    writeStoredThemePreference(next)
    applyTheme(resolveTheme(next))
    void syncedPreferencesRepo.persistFromLocal()
    const themeOverride = next === 'system' ? null : next
    const stored = (await dashboardRepo.get()) ?? dashboard
    const items = stored?.items ?? []
    const updated = await dashboardRepo.upsert({ items, themeOverride })
    setDashboard(updated)

  }

  useEffect(() => {
    const handleSyncedPreferencesUpdated = () => {
      setLayoutLocked(readLayoutLocked())
      const storedPreference = readStoredThemePreference()
      setTheme(storedPreference ?? 'system')
    }
    window.addEventListener(SYNCED_PREFERENCES_UPDATED_EVENT, handleSyncedPreferencesUpdated)
    return () => window.removeEventListener(SYNCED_PREFERENCES_UPDATED_EVENT, handleSyncedPreferencesUpdated)
  }, [])

  useEffect(() => subscribeTheme(() => {
    setTheme(readStoredThemePreference() ?? 'system')
  }), [])

  useEffect(() => {
    if (!themePackPreview) {
      clearThemePackPreview()
      return
    }
    applyThemePackPreview(themePackPreview, resolvedThemeMode)
  }, [resolvedThemeMode, themePackPreview])

  useEffect(() => {
    const handleBeforeModeToggle = () => {
      // A rapid round trip can change system -> explicit light/dark without
      // changing the final applied colour, so subscribeTheme alone is not enough.
      const pendingPreference = readStoredThemePreference()
      if (pendingPreference) setTheme(pendingPreference)
      if (!themePackPreview) return
      clearThemePackPreview()
      setThemePackPreview(null)
      setThemePackSelection('theme-a')
    }

    window.addEventListener(THEME_BEFORE_MODE_TOGGLE_EVENT, handleBeforeModeToggle)
    return () => {
      window.removeEventListener(THEME_BEFORE_MODE_TOGGLE_EVENT, handleBeforeModeToggle)
    }
  }, [themePackPreview])

  useEffect(() => {
    return () => {
      clearThemePackPreview()
    }
  }, [])

  const localCitySuggestions = useMemo(() => buildLocalSuggestions(manualCityInput), [manualCityInput])
  const shouldShowManualCitySuggestions = !weatherAutoLocationEnabled && normalizeQuery(manualCityInput).length >= MIN_CITY_QUERY_LENGTH
  const shouldFetchRemoteSuggestions = shouldShowManualCitySuggestions && localCitySuggestions.length < MAX_CITY_SUGGESTIONS

  useEffect(() => {
    if (!shouldFetchRemoteSuggestions) return

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      void searchRemoteCitySuggestions(manualCityInput, controller.signal)
        .then((results) => setManualCityRemoteSearch({ query: manualCityInput, suggestions: results }))
        .catch(() => setManualCityRemoteSearch({ query: manualCityInput, suggestions: [] }))
    }, 220)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [manualCityInput, shouldFetchRemoteSuggestions])

  const manualCitySuggestions = useMemo(() => {
    const normalizedCurrentQuery = normalizeQuery(manualCityInput)
    const normalizedRemoteQuery = normalizeQuery(manualCityRemoteSearch.query)
    const remoteSuggestions =
      shouldFetchRemoteSuggestions && normalizedCurrentQuery === normalizedRemoteQuery
        ? manualCityRemoteSearch.suggestions
        : []

    const seen = new Set<string>()
    return [...localCitySuggestions, ...remoteSuggestions]
      .sort((a, b) => b.score - a.score)
      .filter((item) => {
        const key = normalizeQuery(item.label)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, MAX_CITY_SUGGESTIONS)
  }, [localCitySuggestions, manualCityInput, manualCityRemoteSearch, shouldFetchRemoteSuggestions])

  const resolvedActiveIndex =
    manualCityActiveIndex >= 0 && manualCityActiveIndex < manualCitySuggestions.length
      ? manualCityActiveIndex
      : manualCitySuggestions.length > 0
        ? 0
        : -1

  const applyManualCitySuggestion = (suggestion: CitySuggestion) => {
    setManualCityInput(suggestion.label)
    setWeatherManualCity(suggestion.searchValue)
    setManualCityHasPendingSelection(false)
    setManualCityOpen(false)
    setManualCityActiveIndex(-1)
  }

  const commitManualCityInput = () => {
    const committed = manualCityInput.trim()
    setManualCityHasPendingSelection(false)
    setManualCityOpen(false)
    setManualCityActiveIndex(-1)

    if (!committed) {
      setManualCityInput('')
      setWeatherManualCity('')
      return
    }

    setManualCityInput(committed)
    setWeatherManualCity(committed)
  }

  const resetApp = async () => {
    setIsResetting(true)
    pauseSymbolicSyncForReset()
    try {
      // If signed in, wipe the server copy FIRST. Otherwise the next sync cycle
      // after the local reset pulls every "old" row back down and the user sees
      // their reset undone. Bail loudly on failure rather than silently leaving
      // local + server out of sync.
      if (getAuth()?.user) {
        try {
          await wipeServerData()
        } catch (err) {
          throw new Error(
            language === 'zh'
              ? `云端数据清除失败，已中止重置（本地数据未改动）：${err instanceof Error ? err.message : '未知错误'}`
              : `Failed to wipe cloud data; reset aborted (local data untouched): ${err instanceof Error ? err.message : 'Unknown error'}`,
          )
        }
      }
      requestRxdbSyncReset()
      requestCrossTabDbReset()
      await new Promise((resolve) => window.setTimeout(resolve, 150))
      await Promise.race([
        resetRxdbSyncDatabase(),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error(
          language === 'zh'
            ? '重置被其他 Focus&go 标签页阻塞，请关闭其他标签页后重试。'
            : 'Reset is blocked by another Focus&go tab. Close the other tabs and try again.'
        )), RESET_TIMEOUT_MS)),
      ])
      await Promise.race([
        db.delete({ disableAutoOpen: false }),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error(
          language === 'zh'
            ? '本地数据库仍被占用，请关闭其他 Focus&go 标签页后重试。'
            : 'Local database is still in use. Close the other Focus&go tabs and try again.'
        )), RESET_TIMEOUT_MS)),
      ])
      localStorage.clear()
      sessionStorage.clear()
      window.location.reload()
    } catch (error) {
      resumeSymbolicSyncAfterResetFailure()
      toast.push({
        variant: 'error',
        message: error instanceof Error
          ? error.message
          : (language === 'zh' ? '重置失败，请稍后重试。' : 'Reset failed. Please try again.'),
      })
    } finally {
      setIsResetting(false)
    }
  }

  const backupTableNames = useMemo(() => Object.values(TABLES), [])

  const buildCurrentBackup = async () => createBackupDownload(await exportLocalBackup({
    db: createTableDatabaseAdapter(db, backupTableNames),
    storage: createBrowserStorageAdapter(window.localStorage),
    tableNames: backupTableNames,
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
  }))

  const exportBackup = async () => {
    setIsExporting(true)
    try {
      downloadBackupFile(await buildCurrentBackup())
      toast.push({ variant: 'success', message: t('settings.data.export.success') })
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.data.export.failed')
      toast.push({ variant: 'error', message })
    } finally {
      setIsExporting(false)
    }
  }

  const downloadSyncConflict = (item: SyncConflictRecord) => {
    const file = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `focusgo-conflict-${item.id}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }

  const reviewSyncConflict = async (item: SyncConflictRecord) => {
    if (item.accountId === getAuth()?.user?.id && await markSyncConflictReviewed(item.accountId, item.id)) {
      setSyncConflicts((items) => items.map((current) => current.id === item.id
        ? { ...current, resolvedAt: Date.now() }
        : current))
      void syncNow()
    }
  }

  const restoreSyncConflict = async (item: SyncConflictRecord) => {
    const accountId = getAuth()?.user?.id
    if (typeof accountId !== 'string' || item.accountId !== accountId || restoringConflictId) return
    setRestoringConflictId(item.id)
    try {
      const restoredEntityId = await restoreNoteConflictAsCopy(
        accountId,
        item.id,
        t('notes.trash.untitled'),
        t('settings.data.sync.conflicts.copySuffix'),
      )
      setSyncConflicts((items) => items.map((current) => current.id === item.id
        ? { ...current, restoredEntityId, resolvedAt: Date.now() }
        : current))
      toast.push({ variant: 'success', message: t('settings.data.sync.conflicts.restored') })
      void syncNow()
    } catch (error) {
      console.error('[sync] restore conflict copy failed', error)
      toast.push({ variant: 'error', message: t('settings.data.sync.conflicts.restoreFailed') })
    } finally {
      setRestoringConflictId(null)
    }
  }

  const onImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const backup = await readBackupFile(file)
      const { createdAt, counts } = summarizeBackup(backup)
      const deviceCounts = await countLocalData(db).catch(() => null)
      setPendingImport({ fileName: file.name, payload: backup, takenAt: createdAt, backupCounts: counts, deviceCounts })
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.data.import.invalidFile')
      toast.push({ variant: 'error', message })
    }
  }

  const confirmImport = async () => {
    if (!pendingImport) return

    setIsImporting(true)
    // A copy of what is here now goes to Downloads first. If that can't be made, nothing is overwritten.
    setImportStep('saving')
    try {
      const safety = await buildCurrentBackup()
      downloadBackupFile({ ...safety, fileName: safety.fileName.replace('focus-go-backup-', 'focus-go-before-restore-') })
    } catch (error) {
      console.error('[settings] safety backup before restore failed', error)
      toast.push({ variant: 'error', message: t('settings.data.import.safetyFailed') })
      setIsImporting(false)
      setImportStep(null)
      return
    }
    setImportStep('restoring')
    try {
      await importLocalBackup(pendingImport.payload, {
        db: createTableDatabaseAdapter(db, backupTableNames),
        storage: createBrowserStorageAdapter(window.localStorage),
        tableNames: backupTableNames,
      })
      await restampLocalSnapshotForRestore()
      await resetRxdbSyncDatabase()
      // Repopulate blob cache from the backup so the client-side fallback works
      // when the server reports blobs as missing during the next pull.
      // replaceTables() clears every table including sync_blob_cache; this restores it.
      if ('blobs' in pendingImport.payload) {
        const blobCacheTimestamp = Date.now()
        const blobEntries = Object.values(pendingImport.payload.blobs).map((blob) => ({
          ...blob,
          createdAt: blobCacheTimestamp,
          updatedAt: blobCacheTimestamp,
        }))
        if (blobEntries.length > 0) await db.syncBlobCache.bulkPut(blobEntries)
      }
      const now = Date.now()
      await db.syncState.put({
        id: 'cloud-sync',
        status: 'idle',
        lastPulledAt: null,
        lastPushedAt: null,
        lastError: null,
        firstSyncResolved: true,
        pendingFirstSync: false,
        pendingEntityPush: false,
        pendingBlobPush: false,
        missingBlobPull: false,
        migrationVersion: 3,
        restoreIntegrityStatus: 'ready',
        pendingLocalRecordCount: 0,
        pendingRemoteRecordCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      // Let the browser take over the safety download before the page goes away.
      await new Promise((resolve) => window.setTimeout(resolve, 1200))
      window.location.reload()
    } catch (error) {
      const fallback = t('settings.data.import.failed')
      const message = error instanceof Error ? error.message : fallback
      toast.push({ variant: 'error', message: message || fallback })
      setIsImporting(false)
      setImportStep(null)
      setPendingImport(null)
    }
  }

  return (
    <div className="relative h-full min-h-0 p-3 sm:p-4 lg:p-6">
      <div className="relative z-10 flex h-full min-h-0 flex-col gap-5">
        <motion.header
          initial={pageEntered ? { opacity: 0, y: -16 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow, ease: EASE.emphasized }}
          className="flex flex-wrap items-end justify-between gap-4 rounded-xl bg-background/20 p-5 shadow-lg backdrop-blur"
        >
          <div className="type-heading-stack">
            <p className="text-xs font-semibold uppercase tracking-[var(--tracking-caps)] text-muted-foreground">{t('settings.pageEyebrow')}</p>
            <h1 className="page-title mt-2 text-foreground">{t('settings.pageTitle')}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('settings.pageDescription')}</p>
          </div>
        </motion.header>

        <Tabs value={resolvedSection} onValueChange={(value) => openSection(value as SettingsSection)} className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="h-full min-h-0 bg-background/20 shadow-xl backdrop-blur dark:border-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('settings.modulesTitle')}</CardTitle>
              <CardDescription>{t('settings.modulesDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <TabsList className="settings-nav h-auto w-full flex-col items-stretch gap-2 bg-transparent p-0">
                <ActiveIndicator selector=':scope > div > [role="tab"][data-state="active"]' />
                {SECTION_META_KEYS.map((section) => {
                  const Icon = section.icon
                  const active = resolvedSection === section.key
                  return (
                    <motion.div key={section.key} layout>
                      <TabsTrigger
                        value={section.key}
                        className="relative h-auto w-full justify-start rounded-xl bg-background/40 px-3 py-3 text-left data-[state=active]:bg-primary/10 data-[state=active]:shadow-lg"
                      >
                        <div className="flex w-full items-center gap-3">
                          <Icon className="h-4 w-4 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold">{t(section.titleKey)}</div>
                            <div className="truncate text-xs text-muted-foreground">{t(section.hintKey)}</div>
                          </div>
                          <Badge variant={active ? 'default' : 'secondary'} className="h-6 px-2 text-meta">
                            {t(section.badgeKey)}
                          </Badge>
                        </div>
                      </TabsTrigger>
                    </motion.div>
                  )
                })}
              </TabsList>

            </CardContent>
          </Card>

          <Card className="flex h-full min-h-0 flex-col bg-background/20 shadow-xl backdrop-blur dark:border-transparent">
            <CardContent className="flex min-h-0 flex-1 p-0">
              <ScrollArea className="h-full min-h-0 flex-1">
                <div className="p-5 md:p-6">
                  <div className="space-y-4">
                      {resolvedSection === 'legal' ? (
                        legalDocument ? (
                          <div data-auth-preview-allowed="true"><p className="policy-links"><a href={policyUrl(legalDocumentKey!, language)} target="_blank" rel="noreferrer">{language === 'zh' ? '在独立页面查看当前版本与历史文本' : 'Open current edition and history'}</a></p><LegalDocumentView
                            title={legalDocument.title}
                            summary={legalDocument.summary}
                            updatedAt={t('settings.legal.updatedAt', { date: legalDocument.updatedAt })}
                            sections={legalDocument.sections}
                            backLabel={t('settings.legal.back')}
                            onBack={() => navigate(LEGAL_ROOT_PATH)}
                          /></div>
                        ) : (
                          <motion.div
                            className="space-y-4"
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: DURATION.slow, ease: EASE.emphasized }}
                          >
                            <div className="rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] p-6 text-[var(--text-primary)] shadow-lg dark:border-white/10 dark:bg-background/50 dark:text-foreground">
                              <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-[var(--tracking-caps)] text-[var(--text-tertiary)] dark:text-muted-foreground">
                                  {t('settings.module.legal.title')}
                                </p>
                                <h2 className="type-section-title">{t('settings.legal.title')}</h2>
                                <p className="max-w-2xl text-sm leading-7 text-[color-mix(in_srgb,var(--text-primary)_72%,transparent)] dark:text-muted-foreground">
                                  {t('settings.legal.description')}
                                </p>
                              </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                              <LegalEntryCard
                                icon={Shield}
                                title={t('settings.legal.privacy.title')}
                                summary={t('settings.legal.privacy.summary')}
                                onClick={() => navigate(ROUTES.SETTINGS_LEGAL_PRIVACY)}
                              />
                              <LegalEntryCard
                                icon={Scale}
                                title={t('settings.legal.terms.title')}
                                summary={t('settings.legal.terms.summary')}
                                onClick={() => navigate(ROUTES.SETTINGS_LEGAL_TERMS)}
                              />
                            </div>
                          </motion.div>
                        )
                      ) : null}

                      {resolvedSection === 'appearance' ? (
                        <>
                          <SettingRow
                            icon={Brush}
                            title={t('settings.language.title')}
                            description={t('settings.language.description')}
                          >
                            <Select value={language} onValueChange={(value) => setLanguage(value as LanguageCode)}>
                              <SelectTrigger className="w-full sm:max-w-[220px]">
                                <SelectValue placeholder={t('settings.language.placeholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="en">{t('settings.language.option.en')}</SelectItem>
                                <SelectItem value="zh">{t('settings.language.option.zh')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </SettingRow>

                          <SettingRow
                            icon={Brush}
                            title={t('settings.theme.title')}
                            description={themeHelp}
                          >
                            <Select
                              value={theme}
                              onValueChange={(value) => {
                                const next = value as ThemeSelection
                                setTheme(next)
                                void saveThemeOverride(next)
                              }}
                            >
                              <SelectTrigger className="w-full sm:max-w-[220px]">
                                <SelectValue placeholder={t('settings.theme.placeholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="system">{t('settings.theme.system')}</SelectItem>
                                <SelectItem value="light">{t('settings.theme.light')}</SelectItem>
                                <SelectItem value="dark">{t('settings.theme.dark')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </SettingRow>

                          <SettingRow
                            icon={Brush}
                            title={t('settings.themePack.title')}
                            description={t('settings.themePack.previewDescription')}
                          >
                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                              <Select
                                value={themePackSelection}
                                onValueChange={(value) => {
                                  const next = value as ThemePackId
                                  setThemePackSelection(next)
                                  setThemePackPreview(next)
                                }}
                              >
                                <SelectTrigger aria-label={t('settings.themePack.title')} className="w-full sm:w-[220px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="theme-a">{t('settings.themePack.option.a')}</SelectItem>
                                  <SelectItem value="theme-b">{t('settings.themePack.option.b')}</SelectItem>
                                  <SelectItem value="theme-c">{t('settings.themePack.option.c')}</SelectItem>
                                </SelectContent>
                              </Select>
                              {themePackPreview ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    clearThemePackPreview()
                                    setThemePackPreview(null)
                                    setThemePackSelection('theme-a')
                                  }}
                                >
                                  {t('settings.themePack.cancelPreview')}
                                </Button>
                              ) : null}
                            </div>
                          </SettingRow>

                          <SettingRow
                            icon={LayoutGrid}
                            title={t('settings.layoutLock.title')}
                            description={t('settings.layoutLock.description')}
                          >
                            <Switch
                              checked={layoutLocked}
                              onCheckedChange={(checked) => {
                                setLayoutLocked(checked)
                                writeLayoutLocked(checked)
                                void syncedPreferencesRepo.persistFromLocal()
                              }}
                            />
                          </SettingRow>

                          <SettingRow
                            icon={Clock3}
                            title={t('settings.autoPage.title')}
                            description={t('settings.autoPage.description')}
                          >
                            <Switch
                              checked={autoPage}
                              onCheckedChange={(checked) => {
                                setAutoPage(checked)
                                writeAutoPageEnabled(checked)
                              }}
                            />
                          </SettingRow>

                          <SettingRow
                            icon={Waves}
                            title={t('settings.currency.title')}
                            description={t('settings.currency.description')}
                          >
                            <Select value={defaultCurrency} onValueChange={(value) => setDefaultCurrency(value as 'USD' | 'CNY')}>
                              <SelectTrigger className="w-full sm:max-w-[220px]">
                                <SelectValue placeholder={t('settings.currency.placeholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="CNY">CNY</SelectItem>
                              </SelectContent>
                            </Select>
                          </SettingRow>

                          <AmbientSettingsSection />
                        </>
                      ) : null}

                      {resolvedSection === 'experience' ? (
                        <>
                          <InteractionSoundSettings />
                          <SettingRow
                            icon={Sparkles}
                            title={t('settings.experience.uiAnimations.title')}
                            description={t('settings.experience.uiAnimations.description')}
                          >
                            <Switch sound checked={uiAnimationsEnabled} onCheckedChange={(checked) => setUiAnimationsEnabled(checked)} />
                          </SettingRow>

                          <SettingRow
                            icon={Sparkles}
                            title={t('settings.experience.numberAnimations.title')}
                            description={t('settings.experience.numberAnimations.description')}
                          >
                            <Switch sound checked={numberAnimationsEnabled} onCheckedChange={(checked) => setNumberAnimationsEnabled(checked)} />
                          </SettingRow>

                          <SettingRow
                            icon={Bell}
                            title={t('settings.experience.completionSound.title')}
                            description={t('settings.experience.completionSound.description')}
                          >
                            <Switch sound checked={focusCompletionSoundEnabled} onCheckedChange={(checked) => setFocusCompletionSoundEnabled(checked)} />
                          </SettingRow>

                          <SettingRow
                            icon={AlertTriangle}
                            title={t('settings.experience.neteaseExperimentalPlayback.title')}
                            description={t('settings.experience.neteaseExperimentalPlayback.description')}
                          >
                            <Switch
                              checked={neteaseExperimentalPlaybackEnabled}
                              onCheckedChange={(checked) => {
                                if (checked && !neteaseExperimentalPlaybackConfirmed) {
                                  setPendingNeteaseExperimentalToggle(true)
                                  return
                                }
                                setNeteaseExperimentalPlaybackEnabled(checked)
                              }}
                            />
                          </SettingRow>

                          <SettingRow
                            icon={Bell}
                            title={t('settings.taskReminders.title')}
                            description={t('settings.taskReminders.description')}
                          >
                            <Switch checked={taskReminderEnabled} onCheckedChange={(checked) => setTaskReminderEnabled(checked)} />
                          </SettingRow>

                          <DesktopNotificationRow />

                          <WebPushRow />


                          <AlertDialog open={pendingNeteaseExperimentalToggle} onOpenChange={setPendingNeteaseExperimentalToggle}>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('settings.experience.neteaseExperimentalPlayback.confirmTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('settings.experience.neteaseExperimentalPlayback.confirmDescription')}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('settings.data.import.confirmCancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    setNeteaseExperimentalPlaybackConfirmed(true)
                                    setNeteaseExperimentalPlaybackEnabled(true)
                                    setPendingNeteaseExperimentalToggle(false)
                                  }}
                                >
                                  {t('settings.experience.neteaseExperimentalPlayback.confirmAction')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <SettingRow
                            icon={Lightbulb}
                            title={t('settings.discovery.title')}
                            description={discoveryResetDone ? t('settings.discovery.resetDone') : t('settings.discovery.description')}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                discoveryReset()
                                setDiscoveryResetDone(true)
                                setTimeout(() => setDiscoveryResetDone(false), 3000)
                              }}
                            >
                              {t('settings.discovery.reset')}
                            </Button>
                          </SettingRow>

                          <SettingRow
                            icon={AlertTriangle}
                            title={t('settings.reminderLead.title')}
                            description={t('settings.reminderLead.description')}
                          >
                            <Select
                              value={String(taskReminderLeadMinutes)}
                              onValueChange={(value) => setTaskReminderLeadMinutes(Number(value))}
                            >
                              <SelectTrigger className="w-full sm:max-w-[220px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">{t('settings.reminderLead.5min')}</SelectItem>
                                <SelectItem value="10">{t('settings.reminderLead.10min')}</SelectItem>
                                <SelectItem value="15">{t('settings.reminderLead.15min')}</SelectItem>
                                <SelectItem value="30">{t('settings.reminderLead.30min')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </SettingRow>
                        </>
                      ) : null}

                      {resolvedSection === 'weather' ? (
                        <>
                          <SettingRow
                            icon={LocateFixed}
                            title={t('settings.weather.autoLocation.title')}
                            description={t('settings.weather.autoLocation.description')}
                          >
                            <Switch checked={weatherAutoLocationEnabled} onCheckedChange={(checked) => setWeatherAutoLocationEnabled(checked)} />
                          </SettingRow>

                          <motion.div
                            className="space-y-3 rounded-xl bg-background/40 p-4 shadow-sm"
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: DURATION.slow, delay: 0.05, ease: EASE.emphasized }}
                          >
                            <div>
                              <h3 className="type-label text-foreground">{t('settings.weather.manualCity.title')}</h3>
                              <p className="text-sm text-muted-foreground">{t('settings.weather.manualCity.description')}</p>
                            </div>

                            <div className="relative">
                              <Input
                                type="text"
                                value={manualCityInput}
                                placeholder={t('settings.weather.manualCity.placeholder')}
                                disabled={weatherAutoLocationEnabled}
                                role="combobox"
                                aria-expanded={manualCityOpen && shouldShowManualCitySuggestions}
                                aria-controls="manual-city-suggestions"
                                aria-autocomplete="list"
                                onFocus={() => {
                                  if (shouldShowManualCitySuggestions) {
                                    setManualCityOpen(true)
                                    setManualCityActiveIndex(0)
                                  }
                                }}
                                onChange={(event) => {
                                  const nextValue = event.target.value
                                  setManualCityInput(nextValue)
                                  setManualCityHasPendingSelection(true)
                                  setManualCityOpen(normalizeQuery(nextValue).length >= MIN_CITY_QUERY_LENGTH)
                                  setManualCityActiveIndex(0)
                                }}
                                onKeyDown={(event) => {
                                  if (weatherAutoLocationEnabled) return
                                  if (!shouldShowManualCitySuggestions) return

                                  if (event.key === 'ArrowDown') {
                                    event.preventDefault()
                                    setManualCityOpen(true)
                                    setManualCityActiveIndex((prev) =>
                                      manualCitySuggestions.length === 0 ? -1 : (prev + 1 + manualCitySuggestions.length) % manualCitySuggestions.length
                                    )
                                    return
                                  }

                                  if (event.key === 'ArrowUp') {
                                    event.preventDefault()
                                    setManualCityOpen(true)
                                    setManualCityActiveIndex((prev) =>
                                      manualCitySuggestions.length === 0 ? -1 : (prev - 1 + manualCitySuggestions.length) % manualCitySuggestions.length
                                    )
                                    return
                                  }

                                  if (event.key === 'Enter' && manualCityOpen && resolvedActiveIndex >= 0) {
                                    event.preventDefault()
                                    const active = manualCitySuggestions[resolvedActiveIndex]
                                    if (active) applyManualCitySuggestion(active)
                                    return
                                  }

                                  if (event.key === 'Enter') {
                                    event.preventDefault()
                                    commitManualCityInput()
                                    return
                                  }

                                  if (event.key === 'Escape') {
                                    event.preventDefault()
                                    setManualCityOpen(false)
                                    setManualCityActiveIndex(-1)
                                  }
                                }}
                                onBlur={() => {
                                  if (manualCityHasPendingSelection) commitManualCityInput()
                                  else {
                                    setManualCityOpen(false)
                                    setManualCityActiveIndex(-1)
                                  }
                                }}
                              />

                              {manualCityOpen && shouldShowManualCitySuggestions ? (
                                <div
                                  id="manual-city-suggestions"
                                  role="listbox"
                                  className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
                                >
                                  <ScrollArea className="max-h-64">
                                    <div className="p-1">
                                      {manualCitySuggestions.map((suggestion, index) => (
                                        <button
                                          key={suggestion.id}
                                          type="button"
                                          role="option"
                                          aria-selected={resolvedActiveIndex === index}
                                          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                                            resolvedActiveIndex === index ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                                          }`}
                                          onMouseDown={(event) => event.preventDefault()}
                                          onClick={() => applyManualCitySuggestion(suggestion)}
                                        >
                                          <span>{suggestion.label}</span>
                                          <span className="text-xs text-muted-foreground">
                                            {suggestion.source === 'local' ? t('settings.weather.manualCity.local') : t('settings.weather.manualCity.online')}
                                          </span>
                                        </button>
                                      ))}
                                      {manualCitySuggestions.length === 0 ? (
                                        <p className="px-3 py-2 text-sm text-muted-foreground">{t('settings.weather.manualCity.empty')}</p>
                                      ) : null}
                                    </div>
                                  </ScrollArea>
                                </div>
                              ) : null}
                            </div>

                            <Select
                              value={weatherTemperatureUnit}
                              onValueChange={(value) => setWeatherTemperatureUnit(value as 'celsius' | 'fahrenheit')}
                            >
                              <SelectTrigger className="w-full sm:max-w-[220px]">
                                <SelectValue placeholder={t('settings.weather.temperature.placeholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="celsius">{t('settings.weather.temperature.celsius')}</SelectItem>
                                <SelectItem value="fahrenheit">{t('settings.weather.temperature.fahrenheit')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </motion.div>
                        </>
                      ) : null}

                      {resolvedSection === 'integrations' ? (
                        <>
                          <motion.div
                            className="rounded-md border border-rule bg-[var(--paper-sunken)] p-4 text-sm text-muted-foreground"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: DURATION.medium, ease: EASE.emphasized }}
                          >
                            <p className="font-medium text-foreground">{t('settings.integrations.localOnly.title')}</p>
                            <p className="mt-1 leading-6">{t('settings.integrations.localOnly.description')}</p>
                          </motion.div>

                          <SettingRow
                            icon={KeyRound}
                            title={t('settings.integrations.tmdb.title')}
                            description={t('settings.integrations.tmdb.description')}
                          >
                            <div className="flex w-full flex-col gap-2 sm:max-w-[420px]">
                              <Input
                                aria-label={t('settings.integrations.tmdb.title')}
                                type="password"
                                autoComplete="off"
                                value={personalApiKeys.tmdb}
                                onChange={(event) => setPersonalApiKeys((current) => ({ ...current, tmdb: event.target.value }))}
                                placeholder={t('settings.integrations.keyPlaceholder')}
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" size="sm" onClick={() => savePersonalApiKey('tmdb')}>
                                  {t('settings.integrations.save')}
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => removePersonalApiKey('tmdb')}>
                                  {t('settings.integrations.remove')}
                                </Button>
                                <a className="text-xs font-medium text-primary underline-offset-4 hover:underline" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">
                                  {t('settings.integrations.getKey')}
                                </a>
                              </div>
                            </div>
                          </SettingRow>

                          <SettingRow
                            icon={KeyRound}
                            title={t('settings.integrations.twelveData.title')}
                            description={t('settings.integrations.twelveData.description')}
                          >
                            <div className="flex w-full flex-col gap-2 sm:max-w-[420px]">
                              <Input
                                aria-label={t('settings.integrations.twelveData.title')}
                                type="password"
                                autoComplete="off"
                                value={personalApiKeys.twelveData}
                                onChange={(event) => setPersonalApiKeys((current) => ({ ...current, twelveData: event.target.value }))}
                                placeholder={t('settings.integrations.keyPlaceholder')}
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" size="sm" onClick={() => savePersonalApiKey('twelveData')}>
                                  {t('settings.integrations.save')}
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => removePersonalApiKey('twelveData')}>
                                  {t('settings.integrations.remove')}
                                </Button>
                                <a className="text-xs font-medium text-primary underline-offset-4 hover:underline" href="https://twelvedata.com/account/api-keys" target="_blank" rel="noreferrer">
                                  {t('settings.integrations.getKey')}
                                </a>
                              </div>
                            </div>
                          </SettingRow>

                          <SettingRow
                            icon={Shield}
                            title={t('settings.integrations.server.title')}
                            description={t('settings.integrations.server.description')}
                          >
                            <a className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="https://github.com/VelvetAbyss/Focus-Go/blob/main/docs/SELF_HOSTING.md" target="_blank" rel="noreferrer">
                              {t('settings.integrations.server.action')}
                            </a>
                          </SettingRow>
                        </>
                      ) : null}

                      {resolvedSection === 'data' ? (
                        <>
                          <SettingRow
                            icon={Database}
                            title={t('settings.data.sync.title')}
                            description={t('settings.data.sync.description')}
                          >
                            {!isLoggedIn ? (
                              // Signed out there is nothing to sync with: say so and offer the way in,
                              // instead of an "enabled · idle · never synced" status.
                              <div className="flex w-full flex-col gap-3 sm:items-end">
                                <p className="max-w-[360px] text-sm text-muted-foreground sm:text-right">{t('settings.data.sync.signedOut')}</p>
                                <Button variant="outline" onClick={() => setShowLoginModal(true)}>
                                  {t('auth.signIn')}
                                </Button>
                              </div>
                            ) : (
                            <div className="flex w-full flex-col gap-3 sm:items-end">
                              <label className="flex items-center gap-3 text-sm font-medium">
                                <span>{cloudSyncEnabled ? t('settings.data.sync.enabled') : t('settings.data.sync.disabled')}</span>
                                <Switch
                                  checked={cloudSyncEnabled}
                                  onCheckedChange={(checked) => setCloudSyncEnabled(checked)}
                                  aria-label={t('settings.data.sync.toggle')}
                                />
                              </label>
                              <div className="text-sm text-muted-foreground">{syncStatusLabel}</div>
                              <div className="text-xs text-muted-foreground">{lastSyncedLabel}</div>
                              {cloudSyncQuota ? <div className="text-xs text-muted-foreground">{t('settings.data.sync.quota', { used: (cloudSyncQuota.usedBytes / 1024 / 1024).toFixed(1), limit: (cloudSyncQuota.limitBytes / 1024 / 1024).toFixed(0) })}</div> : null}
                              {cloudSyncEnabled && syncState?.status === 'blocked' && syncConflicts.some((item) => item.accountId === getAuth()?.user?.id && !item.resolvedAt) ? (
                                <div className="max-w-[360px] text-right text-xs text-destructive">
                                  {t('settings.data.sync.conflicts.attention', { count: String(syncConflicts.filter((item) => item.accountId === getAuth()?.user?.id && !item.resolvedAt).length) })}
                                </div>
                              ) : cloudSyncEnabled && syncState?.status === 'error' && syncState.lastError ? (
                                <div className="max-w-[360px] text-right text-xs text-destructive">
                                  {t('settings.data.sync.error', { message: syncState.lastError })}
                                </div>
                              ) : null}
                              <Button
                                variant="outline"
                                disabled={!cloudSyncEnabled || syncState?.status === 'syncing'}
                                onClick={() => { void syncNow() }}
                              >
                                {t('settings.data.sync.action')}
                              </Button>
                            </div>
                            )}
                          </SettingRow>

                          {isLoggedIn && syncConflicts.some((item) => item.accountId === getAuth()?.user?.id) ? (
                            <SettingRow
                              icon={AlertTriangle}
                              title={t('settings.data.sync.conflicts.title')}
                              description={t('settings.data.sync.conflicts.description')}
                            >
                              <div className="flex w-full flex-col gap-3">
                                {syncConflicts.filter((item) => item.accountId === getAuth()?.user?.id).map((item) => (
                                  <div key={item.id} data-testid={`sync-conflict-${item.id}`} className="rounded-xl border border-border p-3 text-sm">
                                    <div className="font-medium">{item.entityType} · {String(item.localDocument.title ?? item.entityId)}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(item.createdAt).toLocaleString(appIntlLocale())} · {item.resolvedAt
                                        ? t('settings.data.sync.conflicts.reviewed')
                                        : t('settings.data.sync.conflicts.pending')}
                                    </div>
                                    <details className="mt-3 rounded-lg border border-border/70 bg-background/50 p-2">
                                      <summary className="cursor-pointer text-sm font-medium">{t('settings.data.sync.conflicts.compare')}</summary>
                                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                        {([
                                          ['local', item.localDocument, 'settings.data.sync.conflicts.local'],
                                          ['remote', item.remoteDocument, 'settings.data.sync.conflicts.remote'],
                                        ] as const).map(([side, document, titleKey]) => (
                                          <section key={side} className="min-w-0 rounded-lg border border-border bg-background p-3" aria-label={t(titleKey)}>
                                            <h4 className="mb-2 text-sm font-semibold">{t(titleKey)}</h4>
                                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed" data-testid={`conflict-${side}-preview`}>
                                              {conflictPreview(document, item.entityType).slice(0, 6000)}
                                            </pre>
                                          </section>
                                        ))}
                                      </div>
                                      <p className="mt-2 text-xs text-muted-foreground">{t('settings.data.sync.conflicts.previewHint')}</p>
                                    </details>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <Button variant="outline" size="sm" onClick={() => downloadSyncConflict(item)}>
                                        {t('settings.data.sync.conflicts.download')}
                                      </Button>
                                      {item.entityType === 'notes' && item.localDocument._deleted !== true && !item.restoredEntityId ? (
                                        <Button variant="outline" size="sm" disabled={restoringConflictId !== null} onClick={() => { void restoreSyncConflict(item) }}>
                                          {t('settings.data.sync.conflicts.restoreCopy')}
                                        </Button>
                                      ) : null}
                                      {item.restoredEntityId && item.entityType === 'notes' ? (
                                        <Button variant="outline" size="sm" onClick={() => navigate(buildNoteDetailRoute(item.restoredEntityId!))}>
                                          {t('settings.data.sync.conflicts.openCopy')}
                                        </Button>
                                      ) : null}
                                      {!item.resolvedAt ? (
                                        <Button variant="outline" size="sm" onClick={() => { void reviewSyncConflict(item) }}>
                                          {t('settings.data.sync.conflicts.review')}
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </SettingRow>
                          ) : null}

                          <SettingRow
                            icon={Database}
                            title={t('settings.data.export.title')}
                            description={t('settings.data.export.description')}
                          >
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" disabled={isExporting || isImporting} onClick={() => void exportBackup()}>
                                {t('settings.data.export.json')}
                              </Button>
                            </div>
                          </SettingRow>

                          <SettingRow
                            icon={Database}
                            title={t('settings.data.import.title')}
                            description={t('settings.data.import.description')}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                ref={importInputRef}
                                hidden
                                type="file"
                                accept="application/json,.json,application/zip,.zip"
                                onChange={(event) => void onImportFileChange(event)}
                              />
                              <Button
                                variant="outline"
                                disabled={isExporting || isImporting}
                                onClick={() => requireAuth(() => importInputRef.current?.click())}
                              >
                                {t('settings.data.import.action')}
                              </Button>
                              {isGated && (
                                <span className="text-xs text-muted-foreground">
                                  {language === 'zh' ? '需要登录' : 'Sign in required'}
                                </span>
                              )}
                            </div>
                          </SettingRow>

                          <motion.div
                            className="space-y-4 rounded-xl bg-destructive/5 p-4 shadow-sm ring-1 ring-destructive/20"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: DURATION.slow, delay: 0.06, ease: EASE.emphasized }}
                          >
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
                              <div>
                                <h3 className="type-label text-foreground">{t('settings.data.danger.title')}</h3>
                                <p className="text-sm text-muted-foreground">{t('settings.data.danger.description')}</p>
                              </div>
                            </div>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isResetting}>
                                  {isResetting ? t('settings.data.resetting') : t('settings.data.reset')}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('settings.data.resetDialog.title')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('settings.data.resetDialog.description')}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('settings.data.resetDialog.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => void resetApp()}>{t('settings.data.resetDialog.confirm')}</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </motion.div>

                          <AlertDialog open={pendingImport !== null} onOpenChange={(open) => {
                            if (!open && !isImporting) setPendingImport(null)
                          }}>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('settings.data.import.confirmTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('settings.data.import.confirmDescription')}
                                  {pendingImport ? ` ${pendingImport.fileName}` : ''}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              {pendingImport ? (
                                <div className="restore-compare">
                                  <table className="restore-compare__table">
                                    <thead>
                                      <tr>
                                        <th scope="col" />
                                        <th scope="col">
                                          {t('settings.data.import.compareBackup')}
                                          {pendingImport.takenAt ? (
                                            <span className="restore-compare__date">
                                              {new Date(pendingImport.takenAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </span>
                                          ) : null}
                                        </th>
                                        <th scope="col">{t('settings.data.import.compareDevice')}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {BACKUP_SUMMARY_KINDS.map(({ kind }) => {
                                        const backup = pendingImport.backupCounts[kind]
                                        const device = pendingImport.deviceCounts?.[kind]
                                        if (backup === 0 && !device) return null
                                        return (
                                          <tr key={kind} className={device !== undefined && backup < device ? 'is-fewer' : undefined}>
                                            <th scope="row">{t(`settings.data.import.kind.${kind}`)}</th>
                                            <td>{backup}</td>
                                            <td>{device ?? '—'}</td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                  <p className="restore-compare__note">{t('settings.data.import.safetyNote')}</p>
                                </div>
                              ) : null}
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isImporting}>{t('settings.data.import.confirmCancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={isImporting}
                                  onClick={(event) => {
                                    // Stay open while saving and restoring; the page reloads when done.
                                    event.preventDefault()
                                    void confirmImport()
                                  }}
                                >
                                  {importStep === 'saving'
                                    ? t('settings.data.import.stepSaving')
                                    : importStep === 'restoring'
                                      ? t('settings.data.import.stepRestoring')
                                      : t('settings.data.import.confirmAction')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : null}

                      {resolvedSection === 'feedback' ? (
                        <FeedbackForm />
                      ) : null}
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </Tabs>
      </div>
      {showLoginModal ? (
        <Suspense fallback={null}>
          <LoginModal onClose={() => setShowLoginModal(false)} />
        </Suspense>
      ) : null}
    </div>
  )
}

export default SettingsRoute
