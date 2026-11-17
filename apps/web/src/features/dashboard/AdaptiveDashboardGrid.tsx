import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Maximize2, X } from 'lucide-react'
import Dialog from '../../shared/ui/Dialog'
import { useI18n } from '../../shared/i18n/useI18n'
import type { DashboardLayoutItem } from '../../data/models/types'
import type { DashboardCard } from './registry'
import { fitDashboardLayout, type WidgetRect } from './fitDashboardLayout'
import { WidgetPresentationContext, type WidgetSummary } from './widgetPresentation'
import { widgetProfiles } from './widgetCatalog'
import './adaptive-dashboard.css'

function AdaptiveWidget({ card, rect, overview }: { card: DashboardCard; rect: WidgetRect; overview: boolean }) {
  const { language } = useI18n()
  const zh = language === 'zh'
  const profile = widgetProfiles[card.id]
  const title = profile ? (zh ? profile.zh : profile.en) : card.title
  const hint = profile ? (zh ? profile.hintZh : profile.hintEn) : ''
  const Icon = profile?.icon ?? Maximize2
  const compact = overview || rect.width < (profile?.minWidth ?? 320) || rect.height < (profile?.minHeight ?? 300)
  const density = rect.height < 76 ? 'micro' : rect.height < 145 ? 'small' : 'comfortable'
  const [summary, setSummary] = useState<WidgetSummary>({})
  const summaryRows = density === 'comfortable' ? Math.max(0, Math.min(3, Math.floor((rect.height - (summary.value ? 132 : 105)) / 34))) : 0
  const [expanded, setExpanded] = useState(false)
  const [host] = useState(() => {
    const element = document.createElement('div')
    element.className = 'adaptive-widget__host'
    return element
  })
  const detailRef = useRef<HTMLDivElement | null>(null)
  const inlineRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const restoreTriggerFocus = useCallback(() => triggerRef.current?.focus(), [])
  // A stable portal container keeps drafts, timers and pending requests alive
  // when the same DOM subtree moves into the detail sheet and back.
  const attachDetail = useCallback((element: HTMLDivElement | null) => {
    detailRef.current = element
    if (element) {
      element.appendChild(host)
      element.closest('[role=dialog]')?.setAttribute('aria-label', title)
      element.closest('[role=dialog]')?.querySelector<HTMLButtonElement>('[data-widget-close]')?.focus()
    } else inlineRef.current?.appendChild(host)
  }, [host, title])
  useLayoutEffect(() => {
    const destination = expanded ? detailRef.current : inlineRef.current
    destination?.appendChild(host)
    if (expanded) destination?.closest('[role=dialog]')?.querySelector<HTMLButtonElement>('[data-widget-close]')?.focus()
  }, [expanded, host])
  useEffect(() => {
    if (!expanded) return
    const shell = document.querySelector<HTMLElement>('.focus-shell')
    const wasInert = shell?.inert ?? false
    if (shell) shell.inert = true
    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.defaultPrevented) return
      const panel = detailRef.current?.closest('[role=dialog]')
      if (!panel) return
      // Existing Life editors and Radix popovers own focus while above us.
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role=dialog]')].filter(node => node.getClientRects().length > 0)
      if (dialogs.at(-1) !== panel) return
      const focusable = [...panel.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], [tabindex]')]
        .filter(node => node.tabIndex >= 0 && !node.hasAttribute('disabled') && node.getClientRects().length > 0)
      const first = focusable[0], last = focusable.at(-1)
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', handleTab)
    return () => {
      if (shell) shell.inert = wasInert
      document.removeEventListener('keydown', handleTab)
      restoreTriggerFocus()
    }
  }, [expanded, restoreTriggerFocus])
  const content = useMemo(() => card.render(), [card])
  const openLabel = zh ? `展开${title}` : `Open ${title}`
  return (
    <article className="adaptive-widget" data-widget={card.id} data-mode={compact ? 'summary' : 'full'} data-density={density} data-narrow={rect.width < 100} data-tone={profile?.tone ?? 'neutral'}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} aria-label={title}>
      <div ref={inlineRef} className="adaptive-widget__inline" hidden={compact || expanded} />
      {compact ? (
        <button ref={triggerRef} type="button" className="widget-glance" title={title} onClick={() => setExpanded(true)} aria-label={openLabel} data-auth-preview-allowed="true">
          <span className="widget-glance__heading"><Icon size={17} aria-hidden="true" /><span>{title}</span><ArrowUpRight size={15} className="widget-glance__arrow" aria-hidden="true" /></span>
          <span className="widget-glance__body">
            {summary.value ? <strong className="widget-glance__value">{summary.value}</strong> : null}
            <span className="widget-glance__detail">{summary.detail || hint}</span>
          </span>
          {summaryRows > 0 && summary.items?.length ? <span className="widget-glance__list">{summary.items.slice(0, summaryRows).map((item, index) => <span key={index}>{item}</span>)}</span> : null}
          {typeof summary.progress === 'number' ? <span className="widget-glance__progress" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, summary.progress))}%` }} /></span> : null}
        </button>
      ) : <button ref={triggerRef} type="button" className="adaptive-widget__expand" aria-label={openLabel} title={openLabel} onClick={() => setExpanded(true)} data-auth-preview-allowed="true"><Maximize2 size={16} /></button>}
      <WidgetPresentationContext.Provider value={setSummary}>{createPortal(content, host)}</WidgetPresentationContext.Provider>
      <Dialog open={expanded} onClose={() => setExpanded(false)} panelClassName="widget-detail" contentClassName="widget-detail__content">
        <header className="widget-detail__heading"><h2>{title}</h2><p>{zh ? '完成后关闭，回到工作台。' : 'Close when you’re ready to return to your desk.'}</p>
          <button type="button" data-widget-close data-auth-preview-allowed="true" className="widget-detail__close" aria-label={zh ? '关闭' : 'Close'} onClick={() => setExpanded(false)}><X size={20} /></button>
        </header>
        <div ref={attachDetail} className="widget-detail__body" />
      </Dialog>
    </article>
  )
}

export default function AdaptiveDashboardGrid({ layout, cards, columns, label }: { layout: DashboardLayoutItem[]; cards: DashboardCard[]; columns: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width <= 0 || height <= 0) return
      setSize(previous => Math.abs(previous.width - width) < .5 && Math.abs(previous.height - height) < .5 ? previous : { width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const byId = useMemo(() => new Map(cards.map(card => [card.id, card])), [cards])
  const visible = useMemo(() => layout.filter(item => byId.has(item.key)), [layout, byId])
  const rects = useMemo(() => fitDashboardLayout(visible, size.width, size.height, columns), [visible, size, columns])
  return <section className="dashboard-overview" aria-label={label}><div ref={ref} className="dashboard-overview__canvas">
    {rects.map(rect => <AdaptiveWidget key={rect.key} card={byId.get(rect.key)!} rect={rect} overview={size.width < 1100} />)}
  </div></section>
}
