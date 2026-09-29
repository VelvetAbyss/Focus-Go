import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, RefreshCw, Settings as SettingsIcon } from 'lucide-react'
import { ROUTES } from '../../app/routes/routes'
import { useI18n } from '../../shared/i18n/useI18n'
import { useToday } from '../../shared/hooks/useToday'
import { DiscoveryNewBadge } from '../../shared/ui/DiscoveryNewBadge'
import { markDiscoveryNewTargetSeen } from '../../shared/discovery/discoveryNewTargetActions'
import LiveClock from './LiveClock'
import { quoteForDay } from './quote/quoteService'
import { lunarDateLabel, lunarFestivalOn, solarTermOn } from './header/chineseDay'
import PremiumMark from '../premium/PremiumMark'
import '../life/life.css'
import '../../shared/ui/HeaderPill.css'
import './header/dashboard-header.css'
import ActiveIndicator from '../../shared/motion/ActiveIndicator'
import { SELECTED_TAB } from '../../shared/motion/indicatorSelectors'

type DashboardPage = 'main' | 'life' | 'news'

type DashboardHeaderProps = {
  layoutEdit: boolean
  widgetsPanelOpen: boolean
  onToggleLayoutEdit: () => void
  onToggleWidgetsPanel: () => void
  layoutEditLocked?: boolean
  widgetsLocked?: boolean
  page?: DashboardPage
  onSetPage?: (page: DashboardPage) => void
}

const pad = (value: number) => String(value).padStart(2, '0')
const dayKeyOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

// "Another quote" holds for the rest of the day, then the day's own line returns.
const QUOTE_SKIP_KEY = 'focusgo.dashboard.quoteSkip'

const readQuoteSkip = (dayKey: string) => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUOTE_SKIP_KEY) ?? 'null') as { day?: string; skip?: number } | null
    return parsed?.day === dayKey && Number.isInteger(parsed.skip) ? (parsed.skip as number) : 0
  } catch {
    return 0
  }
}

const writeQuoteSkip = (dayKey: string, skip: number) => {
  try {
    window.localStorage.setItem(QUOTE_SKIP_KEY, JSON.stringify({ day: dayKey, skip }))
  } catch {
    // private mode / quota: the skip just won't survive a reload
  }
}

const DashboardHeader = ({
  layoutEdit,
  widgetsPanelOpen,
  onToggleLayoutEdit,
  onToggleWidgetsPanel,
  layoutEditLocked = false,
  widgetsLocked = false,
  page = 'main',
  onSetPage,
}: DashboardHeaderProps) => {
  const { language, t } = useI18n()
  const showProjectBadges = false
  const today = useToday()
  const dayKey = dayKeyOf(today)
  const zh = language === 'zh'
  const weekday = new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-US', { weekday: 'long' }).format(today)
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(today)
  // One line after the date: weekday, then the lunar day and anything special about it.
  const dayNotes = zh
    ? [`${t('dashboard.lunar')}${lunarDateLabel(today)}`, lunarFestivalOn(today), solarTermOn(today)].filter(
        (note): note is string => Boolean(note),
      )
    : [String(today.getFullYear())]

  const [quoteSkip, setQuoteSkip] = useState(() => ({ day: dayKey, skip: readQuoteSkip(dayKey) }))
  const skip = quoteSkip.day === dayKey ? quoteSkip.skip : 0
  const quote = quoteForDay(today, language, skip)
  const showAnotherQuote = () => {
    const next = skip + 1
    setQuoteSkip({ day: dayKey, skip: next })
    writeQuoteSkip(dayKey, next)
  }

  const handleSetPage = (nextPage: DashboardPage) => {
    onSetPage?.(nextPage)
    if (nextPage === 'life') markDiscoveryNewTargetSeen('dashboard-life-tab')
    if (nextPage === 'news') markDiscoveryNewTargetSeen('dashboard-news-tab')
  }

  return (
    <header className="app-shell__header">
      <div className="dash-hero">
        <div className="dash-hero__day">
          <time className="dash-hero__date" dateTime={dayKey}>
            {zh ? (
              <>
                <span className="dash-hero__num">{today.getMonth() + 1}</span>
                <span className="dash-hero__unit">月</span>
                <span className="dash-hero__num">{today.getDate()}</span>
                <span className="dash-hero__unit">日</span>
              </>
            ) : (
              <>
                <span className="dash-hero__month">{monthName}</span>
                <span className="dash-hero__num">{today.getDate()}</span>
              </>
            )}
          </time>
          <div className="dash-hero__meta">
            <span className="dash-hero__weekday">{weekday}</span>
            {dayNotes.map((note) => (
              <span key={note} className="dash-hero__note">
                <span className="dash-hero__sep" aria-hidden="true">·</span>
                {note}
              </span>
            ))}
            <span className="dash-hero__sep" aria-hidden="true">·</span>
            <LiveClock className="dash-hero__time" showSeconds={false} />
          </div>
        </div>
        <figure className="dash-hero__quote" key={`${quote.id}-${language}`}>
          <blockquote
            className="dash-hero__quote-text"
            title={quote.original ? `${quote.original.content} — ${quote.original.author}` : undefined}
          >
            “{quote.content}”
          </blockquote>
          <figcaption className={`dash-hero__quote-by${zh ? ' dash-hero__quote-by--zh' : ''}`}>
            {zh ? `——${quote.author}` : `— ${quote.author}`}
          </figcaption>
          <button
            type="button"
            className="dash-hero__quote-next"
            onClick={showAnotherQuote}
            aria-label={t('dashboard.quote.next')}
            title={t('dashboard.quote.next')}
          >
            <RefreshCw size={12} aria-hidden="true" />
          </button>
        </figure>
      </div>
      <div className="app-shell__status">
        {showProjectBadges && !layoutEdit ? <span className="pill">{t('dashboard.quote.localFirst')}</span> : null}
        {showProjectBadges && !layoutEdit ? <span className="pill pill--soft">{t('dashboard.quote.mvp')}</span> : null}

        {/* Unified pill: Focus/Life/News toggle + action buttons */}
        <div className="header-pill">
          {onSetPage ? (
            <>
              <ActiveIndicator selector={SELECTED_TAB} />
              <button
                role="tab"
                aria-selected={page === 'main'}
                className={`header-pill__btn${page === 'main' ? ' is-active' : ''}`}
                onClick={() => handleSetPage('main')}
              >
                Focus
              </button>
              <button
                role="tab"
                aria-selected={page === 'life'}
                className={`header-pill__btn${page === 'life' ? ' is-active' : ''}`}
                onClick={() => handleSetPage('life')}
              >
                Life
                <DiscoveryNewBadge target="dashboard-life-tab" />
              </button>
              <button
                role="tab"
                aria-selected={page === 'news'}
                className={`header-pill__btn${page === 'news' ? ' is-active' : ''}`}
                onClick={() => handleSetPage('news')}
              >
                News
                <DiscoveryNewBadge target="dashboard-news-tab" />
              </button>
              <div className="header-pill__divider" aria-hidden="true" />
            </>
          ) : null}

          {layoutEdit && page !== 'news' ? (
            <button
              type="button"
              className={`header-pill__btn${widgetsPanelOpen ? ' is-active' : ''}`}
              onClick={onToggleWidgetsPanel}
              data-locked={widgetsLocked ? 'true' : 'false'}
              aria-label={t('dashboard.manageVisibility')}
              aria-expanded={widgetsPanelOpen}
            >
              <span>{t('dashboard.manageWidgets')}</span>
              {widgetsLocked ? <PremiumMark /> : null}
            </button>
          ) : null}

          {page !== 'news' ? (
            <button
              type="button"
              className={`header-pill__btn${layoutEdit ? ' is-active' : ''}`}
              onClick={onToggleLayoutEdit}
              data-locked={layoutEditLocked ? 'true' : 'false'}
              aria-label={layoutEdit ? t('dashboard.layoutEdit') : t('dashboard.editLayout')}
              aria-expanded={layoutEdit}
            >
              <LayoutGrid size={14} aria-hidden="true" />
              <span>{layoutEdit ? t('dashboard.done') : t('dashboard.editLayout')}</span>
              {!layoutEdit && layoutEditLocked ? <PremiumMark /> : null}
            </button>
          ) : null}

          {!layoutEdit ? (
            <Link
              to={ROUTES.SETTINGS}
              className="header-pill__btn"
              aria-label={t('dashboard.settings')}
            >
              <SettingsIcon size={14} aria-hidden="true" />
              <span>{t('dashboard.settings')}</span>
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export default DashboardHeader
