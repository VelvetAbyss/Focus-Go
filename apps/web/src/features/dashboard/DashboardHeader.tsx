import { type CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { LayoutGrid, Settings as SettingsIcon } from 'lucide-react'
import { ROUTES } from '../../app/routes/routes'
import { useI18n } from '../../shared/i18n/useI18n'
import { useIsBreakpoint } from '../../hooks/use-is-breakpoint'
import LiveClock from './LiveClock'

type DashboardHeaderProps = {
  layoutEdit: boolean
  widgetsPanelOpen: boolean
  onToggleLayoutEdit: () => void
  onToggleWidgetsPanel: () => void
  onRestartOnboarding?: () => void
  showRestartOnboarding?: boolean
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
  onRestartOnboarding,
  showRestartOnboarding = false,
}: DashboardHeaderProps) => {
  const { language, t } = useI18n()
  const isMobile = useIsBreakpoint('max', 768)
  const headerLayout = DEFAULT_HEADER_INFO_LAYOUT
  const showProjectBadges = false
  const now = new Date()
  const weekday = new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'long' }).format(now)
  const gregorian = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`
  const headerLunar = `${t('dashboard.lunar')} ${formatLunar(now)}`

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
              <span>{headerLunar}</span>
              <span style={{ marginLeft: '18px' }}>{gregorian}</span>
              <span style={{ marginLeft: '14px' }}>{weekday}</span>
            </p>
          </div>
        </div>
        <div
          className="app-shell__hero-item app-shell__hero-item--quote"
          style={isMobile ? { position: 'static', marginTop: '8px', padding: '0 24px', textAlign: 'center' } : undefined}
        >
          <div className="app-shell__hero-quote-content" style={isMobile ? { width: 'auto', justifyContent: 'center', flexWrap: 'wrap' } : undefined}>
            <p className="app-shell__hero-quote">"{language === 'zh' ? '千里之行，始于足下。' : 'Success is the sum of small efforts, repeated day in and day out.'}"</p>
            <p className="app-shell__hero-quote-author">- {language === 'zh' ? '《道德经》' : 'Robert Collier'}</p>
          </div>
        </div>
      </div>
      <div className="app-shell__status">
        {showProjectBadges && !layoutEdit ? <span className="pill">{t('dashboard.quote.localFirst')}</span> : null}
        {showProjectBadges && !layoutEdit ? <span className="pill pill--soft">{t('dashboard.quote.mvp')}</span> : null}
        {!layoutEdit && showRestartOnboarding && onRestartOnboarding ? (
          <Button
            type="button"
            className="app-shell__top-action"
            variant="outline"
            size="sm"
            onClick={onRestartOnboarding}
          >
            <span>{t('dashboard.restartOnboarding')}</span>
          </Button>
        ) : null}
        {layoutEdit ? (
          <Button
            type="button"
            className={`app-shell__top-action app-shell__manage-widgets ${widgetsPanelOpen ? 'is-active' : ''}`}
            variant="outline"
            size="sm"
            onClick={onToggleWidgetsPanel}
            aria-label={t('dashboard.manageVisibility')}
            aria-expanded={widgetsPanelOpen}
          >
            <span>{t('dashboard.manageWidgets')}</span>
          </Button>
        ) : null}
        <Button
          type="button"
          className={`app-shell__top-action app-shell__edit-layout ${layoutEdit ? 'is-active' : ''}`}
          variant="outline"
          size="sm"
          onClick={onToggleLayoutEdit}
          aria-label={layoutEdit ? t('dashboard.layoutEdit') : t('dashboard.editLayout')}
          aria-expanded={layoutEdit}
        >
          <LayoutGrid size={15} aria-hidden="true" />
          <span>{layoutEdit ? t('dashboard.done') : t('dashboard.editLayout')}</span>
        </Button>
        {!layoutEdit ? (
          <Button
            asChild
            className="app-shell__top-action app-shell__settings-link"
            variant="outline"
            size="sm"
            aria-label={t('dashboard.settings')}
          >
            <Link to={ROUTES.SETTINGS}>
              <SettingsIcon size={15} aria-hidden="true" />
              <span>{t('dashboard.settings')}</span>
            </Link>
          </Button>
        ) : null}
      </div>
    </header>
  )
}

export default DashboardHeader
