import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { GridLayout, useContainerWidth } from 'react-grid-layout'
import { absoluteStrategy } from 'react-grid-layout/core'
import { projectLayout, resolveDashboardGrid, useViewportWidth } from '../../shared/responsive/breakpoints'

/** The column count Life layouts are authored and stored against. */
const LIFE_BASE_COLUMNS = 24
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { getLifeCards, type DashboardCard } from '../dashboard/registry'
import type { DashboardLayoutItem } from '../../data/models/types'
import { useDashboardGridEdit } from '../dashboard/useDashboardGridEdit'
import { lifeDashboardRepo } from '../../data/repositories/lifeDashboardRepo'
import AuthInteractionGate from '../auth/AuthInteractionGate'
import { useLifeI18n } from './lifeI18n'
import { DiscoveryNewBadge } from '../../shared/ui/DiscoveryNewBadge'
import { markDiscoveryNewTargetSeen } from '../../shared/discovery/discoveryNewTargetActions'
import { LIFE_CARD_DISCOVERY_TARGET_BY_ID } from '../../shared/discovery/newTargets'
import './life.css'

type LifeDashboardProps = {
  layoutEdit: boolean
  widgetsPanelOpen: boolean
}

const DeferredLifeCard = ({ id, eager, children }: { id: string; eager: boolean; children: ReactNode }) => {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(eager)

  useEffect(() => {
    if (eager || visible) return
    const node = hostRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: '240px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [eager, visible])

  return (
    <div ref={hostRef} data-life-card={id} style={{ width: '100%', height: '100%' }}>
      {visible ? children : (
        <div
          aria-hidden="true"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 24,
            background: 'var(--bg-elevated)',
            boxShadow: 'var(--shadow-card)',
          }}
        />
      )}
    </div>
  )
}

const DEFAULT_LIFE_LAYOUT: DashboardLayoutItem[] = [
  { key: 'library', x: 5, y: 0, w: 6, h: 8 },
  { key: 'media_card', x: 5, y: 28, w: 6, h: 7 },
  { key: 'subscriptions_card', x: 18, y: 24, w: 6, h: 7 },
  { key: 'daily_review', x: 11, y: 50, w: 7, h: 7 },
  { key: 'trips_card', x: 18, y: 7, w: 6, h: 8 },
  { key: 'podcast_card', x: 0, y: 38, w: 5, h: 15 },
  { key: 'people_card', x: 11, y: 15, w: 7, h: 8 },
]

const DEFAULT_LIFE_HIDDEN_CARD_IDS = ['stocks']

const LifeDashboard = ({ layoutEdit, widgetsPanelOpen }: LifeDashboardProps) => {
  const { t } = useLifeI18n()
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: window.innerWidth })
  const viewportWidth = useViewportWidth()
  const grid = useMemo(() => resolveDashboardGrid({ viewportWidth, containerWidth: width, baseColumns: LIFE_BASE_COLUMNS }), [viewportWidth, width])
  const columns = grid.columns
  const isStacked = grid.mode === 'stacked'
  const [layout, setLayout] = useState<DashboardLayoutItem[]>([])
  const [hiddenCardIds, setHiddenCardIds] = useState<string[]>([])
  const layoutSnapshotRef = useRef<{ layout: DashboardLayoutItem[]; hiddenCardIds: string[] }>({ layout: [], hiddenCardIds: [] })

  const cards = useMemo(() => getLifeCards(t), [t])
  const cardsById = useMemo(() => new Map<string, DashboardCard>(cards.map((c) => [c.id, c])), [cards])

  const { items: responsiveLayout } = useMemo(
    () => projectLayout(layout, grid, LIFE_BASE_COLUMNS),
    [grid, layout],
  )

  const persistLayout = useCallback(async (nextLayout: DashboardLayoutItem[], nextHiddenCardIds: string[]) => {
    setLayout(nextLayout)
    setHiddenCardIds(nextHiddenCardIds)
    await lifeDashboardRepo.upsert({
      items: nextLayout,
      hiddenCardIds: nextHiddenCardIds,
    })
  }, [])

  const appendCardToEnd = useCallback((cardId: string, nextLayout: DashboardLayoutItem[]) => {
    const card = cardsById.get(cardId)
    if (!card || nextLayout.some((item) => item.key === cardId)) return nextLayout
    const maxY = nextLayout.reduce((max, item) => Math.max(max, item.y + item.h), 0)
    return [...nextLayout, { key: cardId, x: 0, y: maxY, w: card.defaultSize.w, h: card.defaultSize.h }]
  }, [cardsById])

  const gridEdit = useDashboardGridEdit({
    layout: responsiveLayout,
    enabled: layoutEdit,
    cols: columns,
    rowHeight: 30,
    margin: [18, 18] as [number, number],
    padding: [18, 18] as [number, number],
    width: Math.max(width, 320),
    minW: grid.minSpan,
    minH: 4,
    onUpdate: setLayout,
    onCommit: (finalLayout) => {
      void persistLayout(finalLayout, hiddenCardIds)
    },
  })

  useEffect(() => {
    if (gridEdit.activeId) return
    layoutSnapshotRef.current = { layout, hiddenCardIds }
  }, [gridEdit.activeId, hiddenCardIds, layout])

  useEffect(() => {
    const allowed = new Set(cards.map((card) => card.id))
    void lifeDashboardRepo.get().then((stored) => {
      const hidden = (stored?.hiddenCardIds ?? DEFAULT_LIFE_HIDDEN_CARD_IDS).filter((id) => allowed.has(id))
      const hiddenSet = new Set(hidden)
      const baseLayout = stored?.items?.length ? stored.items : DEFAULT_LIFE_LAYOUT
      const next = baseLayout.filter((item) => allowed.has(item.key) && !hiddenSet.has(item.key))
      const existingKeys = new Set(next.map((item) => item.key))
      hidden.forEach((id) => existingKeys.add(id))
      const maxY = next.reduce((max, item) => Math.max(max, item.y + item.h), 0)
      let cursorY = maxY
      const missing = cards
        .filter((card) => !existingKeys.has(card.id))
        .map((card) => {
          const item = { key: card.id, x: 0, y: cursorY, w: card.defaultSize.w, h: card.defaultSize.h }
          cursorY += card.defaultSize.h
          return item
        })
      const merged = [...next, ...missing]
      setLayout(merged)
      setHiddenCardIds(hidden)
      if (!stored) {
        void lifeDashboardRepo.upsert({ items: merged, hiddenCardIds: hidden })
      }
    })
  }, [cards])

  const visibleCardIds = useMemo(
    () => layout.map((item) => item.key).filter((id) => cardsById.has(id)),
    [layout, cardsById],
  )
  const renderedCards = useMemo(
    () =>
      visibleCardIds.reduce<Array<{ id: string; node: ReactNode }>>((result, id) => {
        const card = cardsById.get(id)
        if (card) result.push({ id, node: card.render() })
        return result
      }, []),
    [cardsById, visibleCardIds],
  )

  const handleWidgetToggle = useCallback((cardId: string, visible: boolean) => {
    if (visible) {
      void persistLayout(appendCardToEnd(cardId, layout), hiddenCardIds.filter((id) => id !== cardId))
      return
    }
    if (layout.length <= 1) return
    void persistLayout(layout.filter((item) => item.key !== cardId), hiddenCardIds.includes(cardId) ? hiddenCardIds : [...hiddenCardIds, cardId])
  }, [appendCardToEnd, hiddenCardIds, layout, persistLayout])

  if (!mounted || layout.length === 0) {
    return (
      <div className="life-dashboard" ref={containerRef}>
        <div className="life-dashboard__skeleton" data-testid="life-dashboard-loader" aria-hidden="true">
          <div className="life-dashboard__skeleton-line" />
          <div className="life-dashboard__skeleton-card life-dashboard__skeleton-card--wide" />
          <div className="life-dashboard__skeleton-card life-dashboard__skeleton-card--medium" />
          <div className="life-dashboard__skeleton-card life-dashboard__skeleton-card--medium" />
          <div className="life-dashboard__skeleton-card life-dashboard__skeleton-card--medium" />
          <div className="life-dashboard__skeleton-card life-dashboard__skeleton-card--medium" />
          <div className="life-dashboard__skeleton-card life-dashboard__skeleton-card--full" />
        </div>
      </div>
    )
  }

  return (
    <div className="life-dashboard" ref={containerRef}>
      <AuthInteractionGate>
      {layoutEdit && widgetsPanelOpen ? (
        <section className="dashboard-widgets" aria-label={t('life.dashboard.manageWidgets')}>
          {cards.map((card) => {
            const visible = layout.some((item) => item.key === card.id)
            const switchId = `life-widget-toggle-${card.id}`
            return (
              <div key={card.id} className="dashboard-widgets__row">
                <Label htmlFor={switchId} className="dashboard-widgets__title">{card.title}</Label>
                <Switch id={switchId} checked={visible} disabled={visible && layout.length <= 1} onCheckedChange={(checked) => handleWidgetToggle(card.id, checked)} />
              </div>
            )
          })}
        </section>
      ) : null}
      {isStacked ? (
        <section className="dashboard__stack">
          {[...renderedCards]
            .sort((a, b) => {
              const pa = responsiveLayout.find((item) => item.key === a.id)
              const pb = responsiveLayout.find((item) => item.key === b.id)
              return (pa?.y ?? 0) - (pb?.y ?? 0)
            })
            .map((card) => {
              const discoveryTarget = LIFE_CARD_DISCOVERY_TARGET_BY_ID[card.id]
              return (
                <div
                  key={card.id}
                  className="dashboard__item dashboard__item--stacked"
                  onPointerDownCapture={() => { if (discoveryTarget) markDiscoveryNewTargetSeen(discoveryTarget) }}
                >
                  <DeferredLifeCard id={card.id} eager>{card.node}</DeferredLifeCard>
                  {discoveryTarget ? <DiscoveryNewBadge target={discoveryTarget} className="discovery-new-badge--card" /> : null}
                </div>
              )
            })}
        </section>
      ) : (
      <GridLayout
          className="life-dashboard__grid"
          layout={responsiveLayout.map((item) => ({
            i: item.key,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
            minW: grid.minSpan,
            minH: 4,
            maxW: columns,
          }))}
          gridConfig={{
            cols: columns,
            rowHeight: 30,
            margin: [18, 18],
            containerPadding: [18, 18],
            maxRows: 200,
          }}
          dragConfig={{ enabled: false }}
          resizeConfig={{ enabled: false }}
          positionStrategy={absoluteStrategy}
          width={Math.max(width, 320)}
        >
          {renderedCards.map((card) => {
            const discoveryTarget = LIFE_CARD_DISCOVERY_TARGET_BY_ID[card.id]
            return (
            <div
              key={card.id}
              className={`dashboard__item${layoutEdit ? ' is-layout-edit' : ''}${gridEdit.activeId === card.id ? ' is-dragging' : ''}`}
              onPointerDownCapture={() => { if (discoveryTarget) markDiscoveryNewTargetSeen(discoveryTarget) }}
            >
              <DeferredLifeCard id={card.id} eager={layoutEdit}>{card.node}</DeferredLifeCard>
              {discoveryTarget ? <DiscoveryNewBadge target={discoveryTarget} className="discovery-new-badge--card" /> : null}
              {layoutEdit ? (
                <>
                  <div className="dashboard__edit-overlay" {...gridEdit.dragProps(card.id)} aria-label={t('life.dashboard.editLayout')}>
                    <span>{t('life.dashboard.editLayout')}</span>
                  </div>
                  <div className="dashboard__resize-handle" {...gridEdit.resizeProps(card.id)} />
                </>
              ) : null}
            </div>
            )
          })}
        </GridLayout>
      )}
      </AuthInteractionGate>
    </div>
  )
}

export default LifeDashboard
