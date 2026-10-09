import { useState } from 'react'
import { Check, LayoutGrid, Plus, RefreshCw } from 'lucide-react'
import { useI18n } from '../../shared/i18n/useI18n'
import { useToday } from '../../shared/hooks/useToday'
import { DiscoveryNewBadge } from '../../shared/ui/DiscoveryNewBadge'
import { markDiscoveryNewTargetSeen } from '../../shared/discovery/discoveryNewTargetActions'
import LiveClock from './LiveClock'
import { quoteForDay } from './quote/quoteService'
import { lunarDateLabel, lunarFestivalOn, solarTermOn } from './header/chineseDay'
import PremiumMark from '../premium/PremiumMark'
import '../life/life.css'
import './header/dashboard-header.css'
import ActiveIndicator from '../../shared/motion/ActiveIndicator'

export type DashboardPage = 'main' | 'life' | 'news' | 'custom'

type DashboardHeaderProps = {
  customViews?: { id: string; name: string }[]
  selectedViewId?: string
  onSelectView?: (id: string) => void
  onCreateView?: () => void
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

// A Chinese line breaks only after its punctuation, never inside a phrase;
// other languages come back as one piece and wrap between words as usual.
const quotePhrases = (text: string) => text.match(/[^，。？！；：、]+[，。？！；：、”]*/g) ?? [text]

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
  customViews = [], selectedViewId, onSelectView, onCreateView,
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

  const showLayoutActions = page !== 'news' && page !== 'custom'

  // A masthead to read (the date on the left, the day's line on the right as
  // its epigraph), then a ruled toolbar to operate: the views as tabs on the
  // left, the layout actions on the right (DESIGN.md › Dashboard header).
  return (
    <header className="app-shell__header dash-header">
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
            {quotePhrases(`“${quote.content}”`).map((phrase, index) => (
              <span key={index} className="dash-hero__quote-phrase">{phrase}</span>
            ))}
          </blockquote>
          <figcaption className={`dash-hero__quote-by${zh ? ' dash-hero__quote-by--zh' : ''}`}>
            <button
              type="button"
              className="dash-hero__quote-next"
              onClick={showAnotherQuote}
              aria-label={t('dashboard.quote.next')}
              title={t('dashboard.quote.next')}
            >
              <RefreshCw size={12} aria-hidden="true" />
            </button>
            {zh ? `——${quote.author}` : `— ${quote.author}`}
          </figcaption>
        </figure>
      </div>

      <div className="dash-toolbar">
        {onSetPage ? (
          <div className="dash-toolbar__views">
            <ActiveIndicator selector={`:scope [role="tab"][aria-selected="true"], :scope > .is-active`} />
            <div className="dash-toolbar__tabs" role="tablist" aria-label={t('dashboard.views.aria')}>
              <button
                type="button"
                role="tab"
                aria-selected={page === 'main'}
                className="dash-toolbar__tab"
                onClick={() => handleSetPage('main')}
              >
                {t('dashboard.page.focus')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={page === 'life'}
                className="dash-toolbar__tab"
                onClick={() => handleSetPage('life')}
              >
                {t('dashboard.page.life')}
                <DiscoveryNewBadge target="dashboard-life-tab" />
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={page === 'news'}
                className="dash-toolbar__tab"
                onClick={() => handleSetPage('news')}
              >
                {t('dashboard.page.news')}
                <DiscoveryNewBadge target="dashboard-news-tab" />
              </button>
            </div>
            {customViews.length > 0 ? (
              <select
                className={`dash-toolbar__tab dash-toolbar__select${page === 'custom' ? ' is-active' : ''}`}
                aria-label={t('dashboard.views.mine')}
                value={page === 'custom' ? selectedViewId : ''}
                onChange={(event) => onSelectView?.(event.target.value)}
              >
                <option value="" disabled>{t('dashboard.views.mine')}</option>
                {customViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
              </select>
            ) : null}
            {onCreateView ? (
              <button
                type="button"
                className="dash-toolbar__add"
                onClick={onCreateView}
                aria-label={t('dashboard.views.new')}
                title={t('dashboard.views.new')}
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : <span />}

        {showLayoutActions ? (
          <div className="dash-toolbar__actions">
            {layoutEdit ? (
              <button
                type="button"
                className={`dash-toolbar__action${widgetsPanelOpen ? ' is-active' : ''}`}
                onClick={onToggleWidgetsPanel}
                data-locked={widgetsLocked ? 'true' : 'false'}
                aria-label={t('dashboard.manageVisibility')}
                aria-expanded={widgetsPanelOpen}
              >
                <span>{t('dashboard.manageWidgets')}</span>
                {widgetsLocked ? <PremiumMark /> : null}
              </button>
            ) : null}
            <button
              type="button"
              className={`dash-toolbar__action${layoutEdit ? ' is-primary' : ''}`}
              onClick={onToggleLayoutEdit}
              data-locked={layoutEditLocked ? 'true' : 'false'}
              aria-label={layoutEdit ? t('dashboard.layoutEdit') : t('dashboard.editLayout')}
              aria-expanded={layoutEdit}
            >
              {layoutEdit ? <Check size={14} aria-hidden="true" /> : <LayoutGrid size={14} aria-hidden="true" />}
              <span>{layoutEdit ? t('dashboard.done') : t('dashboard.editLayout')}</span>
              {!layoutEdit && layoutEditLocked ? <PremiumMark /> : null}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}

export default DashboardHeader
