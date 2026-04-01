import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  Brush,
  Crown,
  Database,
  LayoutGrid,
  LocateFixed,
  Scale,
  Shield,
  Sparkles,
  SunMedium,
  Waves,
  AlertTriangle,
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
import { dashboardRepo } from '../../data/repositories/dashboardRepo'
import { db } from '../../data/db'
import { DB_NAME, DB_VERSION, TABLES } from '../../data/db/schema'
import { applyTheme, readStoredThemePreference, resolveTheme, writeStoredThemePreference } from '../../shared/theme/theme'
import {
  applyThemePackPreview,
  clearThemePackPreview,
  THEME_BEFORE_MODE_TOGGLE_EVENT,
  type ThemePackId,
} from '../../shared/theme/themePack'
import type { DashboardLayout } from '../../data/models/types'
import { usePreferences } from '../../shared/prefs/usePreferences'
import { useI18n } from '../../shared/i18n/useI18n'
import type { LanguageCode } from '../../shared/i18n/types'
import { useToast } from '../../shared/ui/toast/toast'
import {
  createBackupDownload,
  createBrowserStorageAdapter,
  createTableDatabaseAdapter,
  exportLocalBackup,
  importLocalBackup,
  type LocalBackupPayload,
} from '../../shared/backup/localBackup'
import { useSyncActions, useSyncStatus } from '../../data/sync/service'
import { ROUTES } from './routes'
import { useUpgradeModal } from '../../features/labs/UpgradeModalContext'

const LAYOUT_LOCK_KEY = 'workbench.dashboard.layoutLocked'

type ThemeSelection = 'system' | 'light' | 'dark'
type SettingsSection = 'appearance' | 'experience' | 'weather' | 'data' | 'legal'
type BaseSettingsSection = Exclude<SettingsSection, 'legal'>
type LegalDocumentKey = 'privacy-policy' | 'terms-of-service'
type CitySuggestion = {
  id: string
  label: string
  searchValue: string
  score: number
  source: 'local' | 'remote'
}
type OpenMeteoGeocodeResponse = {
  results?: Array<{
    id?: number
    name?: string
    country?: string
    admin1?: string
  }>
}
type OpenMeteoGeocodeResult = NonNullable<OpenMeteoGeocodeResponse['results']>[number]

const MIN_CITY_QUERY_LENGTH = 2
const MAX_CITY_SUGGESTIONS = 8

const SECTION_META_KEYS: Array<{
  key: SettingsSection
  titleKey:
    | 'settings.module.appearance.title'
    | 'settings.module.experience.title'
    | 'settings.module.weather.title'
    | 'settings.module.data.title'
    | 'settings.module.legal.title'
  hintKey:
    | 'settings.module.appearance.hint'
    | 'settings.module.experience.hint'
    | 'settings.module.weather.hint'
    | 'settings.module.data.hint'
    | 'settings.module.legal.hint'
  icon: typeof Brush
  badgeKey:
    | 'settings.badge.visual'
    | 'settings.badge.motion'
    | 'settings.badge.widget'
    | 'settings.badge.safety'
    | 'settings.badge.legal'
}> = [
  { key: 'appearance', titleKey: 'settings.module.appearance.title', hintKey: 'settings.module.appearance.hint', icon: Brush, badgeKey: 'settings.badge.visual' },
  { key: 'experience', titleKey: 'settings.module.experience.title', hintKey: 'settings.module.experience.hint', icon: Sparkles, badgeKey: 'settings.badge.motion' },
  { key: 'weather', titleKey: 'settings.module.weather.title', hintKey: 'settings.module.weather.hint', icon: SunMedium, badgeKey: 'settings.badge.widget' },
  { key: 'data', titleKey: 'settings.module.data.title', hintKey: 'settings.module.data.hint', icon: Database, badgeKey: 'settings.badge.safety' },
  { key: 'legal', titleKey: 'settings.module.legal.title', hintKey: 'settings.module.legal.hint', icon: Shield, badgeKey: 'settings.badge.legal' },
]

type LegalDocumentSection = {
  heading: string
  paragraphs: string[]
}

type LegalDocument = {
  title: string
  summary: string
  updatedAt: string
  sections: LegalDocumentSection[]
}

const LEGAL_ROOT_PATH = `${ROUTES.SETTINGS}/legal`

const LEGAL_DOCUMENTS: Record<LanguageCode, Record<LegalDocumentKey, LegalDocument>> = {
  en: {
    'privacy-policy': {
      title: 'Privacy Policy',
      summary: 'How Focus & Go collects, stores, and uses information when you use the app.',
      updatedAt: 'March 30, 2026',
      sections: [
        {
          heading: 'Information we collect',
          paragraphs: [
            'Focus & Go stores the content you create in the app, such as tasks, notes, focus sessions, diary entries, preferences, and other workspace data.',
            'When you sign in, we may also receive basic account details such as your user ID, display name, email address, and subscription status.',
          ],
        },
        {
          heading: 'Local storage and cloud sync',
          paragraphs: [
            'Most product data is stored locally on your device so the app can work quickly and remain usable even when network conditions are unstable.',
            'If cloud sync is enabled in the future for your account tier, synced copies of your workspace data may be transmitted to our servers or trusted infrastructure providers.',
          ],
        },
        {
          heading: 'Third-party services',
          paragraphs: [
            'We may rely on third-party services for authentication, hosting, analytics, crash reporting, storage, and related infrastructure. Those services only receive the information required to provide their part of the product.',
            'We do not sell your personal information to advertisers or data brokers.',
          ],
        },
        {
          heading: 'Data retention',
          paragraphs: [
            'Locally stored data remains on your device until you delete it, reset the app, or remove the application.',
            'If remote services are used, we retain data only for as long as necessary to operate the product, meet legal obligations, resolve disputes, and enforce our agreements.',
          ],
        },
        {
          heading: 'Your rights and choices',
          paragraphs: [
            'You can review, edit, export, import, or delete local data using the controls provided inside the app.',
            'If your account data is processed by remote services, you may contact us to request access, correction, or deletion, subject to applicable law and legitimate operational needs.',
          ],
        },
        {
          heading: 'Contact',
          paragraphs: [
            'If you have privacy questions or requests, contact us at support@focus-go.app.',
          ],
        },
      ],
    },
    'terms-of-service': {
      title: 'Terms of Service',
      summary: 'The basic rules, responsibilities, and limitations that apply when you use Focus & Go.',
      updatedAt: 'March 30, 2026',
      sections: [
        {
          heading: 'Service overview',
          paragraphs: [
            'Focus & Go is a productivity workspace for managing tasks, notes, focus sessions, diary entries, and related personal workflows.',
            'We may update, improve, limit, or discontinue features at any time as the product evolves.',
          ],
        },
        {
          heading: 'Account responsibility',
          paragraphs: [
            'You are responsible for maintaining control of your account credentials and for activity that occurs under your account.',
            'You must provide accurate information when creating or using an account-backed feature.',
          ],
        },
        {
          heading: 'Acceptable use',
          paragraphs: [
            'You may not use the service to break the law, abuse other users, interfere with infrastructure, reverse engineer restricted systems, or attempt unauthorized access.',
            'You may not upload or distribute malicious code, spam, or content that violates applicable rights or regulations.',
          ],
        },
        {
          heading: 'Subscriptions and premium features',
          paragraphs: [
            'Some features may require a premium plan. Premium-only features can change over time as the product develops.',
            'If billing is introduced or updated later, pricing, renewal terms, and cancellation rules will be presented at the time of purchase.',
          ],
        },
        {
          heading: 'Disclaimers',
          paragraphs: [
            'The service is provided on an as-is and as-available basis. We do not guarantee uninterrupted operation, perfect accuracy, or permanent availability of every feature.',
            'You are responsible for keeping your own backups when data continuity is important to you.',
          ],
        },
        {
          heading: 'Termination and changes',
          paragraphs: [
            'We may suspend or terminate access if you violate these terms or use the service in a way that creates legal, operational, or security risk.',
            'We may revise these terms from time to time. Continued use of the service after updates means you accept the revised terms.',
          ],
        },
        {
          heading: 'Contact',
          paragraphs: [
            'Questions about these terms can be sent to support@focus-go.app.',
          ],
        },
      ],
    },
  },
  zh: {
    'privacy-policy': {
      title: '隐私政策',
      summary: '说明 Focus & Go 在你使用产品时会收集、存储和使用哪些信息。',
      updatedAt: '2026 年 3 月 30 日',
      sections: [
        {
          heading: '我们收集的信息',
          paragraphs: [
            'Focus & Go 会保存你在产品中创建的内容，例如任务、笔记、专注记录、日记、偏好设置及其他工作台数据。',
            '当你登录时，我们也可能接收基础账号信息，例如用户 ID、显示名称、邮箱地址和订阅状态。',
          ],
        },
        {
          heading: '本地存储与云同步',
          paragraphs: [
            '大多数产品数据会优先保存在你的设备本地，以保证速度和离线可用性。',
            '如果未来你的账号等级支持云同步，工作台数据的同步副本可能会传输到我们的服务器或受信任的基础设施服务商。',
          ],
        },
        {
          heading: '第三方服务',
          paragraphs: [
            '我们可能会使用第三方服务提供登录、托管、分析、崩溃监控、存储等基础能力。这些服务只会接收完成相应功能所需的信息。',
            '我们不会向广告商或数据中介出售你的个人信息。',
          ],
        },
        {
          heading: '数据保留',
          paragraphs: [
            '保存在本地的数据会一直留在你的设备上，直到你主动删除、重置应用，或卸载产品。',
            '如果使用了远端服务，我们只会在提供产品、履行法律义务、解决争议和执行协议所需的期间内保留数据。',
          ],
        },
        {
          heading: '你的权利与选择',
          paragraphs: [
            '你可以通过应用内提供的能力查看、编辑、导出、导入或删除本地数据。',
            '如果你的账号数据被远端服务处理，你可以联系我们提出访问、更正或删除请求，但仍需遵守适用法律和合理的运营要求。',
          ],
        },
        {
          heading: '联系我们',
          paragraphs: [
            '如果你有任何隐私相关的问题或请求，请联系 support@focus-go.app。',
          ],
        },
      ],
    },
    'terms-of-service': {
      title: '服务条款',
      summary: '说明你在使用 Focus & Go 时需要遵守的基本规则、责任和限制。',
      updatedAt: '2026 年 3 月 30 日',
      sections: [
        {
          heading: '服务说明',
          paragraphs: [
            'Focus & Go 是一个用于管理任务、笔记、专注、日记及相关个人工作流的效率工作台。',
            '随着产品演进，我们可能会随时更新、增强、限制或下线部分功能。',
          ],
        },
        {
          heading: '账号责任',
          paragraphs: [
            '你需要妥善保管自己的账号凭证，并对账号下发生的行为负责。',
            '当你创建账号或使用依赖账号的功能时，应提供真实、准确的信息。',
          ],
        },
        {
          heading: '可接受使用',
          paragraphs: [
            '你不得利用本服务从事违法行为、骚扰他人、干扰基础设施、逆向受限系统，或尝试未授权访问。',
            '你不得上传或传播恶意代码、垃圾信息，或侵犯他人权利、违反适用法规的内容。',
          ],
        },
        {
          heading: '订阅与高级功能',
          paragraphs: [
            '部分功能可能仅对高级版开放，具体的高级功能范围可能随着产品发展而调整。',
            '如果未来引入或更新计费能力，价格、续费和取消规则会在购买时明确展示。',
          ],
        },
        {
          heading: '免责声明',
          paragraphs: [
            '本服务按“现状”和“可用”基础提供。我们不保证服务绝不中断、结果绝对准确，也不保证所有功能永久可用。',
            '当数据连续性对你很重要时，你应自行保留备份。',
          ],
        },
        {
          heading: '终止与变更',
          paragraphs: [
            '如果你违反本条款，或以可能带来法律、运营或安全风险的方式使用服务，我们可以暂停或终止你的访问权限。',
            '我们可能不时更新这些条款。条款更新后继续使用服务，即表示你接受修订后的内容。',
          ],
        },
        {
          heading: '联系我们',
          paragraphs: [
            '如果你对这些条款有任何问题，请发送邮件至 support@focus-go.app。',
          ],
        },
      ],
    },
  },
}

const LOCAL_CITY_CANDIDATES: Array<{ label: string; tokens: string[] }> = [
  { label: 'Hangzhou, China', tokens: ['hangzhou', 'hang zhou', 'hz', '杭州'] },
  { label: 'Beijing, China', tokens: ['beijing', 'peking', '北京'] },
  { label: 'Shanghai, China', tokens: ['shanghai', '上海'] },
  { label: 'Shenzhen, China', tokens: ['shenzhen', '深圳'] },
  { label: 'Guangzhou, China', tokens: ['guangzhou', 'guang zhou', '广州'] },
  { label: 'Chengdu, China', tokens: ['chengdu', 'cheng du', '成都'] },
  { label: 'Wuhan, China', tokens: ['wuhan', '武汉'] },
  { label: 'Nanjing, China', tokens: ['nanjing', '南京'] },
  { label: "Xi'an, China", tokens: ['xian', "xi'an", '西安'] },
  { label: 'Tokyo, Japan', tokens: ['tokyo'] },
  { label: 'Seoul, South Korea', tokens: ['seoul'] },
  { label: 'Singapore, Singapore', tokens: ['singapore'] },
  { label: 'London, United Kingdom', tokens: ['london'] },
  { label: 'Paris, France', tokens: ['paris'] },
  { label: 'Berlin, Germany', tokens: ['berlin'] },
  { label: 'Sydney, Australia', tokens: ['sydney'] },
  { label: 'New York, United States', tokens: ['new york', 'nyc'] },
  { label: 'Los Angeles, United States', tokens: ['los angeles', 'la'] },
  { label: 'San Francisco, United States', tokens: ['san francisco', 'sf'] },
  { label: 'Chicago, United States', tokens: ['chicago'] },
]

const readLayoutLocked = () => {
  const raw = localStorage.getItem(LAYOUT_LOCK_KEY)
  if (raw === null) return true
  return raw !== 'false'
}

const writeLayoutLocked = (locked: boolean) => {
  localStorage.setItem(LAYOUT_LOCK_KEY, locked ? 'true' : 'false')
}

const normalizeQuery = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const CJK_CHAR_RE = /[\u3400-\u9fff]/u
const hasCjkChar = (value: string) => CJK_CHAR_RE.test(value)

const getSubsequenceScore = (query: string, target: string) => {
  let queryIndex = 0
  let penalty = 0
  for (let targetIndex = 0; targetIndex < target.length && queryIndex < query.length; targetIndex += 1) {
    if (target[targetIndex] === query[queryIndex]) {
      queryIndex += 1
    } else {
      penalty += 1
    }
  }
  if (queryIndex !== query.length) return -1
  return 420 - penalty
}

const getTokenMatchScore = (query: string, token: string) => {
  if (!query || !token) return -1
  if (token.startsWith(query)) return 1200 - (token.length - query.length)

  const containsIndex = token.indexOf(query)
  if (containsIndex >= 0) return 800 - containsIndex * 2 - (token.length - query.length)

  return getSubsequenceScore(query, token)
}

const buildLocalSuggestions = (query: string): CitySuggestion[] => {
  const normalizedQuery = normalizeQuery(query)
  if (normalizedQuery.length < MIN_CITY_QUERY_LENGTH) return []

  return LOCAL_CITY_CANDIDATES.map((candidate) => {
    const tokens = [candidate.label, ...candidate.tokens].map((token) => normalizeQuery(token))
    const score = Math.max(...tokens.map((token) => getTokenMatchScore(normalizedQuery, token)))
    return {
      id: `local:${candidate.label}`,
      label: candidate.label,
      searchValue: candidate.label,
      score,
      source: 'local' as const,
    }
  })
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CITY_SUGGESTIONS)
}

const searchRemoteCitySuggestions = async (query: string, signal: AbortSignal): Promise<CitySuggestion[]> => {
  const normalizedQuery = normalizeQuery(query)
  if (normalizedQuery.length < MIN_CITY_QUERY_LENGTH) return []

  const languages: Array<'en' | 'zh'> = hasCjkChar(query) ? ['zh', 'en'] : ['en', 'zh']
  const resultsByLang = await Promise.all(
    languages.map(async (language) => {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=${MAX_CITY_SUGGESTIONS}&language=${language}&format=json`,
        { signal }
      )
      if (!response.ok) return [] as OpenMeteoGeocodeResult[]
      const payload = (await response.json()) as OpenMeteoGeocodeResponse
      return payload.results ?? []
    })
  )

  return resultsByLang
    .flat()
    .reduce<CitySuggestion[]>((acc, result, index) => {
      const name = result?.name?.trim()
      if (!name) return acc

      const suffix = [result.admin1, result.country].filter(Boolean).join(', ')
      const label = suffix ? `${name}, ${suffix}` : name
      const score = Math.max(
        getTokenMatchScore(normalizedQuery, normalizeQuery(name)),
        getTokenMatchScore(normalizedQuery, normalizeQuery(label))
      )
      if (score < 0) return acc

      acc.push({
        id: `remote:${result.id ?? `${label}:${index}`}`,
        label,
        searchValue: label,
        score,
        source: 'remote' as const,
      })
      return acc
    }, [])
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CITY_SUGGESTIONS)
}

type SettingRowProps = {
  icon: typeof Brush
  title: string
  description: string
  children: ReactNode
}

const SettingRow = ({ icon: Icon, title, description, children }: SettingRowProps) => (
  <motion.div
    layout
    className="grid gap-4 rounded-xl bg-background/40 p-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
    initial={{ opacity: 0, y: 18, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    whileHover={{ y: -2 }}
  >
    <div className="flex gap-3">
      <div className="mt-0.5 rounded-md border border-border/80 bg-muted/60 p-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
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
    onClick={onClick}
    className="w-full rounded-2xl border border-[#3A3733]/10 bg-[#F5F3F0]/90 p-5 text-left text-[#3A3733] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-background/50 dark:text-foreground"
    initial={{ opacity: 0, y: 18, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#3A3733]/10 bg-white/70 text-[#3A3733] dark:border-white/10 dark:bg-white/10 dark:text-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-[#3A3733]/72 dark:text-muted-foreground">{summary}</p>
        </div>
      </div>
      <ArrowLeft className="h-4 w-4 rotate-180 text-[#3A3733]/48 dark:text-muted-foreground" />
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
    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
  >
    <div className="sticky top-0 z-10 pb-1">
      <Button
        type="button"
        variant="outline"
        className="rounded-full border-[#3A3733]/12 bg-[#F5F3F0]/70 text-[#3A3733] hover:bg-[#F5F3F0] dark:border-white/10 dark:bg-background/40 dark:text-foreground"
        onClick={onBack}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {backLabel}
      </Button>
    </div>

    <div className="rounded-[28px] border border-[#3A3733]/10 bg-[#F5F3F0]/92 p-6 text-[#3A3733] shadow-lg dark:border-white/10 dark:bg-background/50 dark:text-foreground">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3A3733]/52 dark:text-muted-foreground">Focus & Go</p>
          <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
          <p className="max-w-2xl text-sm leading-7 text-[#3A3733]/72 dark:text-muted-foreground">{summary}</p>
          <div className="inline-flex rounded-full border border-[#3A3733]/10 bg-white/70 px-3 py-1 text-xs text-[#3A3733]/72 dark:border-white/10 dark:bg-white/10 dark:text-muted-foreground">
            {updatedAt}
          </div>
        </div>

        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight">{section.heading}</h3>
              <div className="space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-[#3A3733]/78 dark:text-muted-foreground">
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
  const { openModal: openUpgradeModal } = useUpgradeModal()
  const toast = useToast()
  const syncState = useSyncStatus()
  const { syncNow, resolveFirstSync } = useSyncActions()
  const [activeSection, setActiveSection] = useState<BaseSettingsSection>('appearance')
  const [layoutLocked, setLayoutLocked] = useState(() => readLayoutLocked())
  const [theme, setTheme] = useState<ThemeSelection>('system')
  const [themePackSelection, setThemePackSelection] = useState<ThemePackId>('theme-a')
  const [themePackPreview, setThemePackPreview] = useState<ThemePackId | null>(null)
  const [pageEntered, setPageEntered] = useState(false)
  const [dashboard, setDashboard] = useState<DashboardLayout | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isResolvingFirstSync, setIsResolvingFirstSync] = useState(false)
  const [pendingImport, setPendingImport] = useState<{ fileName: string; payload: LocalBackupPayload } | null>(null)
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
    taskReminderEnabled,
    setTaskReminderEnabled,
    taskReminderLeadMinutes,
    setTaskReminderLeadMinutes,
  } = usePreferences()

  const [manualCityInput, setManualCityInput] = useState(weatherManualCity)
  const [manualCityOpen, setManualCityOpen] = useState(false)
  const [manualCityHasPendingSelection, setManualCityHasPendingSelection] = useState(false)
  const [manualCityRemoteSearch, setManualCityRemoteSearch] = useState<{ query: string; suggestions: CitySuggestion[] }>({
    query: '',
    suggestions: [],
  })
  const [manualCityActiveIndex, setManualCityActiveIndex] = useState(-1)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPageEntered(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    dashboardRepo.get().then((stored) => {
      setDashboard(stored)
      const override = stored?.themeOverride
      if (override === 'light' || override === 'dark') {
        setTheme(override)
        return
      }
      const storedPreference = readStoredThemePreference()
      setTheme(storedPreference ?? 'system')
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
  const syncStatusLabel = syncState ? t(`settings.data.sync.status.${syncState.status}`) : t('settings.data.sync.status.idle')
  const lastSyncedLabel = syncState?.lastPulledAt
    ? t('settings.data.sync.lastSynced', { time: new Date(syncState.lastPulledAt).toLocaleString() })
    : t('settings.data.sync.lastSynced.never')

  const openSection = (section: SettingsSection) => {
    if (section === 'legal') {
      navigate(LEGAL_ROOT_PATH)
      return
    }
    setActiveSection(section)
    if (isLegalSection) navigate(ROUTES.SETTINGS)
  }

  const themeHelp = useMemo(() => {
    if (theme === 'system') return t('settings.theme.systemHelp')
    return t('settings.theme.forceHelp', { theme })
  }, [theme, t])
  const resolvedThemeMode = useMemo(() => (theme === 'system' ? resolveTheme() : theme), [theme])

  const saveThemeOverride = async (next: ThemeSelection) => {
    const themeOverride = next === 'system' ? null : next
    const stored = (await dashboardRepo.get()) ?? dashboard
    const items = stored?.items ?? []
    const updated = await dashboardRepo.upsert({ items, themeOverride })
    setDashboard(updated)

    writeStoredThemePreference(next)
    applyTheme(resolveTheme(next))
  }

  useEffect(() => {
    if (!themePackPreview) {
      clearThemePackPreview()
      return
    }
    applyThemePackPreview(themePackPreview, resolvedThemeMode)
  }, [resolvedThemeMode, themePackPreview])

  useEffect(() => {
    const handleBeforeModeToggle = () => {
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
    try {
      await db.delete()
      localStorage.clear()
      sessionStorage.clear()
      window.location.reload()
    } finally {
      setIsResetting(false)
    }
  }

  const backupTableNames = useMemo(() => Object.values(TABLES), [])

  const exportBackup = async () => {
    setIsExporting(true)
    try {
      const payload = await exportLocalBackup({
        db: createTableDatabaseAdapter(db, backupTableNames),
        storage: createBrowserStorageAdapter(window.localStorage),
        tableNames: backupTableNames,
        dbName: DB_NAME,
        dbVersion: DB_VERSION,
      })
      const download = createBackupDownload(payload)
      const link = document.createElement('a')
      link.href = download.url
      link.download = download.fileName
      link.click()
      URL.revokeObjectURL(download.url)
      toast.push({ variant: 'success', message: t('settings.data.export.success') })
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.data.export.failed')
      toast.push({ variant: 'error', message })
    } finally {
      setIsExporting(false)
    }
  }

  const onImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const raw = JSON.parse(await file.text()) as LocalBackupPayload
      if (raw?.format !== 'focus-go-local-backup') {
        throw new Error(t('settings.data.import.invalidFile'))
      }
      setPendingImport({ fileName: file.name, payload: raw })
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.data.import.invalidFile')
      toast.push({ variant: 'error', message })
    }
  }

  const confirmImport = async () => {
    if (!pendingImport) return

    setIsImporting(true)
    try {
      await importLocalBackup(pendingImport.payload, {
        db: createTableDatabaseAdapter(db, backupTableNames),
        storage: createBrowserStorageAdapter(window.localStorage),
        tableNames: backupTableNames,
      })
      window.location.reload()
    } catch (error) {
      const fallback = t('settings.data.import.failed')
      const message = error instanceof Error ? error.message : fallback
      toast.push({ variant: 'error', message: message || fallback })
      setIsImporting(false)
      setPendingImport(null)
    }
  }

  const handleResolveFirstSync = async (choice: 'upload-local' | 'pull-remote') => {
    setIsResolvingFirstSync(true)
    try {
      await resolveFirstSync(choice)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed'
      toast.push({ variant: 'error', message })
    } finally {
      setIsResolvingFirstSync(false)
    }
  }

  return (
    <div className="relative h-full min-h-0 p-3 sm:p-4 lg:p-6">
      <div className="relative z-10 flex h-full min-h-0 flex-col gap-5">
        <motion.header
          initial={pageEntered ? { opacity: 0, y: -16 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-end justify-between gap-4 rounded-xl bg-background/20 p-5 shadow-lg backdrop-blur"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t('settings.pageEyebrow')}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{t('settings.pageTitle')}</h1>
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
              <TabsList className="h-auto w-full flex-col items-stretch gap-2 bg-transparent p-0">
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
                          <Badge variant={active ? 'default' : 'secondary'} className="h-6 px-2 text-[11px]">
                            {t(section.badgeKey)}
                          </Badge>
                        </div>
                      </TabsTrigger>
                    </motion.div>
                  )
                })}
              </TabsList>

              <button
                type="button"
                className="mt-2 flex w-full items-center gap-3 rounded-xl border border-dashed border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-3 text-left transition-opacity hover:opacity-80"
                onClick={() => openUpgradeModal()}
              >
                <Crown className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[var(--accent)]">{t('settings.subscription.title')}</div>
                  <div className="truncate text-xs text-muted-foreground">{t('settings.subscription.hint')}</div>
                </div>
              </button>
            </CardContent>
          </Card>

          <Card className="flex h-full min-h-0 flex-col bg-background/20 shadow-xl backdrop-blur dark:border-transparent">
            <CardContent className="flex min-h-0 flex-1 p-0">
              <ScrollArea className="h-full min-h-0 flex-1">
                <div className="p-5 md:p-6">
                  <div className="space-y-4">
                      {resolvedSection === 'legal' ? (
                        legalDocument ? (
                          <LegalDocumentView
                            title={legalDocument.title}
                            summary={legalDocument.summary}
                            updatedAt={t('settings.legal.updatedAt', { date: legalDocument.updatedAt })}
                            sections={legalDocument.sections}
                            backLabel={t('settings.legal.back')}
                            onBack={() => navigate(LEGAL_ROOT_PATH)}
                          />
                        ) : (
                          <motion.div
                            className="space-y-4"
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <div className="rounded-[28px] border border-[#3A3733]/10 bg-[#F5F3F0]/92 p-6 text-[#3A3733] shadow-lg dark:border-white/10 dark:bg-background/50 dark:text-foreground">
                              <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3A3733]/52 dark:text-muted-foreground">
                                  {t('settings.module.legal.title')}
                                </p>
                                <h2 className="text-2xl font-semibold tracking-tight">{t('settings.legal.title')}</h2>
                                <p className="max-w-2xl text-sm leading-7 text-[#3A3733]/72 dark:text-muted-foreground">
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
                        </>
                      ) : null}

                      {resolvedSection === 'experience' ? (
                        <>
                          <SettingRow
                            icon={Sparkles}
                            title={t('settings.experience.uiAnimations.title')}
                            description={t('settings.experience.uiAnimations.description')}
                          >
                            <Switch checked={uiAnimationsEnabled} onCheckedChange={(checked) => setUiAnimationsEnabled(checked)} />
                          </SettingRow>

                          <SettingRow
                            icon={Sparkles}
                            title={t('settings.experience.numberAnimations.title')}
                            description={t('settings.experience.numberAnimations.description')}
                          >
                            <Switch checked={numberAnimationsEnabled} onCheckedChange={(checked) => setNumberAnimationsEnabled(checked)} />
                          </SettingRow>

                          <SettingRow
                            icon={Bell}
                            title={t('settings.experience.completionSound.title')}
                            description={t('settings.experience.completionSound.description')}
                          >
                            <Switch checked={focusCompletionSoundEnabled} onCheckedChange={(checked) => setFocusCompletionSoundEnabled(checked)} />
                          </SettingRow>

                          <SettingRow
                            icon={Bell}
                            title={t('settings.taskReminders.title')}
                            description={t('settings.taskReminders.description')}
                          >
                            <Switch checked={taskReminderEnabled} onCheckedChange={(checked) => setTaskReminderEnabled(checked)} />
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
                            transition={{ duration: 0.35, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">{t('settings.weather.manualCity.title')}</h3>
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

                      {resolvedSection === 'data' ? (
                        <>
                          <SettingRow
                            icon={Database}
                            title={t('settings.data.sync.title')}
                            description={t('settings.data.sync.description')}
                          >
                            <div className="flex w-full flex-col gap-3 sm:items-end">
                              <div className="text-sm text-muted-foreground">{syncStatusLabel}</div>
                              <div className="text-xs text-muted-foreground">{lastSyncedLabel}</div>
                              {syncState?.lastError ? (
                                <div className="max-w-[360px] text-right text-xs text-destructive">
                                  {t('settings.data.sync.error', { message: syncState.lastError })}
                                </div>
                              ) : null}
                              <Button variant="outline" disabled={syncState?.status === 'syncing'} onClick={() => void syncNow()}>
                                {t('settings.data.sync.action')}
                              </Button>
                            </div>
                          </SettingRow>

                          {syncState?.pendingFirstSync ? (
                            <motion.div
                              className="space-y-4 rounded-xl bg-background/40 p-4 shadow-sm"
                              initial={{ opacity: 0, y: 16 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.35, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
                            >
                              <div className="space-y-1">
                                <h3 className="text-sm font-semibold text-foreground">{t('settings.data.sync.first.title')}</h3>
                                <p className="text-sm text-muted-foreground">{t('settings.data.sync.first.description')}</p>
                              </div>
                              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                <span>{t('settings.data.sync.first.localCount', { count: syncState.pendingLocalRecordCount })}</span>
                                <span>{t('settings.data.sync.first.remoteCount', { count: syncState.pendingRemoteRecordCount })}</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  disabled={isResolvingFirstSync}
                                  onClick={() => void handleResolveFirstSync('upload-local')}
                                >
                                  {t('settings.data.sync.first.upload')}
                                </Button>
                                <Button
                                  variant="outline"
                                  disabled={isResolvingFirstSync}
                                  onClick={() => void handleResolveFirstSync('pull-remote')}
                                >
                                  {t('settings.data.sync.first.pull')}
                                </Button>
                              </div>
                            </motion.div>
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
                            <div className="flex flex-wrap gap-2">
                              <input
                                ref={importInputRef}
                                hidden
                                type="file"
                                accept="application/json,.json"
                                onChange={(event) => void onImportFileChange(event)}
                              />
                              <Button
                                variant="outline"
                                disabled={isExporting || isImporting}
                                onClick={() => importInputRef.current?.click()}
                              >
                                {t('settings.data.import.action')}
                              </Button>
                            </div>
                          </SettingRow>

                          <motion.div
                            className="space-y-4 rounded-xl bg-destructive/5 p-4 shadow-sm ring-1 ring-destructive/20"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
                              <div>
                                <h3 className="text-sm font-semibold text-foreground">{t('settings.data.danger.title')}</h3>
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
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isImporting}>{t('settings.data.import.confirmCancel')}</AlertDialogCancel>
                                <AlertDialogAction disabled={isImporting} onClick={() => void confirmImport()}>
                                  {t('settings.data.import.confirmAction')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : null}
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </div>
  )
}

export default SettingsRoute
