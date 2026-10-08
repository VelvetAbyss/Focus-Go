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
import DashboardHeader, { type DashboardPage as DashboardPageKind } from './DashboardHeader'
import CustomDashboard from './CustomDashboard'
import { appendViewWidget, readCustomViews, saveCustomViews, uniqueViewName, viewNameError, type CustomView } from './customViews'
import { Input } from '@/components/ui/input'
import { Dialog as ViewDialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { getLifeCards } from './registry'
import { useLifeI18n } from '../life/lifeI18n'
import DashboardSkeleton from './DashboardSkeleton'
import { useI18n } from '../../shared/i18n/useI18n'
import {
  CURRENT_DASHBOARD_LAYOUT_VERSION,
  DEFAULT_DASHBOARD_HIDDEN_CARD_IDS,
  DEFAULT_DASHBOARD_LAYOUT_ITEMS,
  DEFAULT_DASHBOARD_THEME_OVERRIDE,
} from '../../data/defaultDashboardLayout'
import { usePremiumGate } from '../premium/PremiumProvider'
import LifeDashboard from '../life/LifeDashboard'
import NewsDashboard from '../news/NewsDashboard'
import { readLayoutLocked, writeLayoutLocked } from '../../shared/prefs/dashboardLayoutLock'
import { syncedPreferencesRepo, SYNCED_PREFERENCES_UPDATED_EVENT } from '../../data/repositories/syncedPreferencesRepo'
import { DiscoveryNewBadge } from '../../shared/ui/DiscoveryNewBadge'
import { markDiscoveryNewTargetSeen } from '../../shared/discovery/discoveryNewTargetActions'
import { DASHBOARD_CARD_DISCOVERY_TARGET_BY_ID } from '../../shared/discovery/newTargets'

const DashboardPage = () => {
  const { t, language } = useI18n()
  const { t: lifeT } = useLifeI18n()
  const zh = language === 'zh'
  const { canUse, openUpgradeModal } = usePremiumGate()
  const [views, setViews] = useState(readCustomViews)
  const [selectedViewId, setSelectedViewId] = useState(() => new URLSearchParams(window.location.search).get('view') ?? '')
  const [page, setPage] = useState<DashboardPageKind>(() => readCustomViews().some(view => view.id === new URLSearchParams(window.location.search).get('view')) ? 'custom' : 'main')
  const [newView, setNewView] = useState<CustomView | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createTemplate, setCreateTemplate] = useState('blank')
  const [createError, setCreateError] = useState('')
  const [customDirty, setCustomDirty] = useState(false)
  const [pendingSwitch, setPendingSwitch] = useState<(() => void) | null>(null)
  const switchSafely = (action: () => void) => { if (customDirty) setPendingSwitch(() => action); else action() }
  const selectedView = newView ?? views.find(view => view.id === selectedViewId)
  const selectPage = (next: DashboardPageKind) => switchSafely(() => { setNewView(null); setCustomDirty(false); setPage(next) })
  const selectView = (id: string) => switchSafely(() => { setNewView(null); setCustomDirty(false); setSelectedViewId(id); setPage('custom') })
  const storeViews = (next: CustomView[]) => { saveCustomViews(next); setViews(next) }
  const createView = () => {
    const issue = viewNameError(createName, views)
    if (issue) { setCreateError(zh ? (issue === 'duplicate' ? '已有同名视图，请换个名字。' : '请输入 1–40 个字符。') : (issue === 'duplicate' ? 'This name already exists.' : 'Enter 1–40 characters.')); return }
    const templateCards = createTemplate === 'life' ? getLifeCards(lifeT) : getDashboardCards()
    const items = createTemplate === 'blank' ? [] : createTemplate === 'main' ? structuredClone(layout) : templateCards.reduce<DashboardLayoutItem[]>((items, card) => appendViewWidget(items, card.id, Math.max(3, Math.round(card.defaultSize.w / 2)), card.defaultSize.h), [])
    const view = { id: crypto.randomUUID(), name: createName.trim(), items }
    setNewView(view); setSelectedViewId(view.id); setPage('custom'); setCreateOpen(false)
  }
  const [layout, setLayout] = useState<DashboardLayoutItem[]>([])
  const [hiddenCardIds, setHiddenCardIds] = useState<string[]>([])
  const isMobile = useIsBreakpoint('max', 768)
  const columns = isMobile ? 4 : 12
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: window.innerWidth })
  const [searchParams, setSearchParams] = useSearchParams()
  const [layoutEdit, setLayoutEdit] = useState(() => !isMobile && !readLayoutLocked())
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (page === 'custom' && !newView) next.set('view', selectedViewId)
      else next.delete('view')
      if (next.toString() === prev.toString()) return prev
      return next
    }, { replace: true })
  }, [page, selectedViewId, newView, setSearchParams])
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
    if (page === 'news') setLayoutEdit(false)
  }, [page])

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
        layoutVersion: CURRENT_DASHBOARD_LAYOUT_VERSION,
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
      const storedVersion = stored?.layoutVersion ?? 0
      const isStale = storedVersion < CURRENT_DASHBOARD_LAYOUT_VERSION
      if (stored?.items?.length && !isStale) {
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
            layoutVersion: CURRENT_DASHBOARD_LAYOUT_VERSION,
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
        themeOverride: isStale ? (stored?.themeOverride ?? DEFAULT_DASHBOARD_THEME_OVERRIDE) : DEFAULT_DASHBOARD_THEME_OVERRIDE,
        layoutVersion: CURRENT_DASHBOARD_LAYOUT_VERSION,
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
          onSetPage={selectPage}
          customViews={views}
          selectedViewId={selectedViewId}
          onSelectView={selectView}
          onCreateView={() => switchSafely(() => { setCreateName(uniqueViewName(zh ? '我的视图' : 'My view', views)); setCreateTemplate('blank'); setCreateError(''); setCreateOpen(true) })}
        />

        <div aria-live="polite" aria-atomic="true">
        </div>

        {page === 'custom' && selectedView && <CustomDashboard key={selectedView.id} view={selectedView} views={views} isNew={Boolean(newView)} onDirtyChange={setCustomDirty}
          onSave={view => { storeViews(views.some(v => v.id === view.id) ? views.map(v => v.id === view.id ? view : v) : [...views, view]); setNewView(null); setCustomDirty(false) }}
          onCopy={view => { storeViews([...views, view]); setSelectedViewId(view.id) }}
          onDelete={() => { storeViews(views.filter(view => view.id !== selectedView.id)); setSelectedViewId(''); setPage('main'); setCustomDirty(false) }}
          onCancel={() => { setNewView(null); setPage('main'); setCustomDirty(false) }} />}
        <ViewDialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogTitle>{zh ? '新建视图' : 'New view'}</DialogTitle><DialogDescription>{zh ? '按自己的节奏组合组件。每个视图拥有独立布局。' : 'Combine widgets your way. Each view has its own layout.'}</DialogDescription>
          <form className="custom-view__create" onSubmit={event => { event.preventDefault(); createView() }}>
            <label htmlFor="new-view-name">{zh ? '视图名字' : 'View name'}</label><Input id="new-view-name" autoFocus maxLength={40} value={createName} onChange={event => setCreateName(event.target.value)} />
            <label htmlFor="view-template">{zh ? '从哪里开始' : 'Start from'}</label><select id="view-template" value={createTemplate} onChange={event => setCreateTemplate(event.target.value)}><option value="blank">{zh ? '空白视图' : 'Blank view'}</option><option value="main">{zh ? '复制当前 Focus 布局' : 'Current Focus layout'}</option><option value="life">Life</option></select>
            {createError && <p role="alert" className="custom-view__error">{createError}</p>}<Button type="submit">{zh ? '创建并添加组件' : 'Create and add widgets'}</Button>
          </form>
        </DialogContent></ViewDialog>
        <ViewDialog open={Boolean(pendingSwitch)} onOpenChange={open => { if (!open) setPendingSwitch(null) }}><DialogContent><DialogTitle>{zh ? '放弃未保存的修改？' : 'Discard unsaved changes?'}</DialogTitle><DialogDescription>{zh ? '保存后的视图会保留。当前修改尚未保存。' : 'Your saved view will be kept. Current edits have not been saved.'}</DialogDescription><Button variant="outline" onClick={() => setPendingSwitch(null)}>{zh ? '继续编辑' : 'Keep editing'}</Button><Button onClick={() => { pendingSwitch?.(); setPendingSwitch(null); setCustomDirty(false) }}>{zh ? '放弃修改' : 'Discard changes'}</Button></DialogContent></ViewDialog>

        {/* Life page */}
        {page === 'life' && <LifeDashboard layoutEdit={layoutEdit} widgetsPanelOpen={widgetsPanelOpen} />}

        {/* News page */}
        {page === 'news' && <NewsDashboard />}

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
              (() => {
                const discoveryTarget = DASHBOARD_CARD_DISCOVERY_TARGET_BY_ID[card.id]
                return (
                  <div
                    key={card.id}
                    className={`dashboard__item${layoutEdit ? ' is-layout-edit' : ''}${gridEdit.activeId === card.id ? ' is-dragging' : ''}`}
                    onPointerDownCapture={() => { if (discoveryTarget) markDiscoveryNewTargetSeen(discoveryTarget) }}
                  >
                    {card.render()}
                    {discoveryTarget ? <DiscoveryNewBadge target={discoveryTarget} className="discovery-new-badge--card" /> : null}
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
                )
              })()
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
