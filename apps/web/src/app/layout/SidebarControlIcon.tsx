import { Pause, Play, type LucideIcon } from 'lucide-react'

/** Both states stay mounted so rapid transport clicks never wait for an exit. */
const SidebarControlIcon = ({ active, Idle = Play, size = 16 }: { active: boolean; Idle?: LucideIcon; size?: number }) => (
  <span className={`sidebar-control-icon${active ? ' is-active' : ''}`} aria-hidden="true">
    <Idle className="sidebar-control-icon__idle" size={size} />
    <Pause className="sidebar-control-icon__active" size={size} />
  </span>
)

export default SidebarControlIcon
