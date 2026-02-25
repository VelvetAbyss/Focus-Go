import { NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import {
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
import { NAV_ITEMS, ROUTES, type RouteKey } from '../routes/routes'
import { microInteractionSpring } from '../../shared/ui/transitions'
import { useI18n } from '../../shared/i18n/useI18n'
import ThemeToggle from '../../shared/theme/ThemeToggle'
import type { ThemeMode } from '../../shared/theme/theme'

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
}

const Sidebar = ({ collapsed, onToggle, theme, onToggleTheme }: SidebarProps) => {
  const { t } = useI18n()

  return (
    <motion.aside
      className={`focus-sidebar ${collapsed ? 'is-collapsed' : ''}`}
      animate={{ width: collapsed ? 78 : 212 }}
      transition={microInteractionSpring}
    >
      <div className="focus-sidebar__top">
        <button
          type="button"
          className="focus-sidebar__toggle"
          onClick={onToggle}
          aria-label={collapsed ? t('shell.expandSidebar') : t('shell.collapseSidebar')}
          aria-pressed={collapsed}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed ? <span>{t('shell.hideNav')}</span> : null}
        </button>
      </div>

      <nav className="focus-sidebar__nav" aria-label={t('shell.mainModules')}>
        {NAV_ITEMS.map((item) => {
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
              {!collapsed ? <span>{t(`nav.${item.key}`)}</span> : null}
            </NavLink>
          )
        })}
      </nav>

      <div className="focus-sidebar__bottom">
        <div className="focus-sidebar__theme-toggle">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </motion.aside>
  )
}

export default Sidebar
