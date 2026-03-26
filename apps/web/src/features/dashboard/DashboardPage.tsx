import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { GridLayout, useContainerWidth } from 'react-grid-layout'
import { absoluteStrategy } from 'react-grid-layout/core'
import { ArrowRight, Focus, NotebookPen } from 'lucide-react'
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
  const [layoutEdit, setLayoutEdit] = useState(() => !isMobile && !readLayoutLocked())
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
    layoutSnapshotRef.current = { layout, hiddenCardIds }
  }, [hiddenCardIds, layout])

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
    }
  }, [])


  useEffect(() => {
    if (onboarding.status !== 'in_progress' || onboarding.currentStep !== 'dashboard_overview' || onboarding.featureSeen.dashboard) return
    onboarding.markFeatureSeen('dashboard')
  }, [onboarding])

  const cards = useMemo(() => getDashboardCards(), [])
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

  const overviewVisible = onboarding.status === 'in_progress' && onboarding.currentStep === 'dashboard_overview'

  const finishOverview = useCallback(() => {
    onboarding.complete()
  }, [onboarding])

  const openTasksOnboarding = useCallback(() => {
    onboarding.next('tasks')
    navigate(ROUTES.TASKS)
  }, [navigate, onboarding])

  const openFocusFromOverview = useCallback(() => {
    onboarding.complete()
    onboarding.setPendingCoachmark('focus')
    navigate(ROUTES.FOCUS)
  }, [navigate, onboarding])

  const openDiaryFromOverview = useCallback(() => {
    onboarding.complete()
    onboarding.markFeatureSeen('diary')
    navigate(ROUTES.DIARY)
  }, [navigate, onboarding])

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
        {overviewVisible ? (
          <section className="mx-[18px] mb-2 rounded-[32px] border border-[#3A3733]/8 bg-[linear-gradient(135deg,rgba(245,243,240,0.96),rgba(255,255,255,0.84))] px-6 py-6 text-[#3A3733] shadow-[0_24px_80px_rgba(58,55,51,0.08)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#3A3733]/56">{t('onboarding.dashboard.eyebrow')}</p>
                <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em]">{t('onboarding.dashboard.title')}</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#3A3733]/72">{t('onboarding.dashboard.description')}</p>
              </div>
              <Button type="button" variant="outline" className="self-start rounded-full border-[#3A3733]/12 bg-white/72 text-[#3A3733]" onClick={finishOverview}>
                {t('onboarding.dashboard.dismiss')}
              </Button>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              <button
                type="button"
                className="group rounded-[24px] border border-[#3A3733]/8 bg-white/76 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(58,55,51,0.12)]"
                onClick={openTasksOnboarding}
              >
                <p className="text-sm font-semibold">{t('onboarding.dashboard.tasksCta')}</p>
                <p className="mt-2 text-sm leading-6 text-[#3A3733]/68">先把今天最重要的一件事放进系统，后面的模块才会围绕真实工作运转。</p>
                <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#3A3733]/56">
                  Plan
                  <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </button>
              <button
                type="button"
                className="group rounded-[24px] border border-[#3A3733]/8 bg-white/76 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(58,55,51,0.12)]"
                onClick={openFocusFromOverview}
              >
                <div className="inline-flex rounded-full bg-[#3A3733]/6 p-2 text-[#3A3733]">
                  <Focus className="size-4" />
                </div>
                <p className="mt-3 text-sm font-semibold">{t('onboarding.dashboard.focusCta')}</p>
                <p className="mt-2 text-sm leading-6 text-[#3A3733]/68">想先感受节奏时，可以直接进入 Focus；任务上下文之后再补上也可以。</p>
              </button>
              <button
                type="button"
                className="group rounded-[24px] border border-[#3A3733]/8 bg-white/76 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(58,55,51,0.12)]"
                onClick={openDiaryFromOverview}
              >
                <div className="inline-flex rounded-full bg-[#3A3733]/6 p-2 text-[#3A3733]">
                  <NotebookPen className="size-4" />
                </div>
                <p className="mt-3 text-sm font-semibold">{t('onboarding.dashboard.diaryCta')}</p>
                <p className="mt-2 text-sm leading-6 text-[#3A3733]/68">如果你更习惯先记录，再慢慢建立自己的日常工作台，也可以从这里开始。</p>
              </button>
            </div>
          </section>
        ) : null}
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
            dragConfig={{ enabled: layoutEdit, threshold: 5 }}
            resizeConfig={{ enabled: layoutEdit }}
            positionStrategy={layoutEdit ? absoluteStrategy : undefined}
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

        <OnboardingModal
          open={onboarding.status === 'not_started'}
          onStart={() => {
            onboarding.start()
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
