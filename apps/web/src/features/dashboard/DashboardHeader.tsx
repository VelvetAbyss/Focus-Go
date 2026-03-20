import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { LayoutGrid, Settings as SettingsIcon } from 'lucide-react'
import { ROUTES } from '../../app/routes/routes'
import { AppNumber, AppNumberGroup } from '../../shared/ui/AppNumber'
import { useI18n } from '../../shared/i18n/useI18n'

type DashboardHeaderProps = {
  layoutEdit: boolean
  widgetsPanelOpen: boolean
  onToggleLayoutEdit: () => void
  onToggleWidgetsPanel: () => void
}

type HeaderInfoNodeId = 'date' | 'lunar' | 'clock'
type HeaderInfoNodeLayout = {
  x: number
  y: number
  scale: number
}
type HeaderInfoLayout = Record<HeaderInfoNodeId, HeaderInfoNodeLayout>

const LUNAR_DAY_LABELS = [
  '',
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十',
]

const DEFAULT_HEADER_INFO_LAYOUT: HeaderInfoLayout = {
  date: { x: 136, y: 64, scale: 0.55 },
  lunar: { x: 24, y: 64, scale: 0.55 },
  clock: { x: 24, y: 0, scale: 0.55 },
}

type QuoteState = {
  content: string
  author: string
}

const FALLBACK_QUOTES_EN: QuoteState[] = [
  { content: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { content: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { content: 'The future depends on what you do today.', author: 'Mahatma Gandhi' },
]

const FALLBACK_QUOTES_ZH: QuoteState[] = [
  { content: '千里之行，始于足下。', author: '《道德经》' },
  { content: '路虽远，行则将至。', author: '《荀子》' },
  { content: '不积跬步，无以至千里。', author: '《荀子》' },
]

const randomFallbackQuote = (language: 'en' | 'zh'): QuoteState => {
  const source = language === 'zh' ? FALLBACK_QUOTES_ZH : FALLBACK_QUOTES_EN
  return source[Math.floor(Math.random() * source.length)] ?? source[0]
}

const fetchMotivationalQuote = async (language: 'en' | 'zh', signal: AbortSignal): Promise<QuoteState> => {
  if (language === 'zh') {
    const response = await fetch('https://v1.hitokoto.cn/?encode=json&c=k', { signal })
    if (!response.ok) throw new Error(`quote request failed: ${response.status}`)
    const payload = (await response.json()) as { hitokoto?: string; from?: string; from_who?: string }
    const content = payload.hitokoto?.trim()
    if (!content) throw new Error('empty quote')
    const from = payload.from_who?.trim() || payload.from?.trim() || '佚名'
    return { content, author: from }
  }

  const response = await fetch('https://api.quotable.io/random?tags=inspirational', { signal })
  if (!response.ok) throw new Error(`quote request failed: ${response.status}`)
  const payload = (await response.json()) as { content?: string; author?: string }
  const content = payload.content?.trim()
  if (!content) throw new Error('empty quote')
  return { content, author: payload.author?.trim() || 'Unknown' }
}

const formatHeaderDate = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date)
  return `${year}/${month}/${day} ${weekday}`
}

const formatLunar = (date: Date) => {
  const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
    month: 'long',
    day: 'numeric',
  }).formatToParts(date)
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const rawDay = parts.find((part) => part.type === 'day')?.value ?? ''
  const dayNumber = Number.parseInt(rawDay, 10)
  const dayLabel =
    Number.isNaN(dayNumber) || dayNumber <= 0 || dayNumber >= LUNAR_DAY_LABELS.length
      ? rawDay
      : LUNAR_DAY_LABELS[dayNumber]
  return `Lunar ${month}${dayLabel}`
}

const DashboardHeader = ({
  layoutEdit,
  widgetsPanelOpen,
  onToggleLayoutEdit,
  onToggleWidgetsPanel,
}: DashboardHeaderProps) => {
  const { language } = useI18n()
  const [now, setNow] = useState(() => new Date())
  const [quote, setQuote] = useState<QuoteState>(() => randomFallbackQuote(language))
  const [quoteKey, setQuoteKey] = useState(0)
  const headerLayout = DEFAULT_HEADER_INFO_LAYOUT
  const showProjectBadges = false

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => window.clearInterval(timerId)
  }, [])

  useEffect(() => {
    let mounted = true
    let controller: AbortController | null = null

    const loadQuote = async () => {
      controller?.abort()
      controller = new AbortController()
      try {
        const next = await fetchMotivationalQuote(language, controller.signal)
        if (!mounted) return
        setQuote(next)
        setQuoteKey((prev) => prev + 1)
      } catch {
        if (!mounted) return
        setQuote(randomFallbackQuote(language))
        setQuoteKey((prev) => prev + 1)
      }
    }

    void loadQuote()
    const timer = window.setInterval(() => {
      void loadQuote()
    }, 180_000)

    return () => {
      mounted = false
      controller?.abort()
      window.clearInterval(timer)
    }
  }, [language])

  const getNodeStyle = (nodeId: HeaderInfoNodeId): CSSProperties => {
    const node = headerLayout[nodeId]
    return {
      left: `${node.x}px`,
      top: `${node.y}px`,
      '--node-scale': `${node.scale}`,
    } as CSSProperties
  }

  const headerDate = formatHeaderDate(now)
  const headerLunar = formatLunar(now)
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()
  const timeTrend = useMemo(() => (oldValue: number, value: number) => (value >= oldValue ? 1 : -1), [])
  const paddedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <header className="app-shell__header">
      <div className="app-shell__hero-stage" aria-live="polite">
        <div
          className="app-shell__hero-item app-shell__hero-item--date"
          style={getNodeStyle('date')}
        >
          <p className="app-shell__hero-date">{headerDate}</p>
        </div>
        <div
          className="app-shell__hero-item app-shell__hero-item--lunar"
          style={getNodeStyle('lunar')}
        >
          <p className="app-shell__hero-lunar">{headerLunar}</p>
        </div>
        <div
          className="app-shell__hero-item app-shell__hero-item--clock"
          style={getNodeStyle('clock')}
        >
          <div className="app-shell__hero-time" aria-label={`Current time ${paddedTime}`}>
            <AppNumberGroup>
              <AppNumber value={hours} trend={timeTrend} format={{ minimumIntegerDigits: 2 }} className="app-shell__hero-time-main" />
              <span className="app-shell__hero-time-colon" aria-hidden>
                :
              </span>
              <AppNumber
                value={minutes}
                trend={timeTrend}
                format={{ minimumIntegerDigits: 2 }}
                className="app-shell__hero-time-main"
              />
              <span className="app-shell__hero-time-seconds-wrap" aria-hidden>
                :
                <AppNumber
                  value={seconds}
                  trend={timeTrend}
                  format={{ minimumIntegerDigits: 2 }}
                  className="app-shell__hero-time-seconds"
                />
              </span>
            </AppNumberGroup>
          </div>
        </div>
        <div className="app-shell__hero-item app-shell__hero-item--quote">
          <div key={quoteKey} className="app-shell__hero-quote-content">
            <p className="app-shell__hero-quote">"{quote.content}"</p>
            <p className="app-shell__hero-quote-author">- {quote.author}</p>
          </div>
        </div>
      </div>
      <div className="app-shell__status">
        {showProjectBadges && !layoutEdit ? <span className="pill">Local First</span> : null}
        {showProjectBadges && !layoutEdit ? <span className="pill pill--soft">MVP</span> : null}
        {layoutEdit ? (
          <Button
            type="button"
            className={`app-shell__top-action app-shell__manage-widgets ${widgetsPanelOpen ? 'is-active' : ''}`}
            variant="outline"
            size="sm"
            onClick={onToggleWidgetsPanel}
          >
            <span>Manage widgets</span>
          </Button>
        ) : null}
        <Button
          type="button"
          className={`app-shell__top-action app-shell__edit-layout ${layoutEdit ? 'is-active' : ''}`}
          variant="outline"
          size="sm"
          onClick={onToggleLayoutEdit}
        >
          <LayoutGrid size={15} aria-hidden="true" />
          <span>{layoutEdit ? 'Done' : 'Edit layout'}</span>
        </Button>
        {!layoutEdit ? (
          <Button asChild className="app-shell__top-action app-shell__settings-link" variant="outline" size="sm">
            <Link to={ROUTES.SETTINGS}>
              <SettingsIcon size={15} aria-hidden="true" />
              <span>Settings</span>
            </Link>
          </Button>
        ) : null}
      </div>
    </header>
  )
}

export default DashboardHeader
