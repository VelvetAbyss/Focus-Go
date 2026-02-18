import { useCallback, useEffect, useMemo, useState } from 'react'
import { GridLayout, useContainerWidth } from 'react-grid-layout'
import FadeContent from '../../shared/ui/FadeContent'
import Button from '../../shared/ui/Button'
import Dialog from '../../shared/ui/Dialog'
import { dashboardRepo } from '../../data/repositories/dashboardRepo'
import { getDashboardCards } from './registry'
import type { DashboardLayoutItem } from '../../data/models/types'
import DiaryPanel from '../diary/DiaryPanel'
import { useSearchParams } from 'react-router-dom'
import { syncDashboardLayout } from './layoutSyncAdapter'
import {
  DEFAULT_DASHBOARD_HIDDEN_CARD_IDS,
  DEFAULT_DASHBOARD_LAYOUT_ITEMS,
  DEFAULT_DASHBOARD_THEME_OVERRIDE,
} from '../../data/defaultDashboardLayout'

const LAYOUT_LOCK_KEY = 'workbench.dashboard.layoutLocked'

const readLayoutLocked = () => {
  const raw = localStorage.getItem(LAYOUT_LOCK_KEY)
  if (raw === null) return true
  return raw !== 'false'
}

const writeLayoutLocked = (locked: boolean) => {
  localStorage.setItem(LAYOUT_LOCK_KEY, locked ? 'true' : 'false')
}

const DashboardPage = () => {
  const [layout, setLayout] = useState<DashboardLayoutItem[]>([])
  const [hiddenCardIds, setHiddenCardIds] = useState<string[]>([])
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: window.innerWidth })
  const [searchParams, setSearchParams] = useSearchParams()
  const diaryOpen = searchParams.get('diary') === '1'
  const layoutEdit = searchParams.get('layoutEdit') === '1'
  const widgetsPanelOpen = searchParams.get('widgetsPanel') === '1'
  const [confirmHideCardId, setConfirmHideCardId] = useState<string | null>(null)
  const [hideSubmitting, setHideSubmitting] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const setLayoutEdit = useCallback(
    (nextEdit: boolean) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (nextEdit) next.set('layoutEdit', '1')
        else next.delete('layoutEdit')
        return next
      })
    },
    [setSearchParams]
  )

  useEffect(() => {
    writeLayoutLocked(!layoutEdit)
  }, [layoutEdit])

  useEffect(() => {
    if (searchParams.get('layoutEdit') !== null) return
    if (!readLayoutLocked()) setLayoutEdit(true)
  }, [searchParams, setLayoutEdit])

  const openDiary = useCallback(
    (intent?: 'openToday') => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('diary', '1')
        next.set('diaryTab', 'today')
        next.delete('date')
        if (intent === 'openToday') next.set('diaryTab', 'today')
        return next
      })
    },
    [setSearchParams]
  )
  const cards = useMemo(() => getDashboardCards({ openDiary }), [openDiary])
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])
  const visibleCards = useMemo(
    () => layout.map((item) => cardsById.get(item.key)).filter((card): card is NonNullable<typeof card> => Boolean(card)),
    [layout, cardsById]
  )

  const persistLayout = useCallback(
    async (
      nextLayout: DashboardLayoutItem[],
      nextHiddenCardIds: string[],
      rollbackState?: { layout: DashboardLayoutItem[]; hiddenCardIds: string[] }
    ) => {
      setLayout(nextLayout)
      setHiddenCardIds(nextHiddenCardIds)
      setSyncError(null)

      const stored = await dashboardRepo.get()
      const themeOverride = stored?.themeOverride ?? null
      await dashboardRepo.upsert({
        items: nextLayout,
        hiddenCardIds: nextHiddenCardIds,
        themeOverride,
      })

      try {
        await syncDashboardLayout({ items: nextLayout, hiddenCardIds: nextHiddenCardIds })
      } catch {
        if (!rollbackState) return
        setLayout(rollbackState.layout)
        setHiddenCardIds(rollbackState.hiddenCardIds)
        await dashboardRepo.upsert({
          items: rollbackState.layout,
          hiddenCardIds: rollbackState.hiddenCardIds,
          themeOverride,
        })
        setSyncError('Cloud sync failed. Changes were rolled back.')
      }
    },
    []
  )

  const appendCardToEnd = useCallback(
    (cardId: string, nextLayout: DashboardLayoutItem[]) => {
      const card = cardsById.get(cardId)
      if (!card) return nextLayout
      if (nextLayout.some((item) => item.key === cardId)) return nextLayout
      const maxY = nextLayout.reduce((max, item) => Math.max(max, item.y + item.h), 0)
      return [
        ...nextLayout,
        {
          key: cardId,
          x: 0,
          y: maxY,
          w: card.defaultSize.w,
          h: card.defaultSize.h,
        },
      ]
    },
    [cardsById]
  )

  useEffect(() => {
    const allowed = new Set(cards.map((card) => card.id))
    const registryDefaultHidden = cards.filter((card) => card.defaultVisible === false).map((card) => card.id)

    dashboardRepo.get().then((stored) => {
      if (stored?.items?.length) {
        const visibleKeySet = new Set(stored.items.map((item) => item.key))
        const storedHidden = stored.hiddenCardIds ?? []
        const storedHiddenSet = new Set(storedHidden)
        const defaultHiddenForMissing = registryDefaultHidden.filter(
          (id) => !visibleKeySet.has(id) && !storedHiddenSet.has(id)
        )
        const hidden = Array.from(new Set([...storedHidden, ...defaultHiddenForMissing])).filter((id) => allowed.has(id))
        const hiddenSet = new Set(hidden)
        const next = stored.items.filter((item) => allowed.has(item.key) && !hiddenSet.has(item.key))
        const existingKeys = new Set(next.map((item) => item.key))
        hidden.forEach((id) => existingKeys.add(id))
        const maxY = next.reduce((max, item) => Math.max(max, item.y + item.h), 0)
        let cursorY = maxY

        const missing = cards
          .filter((card) => !existingKeys.has(card.id))
          .map((card) => {
            const item = {
              key: card.id,
              x: 0,
              y: cursorY,
              w: card.defaultSize.w,
              h: card.defaultSize.h,
            }
            cursorY += card.defaultSize.h
            return item
          })
        const merged = [...next, ...missing]
        const hasInvalidVisible = stored.items.some((item) => hiddenSet.has(item.key))
        const hiddenChanged = (stored.hiddenCardIds ?? []).length !== hidden.length

        if (missing.length > 0 || hasInvalidVisible || hiddenChanged) {
          void dashboardRepo.upsert({
            items: merged,
            hiddenCardIds: hidden,
            themeOverride: stored.themeOverride ?? null,
          })
        }
        setLayout(merged)
        setHiddenCardIds(hidden)
        return
      }
      const hidden = Array.from(new Set([...DEFAULT_DASHBOARD_HIDDEN_CARD_IDS, ...registryDefaultHidden])).filter((id) =>
        allowed.has(id)
      )
      const hiddenSet = new Set(hidden)
      const next = DEFAULT_DASHBOARD_LAYOUT_ITEMS.filter((item) => allowed.has(item.key) && !hiddenSet.has(item.key))
      const existingKeys = new Set(next.map((item) => item.key))
      hidden.forEach((id) => existingKeys.add(id))
      const maxY = next.reduce((max, item) => Math.max(max, item.y + item.h), 0)
      let cursorY = maxY
      const missing = cards
        .filter((card) => !existingKeys.has(card.id))
        .map((card) => {
          const item = {
            key: card.id,
            x: 0,
            y: cursorY,
            w: card.defaultSize.w,
            h: card.defaultSize.h,
          }
          cursorY += card.defaultSize.h
          return item
        })
      const fallback = [...next, ...missing]

      setLayout(fallback)
      setHiddenCardIds(hidden)
      dashboardRepo.upsert({
        items: fallback,
        hiddenCardIds: hidden,
        themeOverride: DEFAULT_DASHBOARD_THEME_OVERRIDE,
      })
    })
  }, [cards])

  const requestHideCard = useCallback(
    (cardId: string) => {
      if (layout.length <= 1) {
        setSyncError('At least one widget must remain visible.')
        return
      }
      setConfirmHideCardId(cardId)
    },
    [layout.length]
  )

  const hideCard = useCallback(async () => {
    if (!confirmHideCardId) return
    const previous = { layout, hiddenCardIds }
    const nextLayout = layout.filter((item) => item.key !== confirmHideCardId)
    const nextHidden = hiddenCardIds.includes(confirmHideCardId)
      ? hiddenCardIds
      : [...hiddenCardIds, confirmHideCardId]

    setHideSubmitting(true)
    await persistLayout(nextLayout, nextHidden, previous)
    setHideSubmitting(false)
    setConfirmHideCardId(null)
  }, [confirmHideCardId, hiddenCardIds, layout, persistLayout])

  const showCard = useCallback(
    async (cardId: string) => {
      const previous = { layout, hiddenCardIds }
      const nextLayout = appendCardToEnd(cardId, layout)
      const nextHidden = hiddenCardIds.filter((id) => id !== cardId)
      await persistLayout(nextLayout, nextHidden, previous)
    },
    [appendCardToEnd, hiddenCardIds, layout, persistLayout]
  )

  const handleWidgetToggle = useCallback(
    (cardId: string, visible: boolean) => {
      if (visible) {
        void showCard(cardId)
        return
      }
      requestHideCard(cardId)
    },
    [requestHideCard, showCard]
  )

  return (
    <FadeContent>
      <div className="dashboard" ref={containerRef}>
        {syncError && <p className="dashboard__sync-error">{syncError}</p>}
        {layoutEdit && widgetsPanelOpen && (
          <section className="dashboard-widgets" aria-label="Manage widgets visibility">
            {cards.map((card) => {
              const visible = layout.some((item) => item.key === card.id)
              const disableHide = visible && layout.length <= 1
              return (
                <div key={card.id} className="dashboard-widgets__row">
                  <span className="dashboard-widgets__title">{card.title}</span>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={visible}
                      disabled={disableHide}
                      onChange={(event) => handleWidgetToggle(card.id, event.target.checked)}
                    />
                    <span className="toggle__track" />
                  </label>
                </div>
              )
            })}
          </section>
        )}

        {mounted && (
          <GridLayout
            className="dashboard__grid"
            layout={layout.map((item) => ({
              i: item.key,
              x: item.x,
              y: item.y,
              w: item.w,
              h: item.h,
              minW: 3,
              minH: 2,
              maxW: 12,
            }))}
            gridConfig={{
              cols: 12,
              rowHeight: 60,
              margin: [18, 18],
              containerPadding: [18, 18],
              maxRows: 100,
            }}
            dragConfig={{ enabled: layoutEdit }}
            resizeConfig={{ enabled: layoutEdit }}
            width={Math.max(width, 320)}
            onLayoutChange={(next: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>) => {
              if (!layoutEdit) return
              const allowed = new Set(cards.map((card) => card.id))
              const updated = next
                .filter((item) => allowed.has(item.i))
                .map((item) => ({
                  key: item.i,
                  x: item.x,
                  y: item.y,
                  w: item.w,
                  h: item.h,
                }))
              void persistLayout(updated, hiddenCardIds, { layout, hiddenCardIds })
            }}
          >
            {visibleCards.map((card) => (
              <div key={card.id} className={`dashboard__item ${layoutEdit ? 'is-layout-edit' : ''}`}>
                {card.render()}
                {layoutEdit ? (
                  <div className="dashboard__edit-overlay" aria-label="Layout edit mode">
                    <span>Layout edit mode</span>
                  </div>
                ) : null}
              </div>
            ))}
          </GridLayout>
        )}

        <DiaryPanel
          open={diaryOpen}
          onClose={() =>
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev)
              next.delete('diary')
              next.delete('diaryTab')
              next.delete('date')
              return next
            })
          }
        />
        <Dialog
          open={Boolean(confirmHideCardId)}
          title="Hide widget"
          onClose={() => {
            if (hideSubmitting) return
            setConfirmHideCardId(null)
          }}
        >
          <div className="dialog__body">
            <p>
              Hide "{confirmHideCardId ? cardsById.get(confirmHideCardId)?.title ?? 'Widget' : 'Widget'}" from your
              dashboard? You can restore it in Manage widgets.
            </p>
          </div>
          <div className="dialog__actions">
            <Button className="button button--ghost" onClick={() => setConfirmHideCardId(null)} disabled={hideSubmitting}>
              Cancel
            </Button>
            <Button className="button" onClick={() => void hideCard()} disabled={hideSubmitting}>
              Hide
            </Button>
          </div>
        </Dialog>
      </div>
    </FadeContent>
  )
}

export default DashboardPage
