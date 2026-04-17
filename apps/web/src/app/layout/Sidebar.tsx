import { NavLink } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Bot,
  Beaker,
  CalendarDays,
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
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { BASE_NAV_ITEMS, ROUTES, type RouteKey } from '../routes/routes'
import ThemeToggle from '../../shared/theme/ThemeToggle'
import type { ThemeMode } from '../../shared/theme/theme'
import SidebarUserPanel from './SidebarUserPanel'
import { useLabs } from '../../features/labs/LabsContext'
import { useLabsI18n } from '../../features/labs/labsI18n'
import { useI18n } from '../../shared/i18n/useI18n'
import type { FeatureKey } from '../../data/models/types'
import { mergeSidebarOrder, moveSidebarOrder, readSidebarOrder, writeSidebarOrder } from './sidebarOrder'
import { useIsLoggedIn, useAuthPlan, useIsAdmin } from '../../store/auth'
import { useUpgradeModal } from '../../features/labs/UpgradeModalContext'
import SidebarPodcastPlayer from './SidebarPodcastPlayer'
import PodcastCard from '../../features/life/cards/PodcastCard'
import { syncedPreferencesRepo, SYNCED_PREFERENCES_UPDATED_EVENT } from '../../data/repositories/syncedPreferencesRepo'

type SidebarProps = {
  collapsed: boolean
  onToggle: () => void
  theme: ThemeMode
  onToggleTheme: () => void
}

const ICONS: Record<RouteKey, LucideIcon> = {
  dashboard: House,
  projects: PanelsTopLeft,
  tasks: ListTodo,
  note: Notebook,
  calendar: CalendarDays,
  trips: MapPinned,
  focus: Timer,
  diary: NotebookPen,
  settings: Settings,
  labs: Beaker,
  admin: ShieldCheck,
}

type SidebarNavItem = {
  id: string
  to: string
  label: string
  Icon: LucideIcon
  end?: boolean
  extraClassName?: string
}

type SortableSidebarItemProps = {
  item: SidebarNavItem
  collapsed: boolean
}

const SortableSidebarItem = ({ item, collapsed }: SortableSidebarItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <NavLink
      ref={setNodeRef}
      to={item.to}
      end={item.end}
      style={style}
      aria-label={item.label}
      className={({ isActive }) =>
        `focus-sidebar__item${item.extraClassName ? ` ${item.extraClassName}` : ''}${isActive ? ' is-active' : ''}${isDragging ? ' is-dragging' : ''}`
      }
      {...attributes}
      {...listeners}
    >
      <item.Icon size={18} aria-hidden="true" />
      {!collapsed ? <span>{item.label}</span> : null}
    </NavLink>
  )
}

const Sidebar = ({ collapsed, onToggle, theme, onToggleTheme }: SidebarProps) => {
  const { catalog } = useLabs()
  const i18n = useLabsI18n()
  const { t } = useI18n()
  const [savedOrder, setSavedOrder] = useState<string[]>(() => readSidebarOrder())
  const isLoggedIn = useIsLoggedIn()
  const plan = useAuthPlan()
  const isPremium = plan === 'premium'
  const isAdmin = useIsAdmin()
  const { openModal: openUpgradeModal } = useUpgradeModal()

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const nextOrder = moveSidebarOrder(mergedOrder, String(active.id), String(over.id))
    setSavedOrder(nextOrder)
    writeSidebarOrder(nextOrder)
    void syncedPreferencesRepo.persistFromLocal()
  }

  useEffect(() => {
    const refreshSavedOrder = () => setSavedOrder(readSidebarOrder())
    window.addEventListener(SYNCED_PREFERENCES_UPDATED_EVENT, refreshSavedOrder)
    return () => window.removeEventListener(SYNCED_PREFERENCES_UPDATED_EVENT, refreshSavedOrder)
  }, [])

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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <nav className="focus-sidebar__nav" aria-label={t('shell.mainModules')}>
          <SortableContext items={orderedVisibleItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            {orderedVisibleItems.map((item) => (
              <SortableSidebarItem key={item.id} item={item} collapsed={collapsed} />
            ))}
          </SortableContext>
        </nav>
      </DndContext>

      <SidebarPodcastPlayer collapsed={collapsed} />
      <PodcastCard standalone />

      <div className="focus-sidebar__bottom">
        {isLoggedIn && !isPremium && (
          <button
            type="button"
            className="focus-sidebar__upgrade"
            onClick={() => openUpgradeModal()}
            aria-label={t('auth.upgradePlan')}
          >
            <Sparkles size={14} aria-hidden="true" />
            {!collapsed && <span>{t('auth.upgradePlan')}</span>}
          </button>
        )}
        <div className="focus-sidebar__theme-toggle">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </motion.aside>
  )
}

export default Sidebar
