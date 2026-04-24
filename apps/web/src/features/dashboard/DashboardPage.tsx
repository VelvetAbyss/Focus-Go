import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { GridLayout, useContainerWidth } from 'react-grid-layout'
import { absoluteStrategy } from 'react-grid-layout/core'
import { useIsBreakpoint } from '../../hooks/use-is-breakpoint'
import Dialog from '../../shared/ui/Dialog'
import { dashboardRepo } from '../../data/repositories/dashboardRepo'
import { getDashboardCards } from './registry'
import { useDashboardGridEdit } from './useDashboardGridEdit'
import type { DashboardLayoutItem } from '../../data/models/types'
import { useSearchParams } from 'react-router-dom'
import DashboardHeader from './DashboardHeader'
import DashboardSkeleton from './DashboardSkeleton'
import { useI18n } from '../../shared/i18n/useI18n'
import {
  DEFAULT_DASHBOARD_HIDDEN_CARD_IDS,
  DEFAULT_DASHBOARD_LAYOUT_ITEMS,
  DEFAULT_DASHBOARD_THEME_OVERRIDE,
} from '../../data/defaultDashboardLayout'
import { usePremiumGate } from '../premium/PremiumProvider'
import LifeDashboard from '../life/LifeDashboard'
import { readLayoutLocked, writeLayoutLocked } from '../../shared/prefs/dashboardLayoutLock'
import { syncedPreferencesRepo, SYNCED_PREFERENCES_UPDATED_EVENT } from '../../data/repositories/syncedPreferencesRepo'

const DashboardPage = () => {
  const { t } = useI18n()
  const { canUse, openUpgradeModal } = usePremiumGate()
  const [page, setPage] = useState<'main' | 'life'>('main')
  const [layout, setLayout] = useState<DashboardLayoutItem[]>([])
  const [hiddenCardIds, setHiddenCardIds] = useState<string[]>([])
  const isMobile = useIsBreakpoint('max', 768)
  const columns = isMobile ? 4 : 12
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: window.innerWidth })
  const [searchParams, setSearchParams] = useSearchParams()
  const [layoutEdit, setLayoutEdit] = useState(() => !isMobile && !readLayoutLocked())
  const widgetsPanelOpen = searchParams.get('widgetsPanel') === '1'
  const [confirmHideCardId, setConfirmHideCardId] = useState<string | null>(null)
  const [hideSubmitting, setHideSubmitting] = useState(false)
  const [layoutLoaded, setLayoutLoaded] = useState(false)
  const layoutLockHydratedRef = useRef(false)
  const layoutSnapshotRef = useRef<{ layout: DashboardLayoutItem[]; hiddenCardIds: string[] }>({
    layout: [],
    hiddenCardIds: [],
  })

  const responsiveLayout = useMemo(() => {
    if (!isMobile) return layout
    // Scale desktop layout (12 cols) to mobile layout (4 cols)
    return layout.map((item) => {
      const mobileW = Math.max(2, Math.round((item.w / 12) * 4))
      const mobileX = Math.min(4 - mobileW, Math.round((item.x / 12) * 4))
      return {
        ...item,
        w: mobileW,
        x: mobileX,
      }
    })
  }, [isMobile, layout])

  const toggleLayoutEdit = useCallback(() => {
    if (isMobile) return
    if (!canUse('dashboard.custom-layout').allowed) {
      openUpgradeModal('button', 'dashboard.custom-layout')
      return
    }
    setLayoutEdit((prev) => !prev)
  }, [canUse, isMobile, openUpgradeModal])

  const toggleWidgetsPanel = useCallback(() => {
    if (!canUse('dashboard.extra-widgets').allowed) {
      openUpgradeModal('button', 'dashboard.extra-widgets')
      return
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (widgetsPanelOpen) next.delete('widgetsPanel')
      else next.set('widgetsPanel', '1')
      return next
    })
  }, [canUse, openUpgradeModal, setSearchParams, widgetsPanelOpen])

  useEffect(() => {
    if (isMobile) setLayoutEdit(false)
  }, [isMobile])

  useEffect(() => {
    writeLayoutLocked(!layoutEdit)
    if (layoutLockHydratedRef.current) {
      void syncedPreferencesRepo.persistFromLocal()
    } else {
      layoutLockHydratedRef.current = true
    }
    if (!layoutEdit) {
      setSearchParams((prev) => {
        if (!prev.has('widgetsPanel')) return prev
        const next = new URLSearchParams(prev)
        next.delete('widgetsPanel')
        return next
      })
    }
  }, [layoutEdit, setSearchParams])

  useEffect(() => {
    const handleSyncedPreferencesUpdated = () => {
      if (isMobile) {
        setLayoutEdit(false)
        return
      }
      setLayoutEdit(!readLayoutLocked())
    }
    window.addEventListener(SYNCED_PREFERENCES_UPDATED_EVENT, handleSyncedPreferencesUpdated)
    return () => window.removeEventListener(SYNCED_PREFERENCES_UPDATED_EVENT, handleSyncedPreferencesUpdated)
  }, [isMobile])

  const gridEdit = useDashboardGridEdit({
    layout: responsiveLayout,
    enabled: layoutEdit,
    cols: columns,
    rowHeight: 60,
    margin: [18, 18] as [number, number],
    padding: [18, 18] as [number, number],
    width: Math.max(width, 320),
    minW: isMobile ? 2 : 2,
    minH: 2,
    onUpdate: setLayout,
    onCommit: (finalLayout) => {
      void persistLayout(finalLayout, hiddenCardIds)
    },
  })

  useEffect(() => {
    if (gridEdit.activeId) return
    layoutSnapshotRef.current = { layout, hiddenCardIds }
  }, [hiddenCardIds, layout, gridEdit.activeId])

  const cards = useMemo(() => getDashboardCards(), [])
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])
  const visibleCards = useMemo(
    () => layout.map((item) => cardsById.get(item.key)).filter((card): card is NonNullable<typeof card> => Boolean(card)),
    [layout, cardsById]
  )

  const persistLayout = useCallback(
    async (nextLayout: DashboardLayoutItem[], nextHiddenCardIds: string[]) => {
      setLayout(nextLayout)
      setHiddenCardIds(nextHiddenCardIds)
      const stored = await dashboardRepo.get()
      const themeOverride = stored?.themeOverride ?? null
      await dashboardRepo.upsert({
        items: nextLayout,
        hiddenCardIds: nextHiddenCardIds,
        themeOverride,
      })
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
        setLayoutLoaded(true)
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
      setLayoutLoaded(true)
      dashboardRepo.upsert({
        items: fallback,
        hiddenCardIds: hidden,
        themeOverride: DEFAULT_DASHBOARD_THEME_OVERRIDE,
      })
    })
  }, [cards])

  const requestHideCard = useCallback(
    (cardId: string) => {
      if (layout.length <= 1) return
      setConfirmHideCardId(cardId)
    },
    [layout.length]
  )

  const hideCard = useCallback(async () => {
    if (!confirmHideCardId) return
    const nextLayout = layout.filter((item) => item.key !== confirmHideCardId)
    const nextHidden = hiddenCardIds.includes(confirmHideCardId)
      ? hiddenCardIds
      : [...hiddenCardIds, confirmHideCardId]

    setHideSubmitting(true)
    await persistLayout(nextLayout, nextHidden)
    setHideSubmitting(false)
    setConfirmHideCardId(null)
  }, [confirmHideCardId, hiddenCardIds, layout, persistLayout])

  const showCard = useCallback(
    async (cardId: string) => {
      const nextLayout = appendCardToEnd(cardId, layout)
      const nextHidden = hiddenCardIds.filter((id) => id !== cardId)
      await persistLayout(nextLayout, nextHidden)
    },
    [appendCardToEnd, hiddenCardIds, layout, persistLayout]
  )

  const handleWidgetToggle = useCallback(
    (cardId: string, visible: boolean) => {
      if (visible) {
        if (!canUse('dashboard.extra-widgets').allowed) {
          openUpgradeModal('button', 'dashboard.extra-widgets')
          return
        }
        void showCard(cardId)
        return
      }
      requestHideCard(cardId)
    },
    [canUse, openUpgradeModal, requestHideCard, showCard]
  )

  return (
    <main className={`dashboard${layoutLoaded ? ' is-layout-loaded' : ''}`} ref={containerRef} aria-label={t('dashboard.page')}>
        <DashboardHeader
          layoutEdit={layoutEdit}
          widgetsPanelOpen={widgetsPanelOpen}
          onToggleLayoutEdit={toggleLayoutEdit}
          onToggleWidgetsPanel={toggleWidgetsPanel}
          layoutEditLocked={!canUse('dashboard.custom-layout').allowed}
          widgetsLocked={!canUse('dashboard.extra-widgets').allowed}
          page={page}
          onSetPage={setPage}
        />

        <div aria-live="polite" aria-atomic="true">
        </div>

        {/* Life page */}
        {page === 'life' && <LifeDashboard layoutEdit={layoutEdit} widgetsPanelOpen={widgetsPanelOpen} />}

        {/* Main dashboard */}
        {page === 'main' && layoutEdit && widgetsPanelOpen && (
          <section className="dashboard-widgets" aria-label={t('dashboard.manageVisibility')}>
            {cards.map((card) => {
              const visible = layout.some((item) => item.key === card.id)
              const disableHide = visible && layout.length <= 1
              const switchId = `widget-toggle-${card.id}`
              return (
                <div key={card.id} className="dashboard-widgets__row">
                  <Label htmlFor={switchId} className="dashboard-widgets__title">
                    {card.title}
                  </Label>
                  <Switch
                    id={switchId}
                    checked={visible}
                    disabled={disableHide}
                    onCheckedChange={(checked) => handleWidgetToggle(card.id, checked)}
                    aria-label={t('dashboard.toggleVisibility', { name: card.title })}
                  />
                </div>
              )
            })}
          </section>
        )}

        {page === 'main' && mounted && !layoutLoaded && (
          <DashboardSkeleton columns={columns} rowHeight={60} margin={18} />
        )}

        {page === 'main' && mounted && layoutLoaded && (
          <GridLayout
            className={`dashboard__grid${layoutEdit ? ' dashboard__grid--edit-mode' : ''}`}
            layout={responsiveLayout.map((item) => ({
              i: item.key,
              x: item.x,
              y: item.y,
              w: item.w,
              h: item.h,
              minW: isMobile ? 2 : 2,
              minH: 2,
              maxW: columns,
            }))}
            gridConfig={{
              cols: columns,
              rowHeight: 60,
              margin: [18, 18],
              containerPadding: [18, 18],
              maxRows: 100,
            }}
            dragConfig={{ enabled: false }}
            resizeConfig={{ enabled: false }}
            positionStrategy={absoluteStrategy}
            width={Math.max(width, 320)}
          >
            {visibleCards.map((card) => (
              <div
                key={card.id}
                className={`dashboard__item${layoutEdit ? ' is-layout-edit' : ''}${gridEdit.activeId === card.id ? ' is-dragging' : ''}`}
              >
                {card.render()}
                {layoutEdit && (
                  <>
                    <div
                      className="dashboard__edit-overlay"
                      {...gridEdit.dragProps(card.id)}
                      aria-label={t('dashboard.layoutEdit')}
                    >
                      <span>{t('dashboard.layoutEdit')}</span>
                    </div>
                    <div
                      className="dashboard__resize-handle"
                      {...gridEdit.resizeProps(card.id)}
                    />
                  </>
                )}
              </div>
            ))}
          </GridLayout>
        )}

        <Dialog
          open={Boolean(confirmHideCardId)}
          title={t('dashboard.hideWidget')}
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
            <Button variant="outline" onClick={() => setConfirmHideCardId(null)} disabled={hideSubmitting}>
              {t('tasks.cancel')}
            </Button>
            <Button onClick={() => void hideCard()} disabled={hideSubmitting}>
              {t('dashboard.hideWidget')}
            </Button>
          </div>
        </Dialog>
    </main>
  )
}

export default DashboardPage
