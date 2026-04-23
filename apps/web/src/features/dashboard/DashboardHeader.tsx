import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, Settings as SettingsIcon } from 'lucide-react'
import { ROUTES } from '../../app/routes/routes'
import { useI18n } from '../../shared/i18n/useI18n'
import { useIsBreakpoint } from '../../hooks/use-is-breakpoint'
import LiveClock from './LiveClock'
import { getDashboardQuote, getLocalDashboardQuote } from './quote/quoteService'
import '../life/life.css'

type DashboardPage = 'main' | 'life'

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

const formatLunar = (date: Date) => {
  const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long', day: 'numeric' }).formatToParts(date)
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const rawDay = parts.find((part) => part.type === 'day')?.value ?? ''
  const dayNumber = Number.parseInt(rawDay, 10)
  const dayLabel =
    Number.isNaN(dayNumber) || dayNumber <= 0 || dayNumber >= LUNAR_DAY_LABELS.length ? rawDay : LUNAR_DAY_LABELS[dayNumber]
  return `${month}${dayLabel}`
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
  const isMobile = useIsBreakpoint('max', 768)
  const headerLayout = DEFAULT_HEADER_INFO_LAYOUT
  const showProjectBadges = false
  const now = new Date()
  const weekday = new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'long' }).format(now)
  const gregorian = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`
  const headerLunar = `${t('dashboard.lunar')} ${formatLunar(now)}`
  const fallbackQuote = useMemo(() => getLocalDashboardQuote(language), [language])
  const [quote, setQuote] = useState(() => fallbackQuote)
  const displayedQuote = quote.language === language ? quote : fallbackQuote

  useEffect(() => {
    const controller = new AbortController()
    const loadQuote = () => {
      void getDashboardQuote(language, { signal: controller.signal })
        .then((nextQuote) => {
          if (!controller.signal.aborted) setQuote(nextQuote)
        })
        .catch(() => {})
    }
    const idleId = window.requestIdleCallback?.(loadQuote, { timeout: 2500 })
    const timeoutId = idleId === undefined ? window.setTimeout(loadQuote, 1200) : null

    return () => {
      controller.abort()
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId)
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [language])

  const getNodeStyle = (nodeId: HeaderInfoNodeId): CSSProperties => {
    const node = headerLayout[nodeId]
    if (isMobile) {
      return {
        '--node-scale': `${node.scale * 1.2}`,
        position: 'static',
      } as CSSProperties
    }
    return {
      left: `${node.x}px`,
      top: `${node.y}px`,
      '--node-scale': `${node.scale}`,
    } as CSSProperties
  }

  return (
    <header className={`app-shell__header ${isMobile ? 'is-mobile' : ''}`}>
      <div
        className="app-shell__hero-stage"
        aria-live="polite"
        style={isMobile ? { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minHeight: 'auto', padding: '16px 0' } : undefined}
      >
        <div
          className="app-shell__hero-item app-shell__hero-item--clock"
          style={getNodeStyle('clock')}
        >
          <LiveClock className="app-shell__hero-time" />
        </div>
        <div style={isMobile ? { display: 'flex', gap: '12px', alignItems: 'baseline' } : undefined}>
          <div
            className="app-shell__hero-item app-shell__hero-item--lunar"
            style={getNodeStyle('lunar')}
          >
            <p className="app-shell__hero-lunar">
              {language === 'zh' ? <span>{headerLunar}</span> : null}
              <span style={{ marginLeft: language === 'zh' ? '18px' : 0 }}>{gregorian}</span>
              <span style={{ marginLeft: '14px' }}>{weekday}</span>
            </p>
          </div>
        </div>
        <div
          className="app-shell__hero-item app-shell__hero-item--quote"
          style={isMobile ? { position: 'static', marginTop: '8px', padding: '0 24px', textAlign: 'center' } : undefined}
        >
          <div
            key={displayedQuote.content}
            className="app-shell__hero-quote-content"
            style={isMobile ? { width: 'auto', justifyContent: 'center', flexWrap: 'wrap' } : undefined}
          >
            <p className="app-shell__hero-quote">"{displayedQuote.content}"</p>
            <p className="app-shell__hero-quote-author">- {displayedQuote.author}</p>
          </div>
        </div>
      </div>
      <div className="app-shell__status">
        {showProjectBadges && !layoutEdit ? <span className="pill">{t('dashboard.quote.localFirst')}</span> : null}
        {showProjectBadges && !layoutEdit ? <span className="pill pill--soft">{t('dashboard.quote.mvp')}</span> : null}

        {/* Unified pill: Focus/Life toggle + action buttons */}
        <div className="header-pill">
          {onSetPage ? (
            <>
              <button
                role="tab"
                aria-selected={page === 'main'}
                className={`header-pill__btn${page === 'main' ? ' is-active' : ''}`}
                onClick={() => onSetPage('main')}
              >
                Focus
              </button>
              <button
                role="tab"
                aria-selected={page === 'life'}
                className={`header-pill__btn${page === 'life' ? ' is-active' : ''}`}
                onClick={() => onSetPage('life')}
              >
                Life
              </button>
              <div className="header-pill__divider" aria-hidden="true" />
            </>
          ) : null}

          {layoutEdit ? (
            <button
              type="button"
              className={`header-pill__btn${widgetsPanelOpen ? ' is-active' : ''}`}
              onClick={onToggleWidgetsPanel}
              data-locked={widgetsLocked ? 'true' : 'false'}
              aria-label={t('dashboard.manageVisibility')}
              aria-expanded={widgetsPanelOpen}
            >
              <span>{t('dashboard.manageWidgets')}</span>
            </button>
          ) : null}

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
          </button>

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
