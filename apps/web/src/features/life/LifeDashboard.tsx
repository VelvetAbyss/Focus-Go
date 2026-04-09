import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { GridLayout, useContainerWidth } from 'react-grid-layout'
import { absoluteStrategy } from 'react-grid-layout/core'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useIsBreakpoint } from '../../hooks/use-is-breakpoint'
import { getLifeCards, type DashboardCard } from '../dashboard/registry'
import type { DashboardLayoutItem } from '../../data/models/types'
import { useDashboardGridEdit } from '../dashboard/useDashboardGridEdit'
import { lifeDashboardRepo } from '../../data/repositories/lifeDashboardRepo'
import './life.css'

type LifeDashboardProps = {
  layoutEdit: boolean
  widgetsPanelOpen: boolean
}

const DEFAULT_LIFE_LAYOUT: DashboardLayoutItem[] = [
  { key: 'daily_review', x: 0, y: 0, w: 14, h: 8 },
  { key: 'library', x: 14, y: 0, w: 10, h: 8 },
  { key: 'stocks', x: 0, y: 8, w: 8, h: 8 },
  { key: 'media_card', x: 8, y: 8, w: 8, h: 8 },
  { key: 'trips_card', x: 16, y: 8, w: 8, h: 8 },
  { key: 'subscriptions_card', x: 0, y: 16, w: 24, h: 4 },
]

const LifeDashboard = ({ layoutEdit, widgetsPanelOpen }: LifeDashboardProps) => {
  const isMobile = useIsBreakpoint('max', 768)
  const columns = isMobile ? 8 : 24
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: window.innerWidth })
  const [layout, setLayout] = useState<DashboardLayoutItem[]>([])
  const [hiddenCardIds, setHiddenCardIds] = useState<string[]>([])
  const layoutSnapshotRef = useRef<{ layout: DashboardLayoutItem[]; hiddenCardIds: string[] }>({ layout: [], hiddenCardIds: [] })

  const cards = useMemo(() => getLifeCards(), [])
  const cardsById = useMemo(() => new Map<string, DashboardCard>(cards.map((c) => [c.id, c])), [cards])

  const responsiveLayout = useMemo(() => {
    if (!isMobile) return layout
    return layout.map((item) => {
      const mobileW = Math.max(4, Math.round((item.w / 24) * 8))
      const mobileX = Math.min(8 - mobileW, Math.round((item.x / 24) * 8))
      return { ...item, w: mobileW, x: mobileX }
    })
  }, [isMobile, layout])

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
    minW: isMobile ? 4 : 4,
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
      const hidden = (stored?.hiddenCardIds ?? []).filter((id) => allowed.has(id))
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
  const visibleCardIdsKey = useMemo(() => visibleCardIds.join('|'), [visibleCardIds])
  const renderedCards = useMemo(
    () =>
      visibleCardIds.reduce<Array<{ id: string; node: ReactNode }>>((result, id) => {
        const card = cardsById.get(id)
        if (card) result.push({ id, node: card.render() })
        return result
      }, []),
    [cardsById, visibleCardIdsKey],
  )

  const handleWidgetToggle = useCallback((cardId: string, visible: boolean) => {
    if (visible) {
      void persistLayout(appendCardToEnd(cardId, layout), hiddenCardIds.filter((id) => id !== cardId))
      return
    }
    if (layout.length <= 1) return
    void persistLayout(layout.filter((item) => item.key !== cardId), hiddenCardIds.includes(cardId) ? hiddenCardIds : [...hiddenCardIds, cardId])
  }, [appendCardToEnd, hiddenCardIds, layout, persistLayout])

  return (
    <div className="life-dashboard" ref={containerRef}>
      {layoutEdit && widgetsPanelOpen ? (
        <section className="dashboard-widgets" aria-label="Manage life widgets">
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

      {mounted && (
        <GridLayout
          className="life-dashboard__grid"
          layout={responsiveLayout.map((item) => ({
            i: item.key,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
            minW: isMobile ? 2 : 2,
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
          positionStrategy={layoutEdit ? absoluteStrategy : undefined}
          width={Math.max(width, 320)}
        >
          {renderedCards.map((card) => (
            <div key={card.id} className={`dashboard__item${layoutEdit ? ' is-layout-edit' : ''}${gridEdit.activeId === card.id ? ' is-dragging' : ''}`}>
              {card.node}
              {layoutEdit ? (
                <>
                  <div className="dashboard__edit-overlay" {...gridEdit.dragProps(card.id)} aria-label="Edit layout">
                    <span>Edit layout</span>
                  </div>
                  <div className="dashboard__resize-handle" {...gridEdit.resizeProps(card.id)} />
                </>
              ) : null}
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  )
}

export default LifeDashboard
