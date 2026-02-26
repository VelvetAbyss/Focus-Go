import { NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Beaker,
  CalendarDays,
  House,
  LibraryBig,
  ListTodo,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Rss,
  Settings,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { BASE_NAV_ITEMS, ROUTES, type RouteKey } from '../routes/routes'
import ThemeToggle from '../../shared/theme/ThemeToggle'
import type { ThemeMode } from '../../shared/theme/theme'
import { useLabs } from '../../features/labs/LabsContext'
import { buildNavWithConditionalRss } from '../../features/labs/accessRules'
import { useLabsI18n } from '../../features/labs/labsI18n'

type SidebarProps = {
  collapsed: boolean
  onToggle: () => void
  theme: ThemeMode
  onToggleTheme: () => void
}

const ICONS: Record<RouteKey, LucideIcon> = {
  dashboard: House,
  rss: Rss,
  tasks: ListTodo,
  calendar: CalendarDays,
  focus: Timer,
  notes: LibraryBig,
  review: NotebookPen,
  settings: Settings,
  labs: Beaker,
}

const Sidebar = ({ collapsed, onToggle, theme, onToggleTheme }: SidebarProps) => {
  const { canAccessRssFeature } = useLabs()
  const i18n = useLabsI18n()

  const baseKeys = BASE_NAV_ITEMS.map((item) => item.key)
  const navKeys = buildNavWithConditionalRss(baseKeys, canAccessRssFeature) as RouteKey[]

  const navItems = navKeys.map((key) => {
    if (key === 'rss') return { key: 'rss' as const, to: ROUTES.RSS }
    const base = BASE_NAV_ITEMS.find((item) => item.key === key)
    return { key, to: base?.to ?? ROUTES.DASHBOARD }
  })

  return (
    <motion.aside
      className={`focus-sidebar ${collapsed ? 'is-collapsed' : ''}`}
      animate={{ width: collapsed ? 80 : 220 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="focus-sidebar__top">
        <button type="button" className="focus-sidebar__toggle" onClick={onToggle}>
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed ? <span>Hide nav</span> : null}
        </button>
      </div>

      <nav className="focus-sidebar__nav" aria-label="Main modules">
        {navItems.map((item) => {
          const Icon = ICONS[item.key]
          const isDashboard = item.to === ROUTES.DASHBOARD
          return (
            <NavLink
              key={item.key}
              to={item.to}
              end={isDashboard}
              className={({ isActive }) => `focus-sidebar__item ${isActive ? 'is-active' : ''}`}
            >
              <Icon size={18} aria-hidden />
              {!collapsed ? <span>{i18n.nav[item.key]}</span> : null}
            </NavLink>
          )
        })}
      </nav>

      <div className="focus-sidebar__labs-zone">
        <NavLink to={ROUTES.LABS} className={({ isActive }) => `focus-sidebar__item focus-sidebar__labs ${isActive ? 'is-active' : ''}`}>
          <Beaker size={18} aria-hidden />
          {!collapsed ? <span>{i18n.nav.labs}</span> : null}
        </NavLink>
      </div>

      <div className="focus-sidebar__bottom">
        <div className="focus-sidebar__theme-toggle">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </motion.aside>
  )
}

export default Sidebar
