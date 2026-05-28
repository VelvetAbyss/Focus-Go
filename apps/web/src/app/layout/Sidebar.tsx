import { NavLink } from 'react-router-dom'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import {
  Bot,
  Beaker,
  CalendarDays,
  Crown,
  Flame,
  House,
  ListTodo,
  MapPinned,
  Notebook,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelsTopLeft,
  Settings,
  Sparkles,
  Timer,
  ListTree,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { BASE_NAV_ITEMS, ROUTES, type RouteKey } from '../routes/routes'
import SidebarUserPanel from './SidebarUserPanel'
import { useLabs } from '../../features/labs/LabsContext'
import { useLabsI18n } from '../../features/labs/labsI18n'
import { useI18n } from '../../shared/i18n/useI18n'
import type { FeatureKey } from '../../data/models/types'
import { mergeSidebarOrder, moveSidebarOrder, readSidebarOrder, writeSidebarOrder } from './sidebarOrder'
import { useIsLoggedIn, useAuthPlan, useIsAdmin } from '../../store/auth'
import { useUpgradeModal } from '../../features/labs/UpgradeModalContext'
import SidebarPodcastPlayer from './SidebarPodcastPlayer'
import SidebarWhiteNoise from './SidebarWhiteNoise'
import SidebarFocusTimer from './SidebarFocusTimer'
import { syncedPreferencesRepo, SYNCED_PREFERENCES_UPDATED_EVENT } from '../../data/repositories/syncedPreferencesRepo'
import { DiscoveryNewBadge } from '../../shared/ui/DiscoveryNewBadge'
import { markDiscoveryNewTargetSeen } from '../../shared/discovery/discoveryNewTargetActions'
import { SIDEBAR_DISCOVERY_TARGET_BY_ITEM_ID } from '../../shared/discovery/newTargets'

const PodcastCard = lazy(() => import('../../features/life/cards/PodcastCard'))
const SidebarDndNav = lazy(() => import('./SidebarDndNav'))

type SidebarProps = {
  collapsed: boolean
  onToggle: () => void
}

const ICONS: Record<RouteKey, LucideIcon> = {
  dashboard: House,
  timeline: ListTree,
  projects: PanelsTopLeft,
  tasks: ListTodo,
  note: Notebook,
  calendar: CalendarDays,
  trips: MapPinned,
  focus: Timer,
  diary: NotebookPen,
  membership: Crown,
  settings: Settings,
  labs: Beaker,
  admin: ShieldCheck,
}

export type SidebarNavItem = {
  id: string
  to: string
  label: string
  Icon: LucideIcon
  end?: boolean
  extraClassName?: string
}

type StaticSidebarItemProps = {
  item: SidebarNavItem
  collapsed: boolean
}

const StaticSidebarItem = ({ item, collapsed }: StaticSidebarItemProps) => {
  const discoveryTarget = SIDEBAR_DISCOVERY_TARGET_BY_ITEM_ID[item.id]

  return (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={item.label}
      className={({ isActive }) =>
        `focus-sidebar__item${item.extraClassName ? ` ${item.extraClassName}` : ''}${isActive ? ' is-active' : ''}`
      }
      onClick={() => { if (discoveryTarget) markDiscoveryNewTargetSeen(discoveryTarget) }}
    >
      <item.Icon size={18} aria-hidden="true" />
      {!collapsed ? <span>{item.label}</span> : null}
      {discoveryTarget ? <DiscoveryNewBadge target={discoveryTarget} /> : null}
    </NavLink>
  )
}

const StaticSidebarNav = ({
  items,
  collapsed,
  ariaLabel,
  onRequestDragNav,
}: {
  items: SidebarNavItem[]
  collapsed: boolean
  ariaLabel: string
  onRequestDragNav: () => void
}) => (
  <nav
    className="focus-sidebar__nav"
    aria-label={ariaLabel}
    onPointerEnter={onRequestDragNav}
    onFocus={onRequestDragNav}
  >
    {items.map((item) => (
      <StaticSidebarItem key={item.id} item={item} collapsed={collapsed} />
    ))}
  </nav>
)

const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const { catalog } = useLabs()
  const i18n = useLabsI18n()
  const { t } = useI18n()
  const [savedOrder, setSavedOrder] = useState<string[]>(() => readSidebarOrder())
  const isLoggedIn = useIsLoggedIn()
  const plan = useAuthPlan()
  const isPremium = plan === 'premium'
  const isAdmin = useIsAdmin()
  const { openModal: openUpgradeModal } = useUpgradeModal()
  const [dragNavReady, setDragNavReady] = useState(false)

  const FEATURE_ICONS: Record<FeatureKey, LucideIcon> = {
    'habit-tracker': Flame,
    'ai-digest': Sparkles,
    automation: Bot,
    'project-workspace': PanelsTopLeft,
  }

  const FEATURE_ROUTES: Record<FeatureKey, string> = {
    'habit-tracker': ROUTES.HABITS,
    'ai-digest': ROUTES.LABS,
    automation: ROUTES.LABS,
    'project-workspace': ROUTES.PROJECTS,
  }

  const navItems = BASE_NAV_ITEMS.map((item) => ({ key: item.key, to: item.to }))

  const featureItems = catalog
    .filter((feature) => !feature.requiresPremium)
    .map((feature) => ({
      id: `feature:${feature.featureKey}`,
      enabled: feature.state === 'installed',
      to: FEATURE_ROUTES[feature.featureKey],
      label: i18n.featureTitles[feature.featureKey] ?? feature.title,
      Icon: FEATURE_ICONS[feature.featureKey],
    }))

  const routeNavItems = useMemo(
    () =>
      navItems.map((item) => ({
        id: `route:${item.key}`,
        to: item.to,
        label: i18n.nav[item.key],
        Icon: ICONS[item.key],
        end: item.to === ROUTES.DASHBOARD,
      })),
    [i18n.nav, navItems],
  )

  const labsItem = useMemo<SidebarNavItem>(
    () => ({
      id: 'route:labs',
      to: ROUTES.LABS,
      label: i18n.nav.labs,
      Icon: Beaker,
    }),
    [i18n.nav.labs],
  )

  const adminItem = useMemo<SidebarNavItem>(
    () => ({
      id: 'route:admin',
      to: ROUTES.ADMIN,
      label: i18n.nav.admin,
      Icon: ShieldCheck,
    }),
    [i18n.nav.admin],
  )

  const visibleItemMap = useMemo(
    () =>
      new Map<string, SidebarNavItem>([
        ...routeNavItems.map((item) => [item.id, item] as const),
        ...featureItems.filter((item) => item.enabled).map((item) => [item.id, item] as const),
        [labsItem.id, labsItem],
        ...(isAdmin ? [[adminItem.id, adminItem] as const] : []),
      ]),
    [adminItem, featureItems, isAdmin, labsItem, routeNavItems],
  )

  const allKnownIds = useMemo(
    () => [
      ...BASE_NAV_ITEMS.map((item) => `route:${item.key}`),
      ...featureItems.map((item) => item.id),
      'route:labs',
      ...(isAdmin ? ['route:admin'] : []),
    ],
    [featureItems, isAdmin],
  )
  const mergedOrder = useMemo(() => mergeSidebarOrder(savedOrder, allKnownIds), [allKnownIds, savedOrder])
  const orderedVisibleItems = useMemo(
    () => mergedOrder.map((id) => visibleItemMap.get(id)).filter((item): item is SidebarNavItem => Boolean(item)),
    [mergedOrder, visibleItemMap],
  )

  const handleOrderChange = (activeId: string, overId: string) => {
    const nextOrder = moveSidebarOrder(mergedOrder, activeId, overId)
    setSavedOrder(nextOrder)
    writeSidebarOrder(nextOrder)
    void syncedPreferencesRepo.persistFromLocal()
  }

  useEffect(() => {
    const refreshSavedOrder = () => setSavedOrder(readSidebarOrder())
    window.addEventListener(SYNCED_PREFERENCES_UPDATED_EVENT, refreshSavedOrder)
    return () => window.removeEventListener(SYNCED_PREFERENCES_UPDATED_EVENT, refreshSavedOrder)
  }, [])

  useEffect(() => {
    if (dragNavReady || typeof window === 'undefined') return
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(() => setDragNavReady(true), { timeout: 4000 })
      return () => window.cancelIdleCallback(idleId)
    }
    const timeoutId = globalThis.setTimeout(() => setDragNavReady(true), 2500)
    return () => globalThis.clearTimeout(timeoutId)
  }, [dragNavReady])

  const mainModulesLabel = t('shell.mainModules')

  return (
    <motion.aside
      className={`focus-sidebar ${collapsed ? 'is-collapsed' : ''}`}
      animate={{ width: collapsed ? 80 : 220 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="focus-sidebar__top">
        <div className="focus-sidebar__user focus-sidebar__user--top">
          <SidebarUserPanel collapsed={collapsed} />
        </div>
        <button
          type="button"
          className="focus-sidebar__toggle"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t('shell.expandNav') : t('shell.collapseNav')}
        >
          {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
          {!collapsed ? <span>{t('shell.hideNav')}</span> : null}
        </button>
      </div>

      {dragNavReady ? (
        <Suspense
          fallback={(
            <StaticSidebarNav
              items={orderedVisibleItems}
              collapsed={collapsed}
              ariaLabel={mainModulesLabel}
              onRequestDragNav={() => setDragNavReady(true)}
            />
          )}
        >
          <SidebarDndNav
            items={orderedVisibleItems}
            collapsed={collapsed}
            ariaLabel={mainModulesLabel}
            onOrderChange={handleOrderChange}
          />
        </Suspense>
      ) : (
        <StaticSidebarNav
          items={orderedVisibleItems}
          collapsed={collapsed}
          ariaLabel={mainModulesLabel}
          onRequestDragNav={() => setDragNavReady(true)}
        />
      )}

      <SidebarPodcastPlayer collapsed={collapsed} />
      <SidebarWhiteNoise collapsed={collapsed} />
      <SidebarFocusTimer collapsed={collapsed} />
      <Suspense fallback={null}>
        <PodcastCard standalone />
      </Suspense>

      <div className="focus-sidebar__bottom">
        {isLoggedIn && !isPremium && (
          <button
            type="button"
            className="focus-sidebar__upgrade"
            onClick={() => {
              markDiscoveryNewTargetSeen('nav-premium')
              openUpgradeModal()
            }}
            aria-label={t('auth.upgradePlan')}
          >
            <Sparkles size={14} aria-hidden="true" />
            {!collapsed && <span>{t('auth.upgradePlan')}</span>}
            <DiscoveryNewBadge target="nav-premium" />
          </button>
        )}
      </div>
    </motion.aside>
  )
}

export default Sidebar
