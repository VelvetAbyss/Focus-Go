import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { GridLayout, useContainerWidth } from 'react-grid-layout'
import { useIsBreakpoint } from '../../hooks/use-is-breakpoint'
import Dialog from '../../shared/ui/Dialog'
import { dashboardRepo } from '../../data/repositories/dashboardRepo'
import { getDashboardCards } from './registry'
import type { DashboardLayoutItem } from '../../data/models/types'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { syncDashboardLayout } from './layoutSyncAdapter'
import DashboardHeader from './DashboardHeader'
import { useI18n } from '../../shared/i18n/useI18n'
import { ROUTES } from '../../app/routes/routes'
import { useOnboardingFlow } from '../onboarding/useOnboardingFlow'
import OnboardingModal from '../onboarding/OnboardingModal'
import {
  DEFAULT_DASHBOARD_HIDDEN_CARD_IDS,
  DEFAULT_DASHBOARD_LAYOUT_ITEMS,
  DEFAULT_DASHBOARD_THEME_OVERRIDE,
} from '../../data/defaultDashboardLayout'
import { usePremiumGate } from '../premium/PremiumProvider'

const LAYOUT_LOCK_KEY = 'workbench.dashboard.layoutLocked'
const LAYOUT_PERSIST_DEBOUNCE_MS = 180
const DiaryPanel = lazy(() => import('../diary/DiaryPanel'))

const isSameLayout = (a: DashboardLayoutItem[], b: DashboardLayoutItem[]) => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]
    const right = b[i]
    if (!right) return false
    if (
      left.key !== right.key ||
      left.x !== right.x ||
      left.y !== right.y ||
      left.w !== right.w ||
      left.h !== right.h
    ) {
      return false
    }
  }
  return true
}

const readLayoutLocked = () => {
  const raw = localStorage.getItem(LAYOUT_LOCK_KEY)
  if (raw === null) return true
  return raw !== 'false'
}

const writeLayoutLocked = (locked: boolean) => {
  localStorage.setItem(LAYOUT_LOCK_KEY, locked ? 'true' : 'false')
}

const DashboardPage = () => {
  const { t } = useI18n()
  const { canUse, openUpgradeModal } = usePremiumGate()
  const navigate = useNavigate()
  const onboarding = useOnboardingFlow()
  const [layout, setLayout] = useState<DashboardLayoutItem[]>([])
  const [hiddenCardIds, setHiddenCardIds] = useState<string[]>([])
  const isMobile = useIsBreakpoint('max', 768)
  const columns = isMobile ? 4 : 12
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: window.innerWidth })
  const [searchParams, setSearchParams] = useSearchParams()
  const diaryOpen = searchParams.get('diary') === '1'
  const layoutEdit = searchParams.get('layoutEdit') === '1' && !isMobile
  const widgetsPanelOpen = searchParams.get('widgetsPanel') === '1'
  const [confirmHideCardId, setConfirmHideCardId] = useState<string | null>(null)
  const [hideSubmitting, setHideSubmitting] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const persistTimerRef = useRef<number | null>(null)
  const layoutSnapshotRef = useRef<{ layout: DashboardLayoutItem[]; hiddenCardIds: string[] }>({
    layout: [],
    hiddenCardIds: [],
  })
  const pendingLayoutKeyRef = useRef('')

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
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (layoutEdit) {
        next.delete('layoutEdit')
        next.delete('widgetsPanel')
      } else next.set('layoutEdit', '1')
      return next
    })
  }, [canUse, isMobile, layoutEdit, openUpgradeModal, setSearchParams])
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
  const setLayoutEdit = useCallback(
    (nextEdit: boolean) => {
      if (isMobile) return
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (nextEdit) next.set('layoutEdit', '1')
        else next.delete('layoutEdit')
        return next
      })
    },
    [isMobile, setSearchParams]
  )

  useEffect(() => {
    if (isMobile && layoutEdit) {
      setLayoutEdit(false)
    }
  }, [isMobile, layoutEdit, setLayoutEdit])

  useEffect(() => {
    writeLayoutLocked(!layoutEdit)
  }, [layoutEdit])

  useEffect(() => {
    layoutSnapshotRef.current = { layout, hiddenCardIds }
  }, [hiddenCardIds, layout])

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (searchParams.get('layoutEdit') !== null) return
    if (!readLayoutLocked()) setLayoutEdit(true)
  }, [searchParams, setLayoutEdit])

  useEffect(() => {
    if (onboarding.status === 'in_progress' && onboarding.currentStep === 'create_task') {
      navigate(ROUTES.TASKS, { replace: true })
    }
  }, [navigate, onboarding.currentStep, onboarding.status])

  const openDiary = useCallback(
    (intent?: 'openToday') => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('diary', '1')
          next.set('diaryTab', 'today')
          next.delete('date')
          if (intent === 'openToday') next.set('diaryTab', 'today')
          return next
        },
        { replace: true }
      )
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
    <main className="dashboard" ref={containerRef} aria-label={t('dashboard.page')}>
        <DashboardHeader
          layoutEdit={layoutEdit}
          widgetsPanelOpen={widgetsPanelOpen}
          onToggleLayoutEdit={toggleLayoutEdit}
          onToggleWidgetsPanel={toggleWidgetsPanel}
          layoutEditLocked={!canUse('dashboard.custom-layout').allowed}
          widgetsLocked={!canUse('dashboard.extra-widgets').allowed}
          showRestartOnboarding={onboarding.status !== 'in_progress'}
          onRestartOnboarding={() => onboarding.restart()}
        />
        <div aria-live="polite" aria-atomic="true">
          {syncError && <p className="dashboard__sync-error">{syncError}</p>}
        </div>
        {layoutEdit && widgetsPanelOpen && (
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

        {mounted && (
          <GridLayout
            className="dashboard__grid"
            layout={responsiveLayout.map((item) => ({
              i: item.key,
              x: item.x,
              y: item.y,
              w: item.w,
              h: item.h,
              minW: isMobile ? 2 : 3,
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
            dragConfig={{ enabled: layoutEdit }}
            resizeConfig={{ enabled: layoutEdit }}
            width={Math.max(width, 320)}
            onLayoutChange={(next: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>) => {
              if (!layoutEdit || isMobile) return
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
              if (isSameLayout(updated, layoutSnapshotRef.current.layout)) return
              const key = JSON.stringify(updated)
              if (pendingLayoutKeyRef.current === key) return
              pendingLayoutKeyRef.current = key
              const rollbackState = layoutSnapshotRef.current
              if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
              persistTimerRef.current = window.setTimeout(() => {
                persistTimerRef.current = null
                void persistLayout(updated, hiddenCardIds, rollbackState)
              }, LAYOUT_PERSIST_DEBOUNCE_MS)
            }}
          >
            {visibleCards.map((card) => (
              <div key={card.id} className={`dashboard__item ${layoutEdit ? 'is-layout-edit' : ''}`}>
                {card.render()}
                {layoutEdit ? (
                  <div className="dashboard__edit-overlay" aria-label={t('dashboard.layoutEdit')}>
                    <span>{t('dashboard.layoutEdit')}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </GridLayout>
        )}

        {diaryOpen ? (
          <Suspense fallback={null}>
            <DiaryPanel
              open={diaryOpen}
              onClose={() =>
                setSearchParams(
                  (prev) => {
                    const next = new URLSearchParams(prev)
                    next.delete('diary')
                    next.delete('diaryTab')
                    next.delete('date')
                    return next
                  },
                  { replace: true }
                )
              }
            />
          </Suspense>
        ) : null}
        <OnboardingModal
          open={onboarding.status === 'not_started'}
          onStart={() => {
            onboarding.start()
            navigate(ROUTES.TASKS, { replace: true })
          }}
          onSkip={() => onboarding.skip()}
        />
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
